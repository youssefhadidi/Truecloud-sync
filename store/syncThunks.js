import { createAsyncThunk } from '@reduxjs/toolkit';
import { Alert } from 'react-native';
import * as Network from 'expo-network';
import * as FileSystem from 'expo-file-system/legacy';
import axiosClient from '../services/axiosClient';
import { getAssetInfo } from '../services/galleryService';
import { streamMultipartUpload, buildUploadUrl } from '../services/uploadService';
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
 * Upload a single asset. Delegates to streamMultipartUpload which builds the
 * multipart envelope on disk in chunks (so a 900 MB video doesn't OOM) and
 * uploads via the streaming BINARY_CONTENT path.
 */
async function uploadOne({ asset, syncPath, dispatch, signal }) {
  if (signal.aborted) {
    dispatch(setItemStatus({ assetId: asset.id, status: 'failed' }));
    return;
  }

  dispatch(setItemStatus({ assetId: asset.id, status: 'syncing' }));

  try {
    const { uri, fileSize: mediaLibrarySize } = await getAssetInfo(asset.id);

    if (!uri || !uri.startsWith('file://')) {
      throw new Error('Asset has no local file:// URI');
    }

    let fileSize = mediaLibrarySize;
    if (!fileSize) {
      try {
        const info = await FileSystem.getInfoAsync(uri, { size: true });
        fileSize = info.size ?? 0;
      } catch {
        fileSize = 0;
      }
    }

    await streamMultipartUpload({
      sourceUri: uri,
      uploadUrl: buildUploadUrl(syncPath),
      fieldName: 'file',
      filename: asset.filename,
      mimeType: asset.mediaType === 'video' ? 'video/mp4' : 'image/jpeg',
      fileSize,
      signal,
      onProgress: (pct) => {
        dispatch(setItemProgress({ assetId: asset.id, progress: pct }));
      },
    });

    dispatch(setItemStatus({ assetId: asset.id, status: 'synced' }));
  } catch {
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
