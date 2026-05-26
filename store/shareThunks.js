import { createAsyncThunk } from '@reduxjs/toolkit';
import * as Network from 'expo-network';
import axiosClient from '../services/axiosClient';
import {
  initUploadItems,
  setItemStatus,
  setItemProgress,
  setSyncing,
} from './uploadsSlice';

/**
 * Upload a single shared file.
 */
async function uploadSharedFile({ file, syncPath, dispatch, signal }) {
  const id = file.path;

  if (signal.aborted) {
    dispatch(setItemStatus({ assetId: id, status: 'failed' }));
    return;
  }

  dispatch(setItemStatus({ assetId: id, status: 'syncing' }));

  try {
    const formData = new FormData();
    formData.append('file', {
      uri: file.path,
      name: file.fileName,
      type: file.mimeType || 'application/octet-stream',
    });

    await axiosClient.post(`/api/files/upload?path=${encodeURIComponent(syncPath)}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 5 * 60 * 1000,
      signal,
      onUploadProgress(evt) {
        const denom = evt.total > 0 ? evt.total : (file.size || 0);
        if (denom > 0) {
          dispatch(
            setItemProgress({
              assetId: id,
              progress: Math.round((evt.loaded / denom) * 100),
            })
          );
        }
      },
    });

    dispatch(setItemStatus({ assetId: id, status: 'synced' }));
  } catch {
    dispatch(setItemStatus({ assetId: id, status: 'failed' }));
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
