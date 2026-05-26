import { createAsyncThunk } from '@reduxjs/toolkit';
import { Alert } from 'react-native';
import * as Network from 'expo-network';
import * as FileSystem from 'expo-file-system/legacy';
import axiosClient from '../services/axiosClient';
import { getAssetInfo } from '../services/galleryService';
import {
  initUploadItems,
  setItemStatus,
  setItemProgress,
  setSyncing,
  purgeFinishedUploads,
} from './uploadsSlice';
import { clearSelection } from './gallerySlice';

const MAX_PARALLEL_UPLOADS = 2;
// Hard ceiling regardless of user setting — iOS jetsam kills the app if too
// many concurrent multipart uploads keep file buffers resident in memory.
const PARALLEL_CEILING = 3;

/**
 * Upload a single asset and dispatch progress updates.
 * Uses the AbortSignal from createAsyncThunk for cancellation.
 */
async function uploadOne({ asset, syncPath, dispatch, signal }) {
  if (signal.aborted) {
    dispatch(setItemStatus({ assetId: asset.id, status: 'failed' }));
    return;
  }

  dispatch(setItemStatus({ assetId: asset.id, status: 'syncing' }));

  try {
    const { uri, fileSize: mediaLibrarySize } = await getAssetInfo(asset.id);

    // MediaLibrary often returns 0 for fileSize on iOS (especially for iCloud
    // originals). Stat the file as a fallback when we have a real file:// path.
    // Skipping non-file URIs avoids a native crash in expo-file-system/legacy
    // under the new architecture when handed a ph:// asset URI.
    let fileSize = mediaLibrarySize;
    if (!fileSize && typeof uri === 'string' && uri.startsWith('file://')) {
      try {
        const info = await FileSystem.getInfoAsync(uri, { size: true });
        fileSize = info.size ?? 0;
      } catch {
        fileSize = 0;
      }
    }

    const formData = new FormData();
    formData.append('file', {
      uri,
      name: asset.filename,
      type: asset.mediaType === 'video' ? 'video/mp4' : 'image/jpeg',
    });

    // Dedup progress dispatches — axios fires onUploadProgress many times per
    // second, and each dispatch invalidates state.uploads.items (re-renders
    // both the Gallery and Uploads tabs). Only emit when the rounded percent
    // actually advances.
    let lastPct = -1;

    await axiosClient.post(`/api/files/upload?path=${encodeURIComponent(syncPath)}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 5 * 60 * 1000,
      signal,
      onUploadProgress(evt) {
        const denom = evt.total > 0 ? evt.total : fileSize;
        if (denom <= 0) return;
        const pct = Math.round((evt.loaded / denom) * 100);
        if (pct === lastPct) return;
        lastPct = pct;
        dispatch(setItemProgress({ assetId: asset.id, progress: pct }));
      },
    });

    dispatch(setItemStatus({ assetId: asset.id, status: 'synced' }));
  } catch (err) {
    // Cancelled or network error — mark failed either way
    dispatch(setItemStatus({ assetId: asset.id, status: 'failed' }));
  }
}

/**
 * Run an array of async task factories with a bounded concurrency pool.
 *
 * @param {Array<() => Promise<void>>} tasks
 * @param {number} maxConcurrent
 */
function runPool(tasks, maxConcurrent) {
  return new Promise((resolve) => {
    const queue = [...tasks];
    let active = 0;

    function next() {
      while (active < maxConcurrent && queue.length > 0) {
        active++;
        const task = queue.shift();
        task().finally(() => {
          active--;
          if (queue.length > 0) {
            next();
          } else if (active === 0) {
            resolve();
          }
        });
      }
      if (active === 0 && queue.length === 0) resolve();
    }

    next();
  });
}

/**
 * Main sync thunk.
 *
 * Usage:
 *   const thunkRef = useRef(null);
 *   thunkRef.current = dispatch(startSync({ assetsMap }));
 *   // to cancel: thunkRef.current.abort();
 */
export const startSync = createAsyncThunk(
  'sync/startSync',
  async ({ assetsMap }, { dispatch, getState, signal }) => {
    const state = getState();
    const { syncPath, wifiOnly, maxParallelUploads } = state.settings;
    const selectedIds = state.gallery.selectedIds;

    if (selectedIds.length === 0) {
      Alert.alert('Nothing selected', 'Tap photos to select them before syncing.');
      return;
    }

    // ── Wi-Fi check ──────────────────────────────────────────────────────────
    if (wifiOnly) {
      const net = await Network.getNetworkStateAsync();
      if (net.type !== Network.NetworkStateType.WIFI) {
        Alert.alert(
          'Wi-Fi required',
          'Connect to Wi-Fi or disable the Wi-Fi-only setting in Settings.'
        );
        return;
      }
    }

    // ── Fetch current server file list ───────────────────────────────────────
    const serverFilenames = new Set();
    try {
      const res = await axiosClient.get(`/api/files?path=${encodeURIComponent(syncPath)}`);
      (res.data?.files || []).forEach((f) => serverFilenames.add(f.name));
    } catch {
      // Proceed anyway — worst case we re-upload existing files
    }

    // ── Classify selected assets ─────────────────────────────────────────────
    const toUpload = [];
    const initItems = [];

    for (const assetId of selectedIds) {
      const asset = assetsMap[assetId];
      if (!asset) continue;

      const status = serverFilenames.has(asset.filename) ? 'skipped' : 'pending';
      initItems.push({
        assetId,
        filename: asset.filename,
        uri: asset.uri ?? null,
        creationTime: asset.creationTime ?? null,
        status,
      });
      if (status === 'pending') toUpload.push(asset);
    }

    dispatch(initUploadItems(initItems));
    dispatch(setSyncing(true));

    // ── Parallel upload pool ─────────────────────────────────────────────────
    const requested = maxParallelUploads ?? MAX_PARALLEL_UPLOADS;
    const concurrency = Math.min(Math.max(requested, 1), PARALLEL_CEILING);
    const tasks = toUpload.map(
      (asset) => () => uploadOne({ asset, syncPath, dispatch, signal })
    );

    await runPool(tasks, concurrency);

    // Keep failures visible — the user can see what didn't go through.
    dispatch(purgeFinishedUploads());
    dispatch(clearSelection());
  }
);
