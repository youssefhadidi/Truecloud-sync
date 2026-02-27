import { createAsyncThunk } from '@reduxjs/toolkit';
import { Alert } from 'react-native';
import * as Network from 'expo-network';
import axiosClient from '../services/axiosClient';
import { getAssetInfo } from '../services/galleryService';
import {
  initUploadItems,
  setItemStatus,
  setItemProgress,
  setSyncing,
} from './uploadsSlice';
import { clearSelection } from './gallerySlice';

const MAX_PARALLEL_UPLOADS = 5;

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
    const { uri, fileSize } = await getAssetInfo(asset.id);

    const formData = new FormData();
    formData.append('file', {
      uri,
      name: asset.filename,
      type: asset.mediaType === 'video' ? 'video/mp4' : 'image/jpeg',
    });

    await axiosClient.post(`/api/files/upload?path=${syncPath}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 5 * 60 * 1000,
      signal,
      onUploadProgress(evt) {
        // React Native FormData uploads often report evt.total = 0 because the
        // Content-Length header isn't set. Fall back to fileSize from MediaLibrary.
        const denom = evt.total > 0 ? evt.total : fileSize;
        if (denom > 0) {
          dispatch(
            setItemProgress({
              assetId: asset.id,
              progress: Math.round((evt.loaded / denom) * 100),
            })
          );
        }
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
      const res = await axiosClient.get(`/api/files?path=${syncPath}`);
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
    const concurrency = maxParallelUploads ?? MAX_PARALLEL_UPLOADS;
    const tasks = toUpload.map(
      (asset) => () => uploadOne({ asset, syncPath, dispatch, signal })
    );

    await runPool(tasks, concurrency);

    dispatch(setSyncing(false));
    dispatch(clearSelection());
  }
);
