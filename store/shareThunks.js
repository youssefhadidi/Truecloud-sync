import { createAsyncThunk } from '@reduxjs/toolkit';
import * as Network from 'expo-network';
import { uploadFile } from '../services/uploadService';
import {
  initUploadItems,
  setItemStatus,
  setItemProgress,
  setSyncing,
} from './uploadsSlice';

async function uploadSharedFile({ file, syncPath, dispatch, signal }) {
  const id = file.path;

  if (signal.aborted) {
    dispatch(setItemStatus({ assetId: id, status: 'failed', error: 'cancelled' }));
    return;
  }

  dispatch(setItemStatus({ assetId: id, status: 'syncing' }));

  try {
    await uploadFile({
      sourceUri: file.path,
      syncPath,
      filename: file.fileName,
      mimeType: file.mimeType || 'application/octet-stream',
      fileSize: file.size || 0,
      signal,
      onProgress: ({ percent, bytesPerSecond }) => {
        dispatch(setItemProgress({ assetId: id, progress: percent, bytesPerSecond }));
      },
    });

    dispatch(setItemStatus({ assetId: id, status: 'synced' }));
  } catch (err) {
    const msg = err?.message || String(err);
    console.warn(`[upload] ${file.fileName} failed:`, msg, err);
    dispatch(setItemStatus({ assetId: id, status: 'failed', error: msg }));
  }
}

/**
 * Thunk to upload files received via share intent.
 *
 * @param {ShareIntentFile[]} files — from expo-share-intent
 */
export const startShareSync = createAsyncThunk(
  'sync/startShareSync',
  async ({ files, overridePath }, { dispatch, getState, signal }) => {
    const { syncPath: defaultPath, wifiOnly } = getState().settings;
    const syncPath = overridePath ?? defaultPath;

    if (wifiOnly) {
      const net = await Network.getNetworkStateAsync();
      if (net.type !== Network.NetworkStateType.WIFI) {
        throw new Error('wifi_required');
      }
    }

    const initItems = files.map((f) => ({
      assetId: f.path,
      filename: f.fileName,
      uri: f.path,
      creationTime: null,
      status: 'pending',
    }));

    dispatch(initUploadItems(initItems));
    dispatch(setSyncing(true));

    for (const file of files) {
      await uploadSharedFile({ file, syncPath, dispatch, signal });
    }

    // Leave items intact so the share-intent UI can compute `allDone` and
    // show the Done button. Cleanup happens when the user dismisses.
    dispatch(setSyncing(false));
  }
);
