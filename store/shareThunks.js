import { createAsyncThunk } from '@reduxjs/toolkit';
import * as Network from 'expo-network';
import { streamMultipartUpload, buildUploadUrl } from '../services/uploadService';
import {
  initUploadItems,
  setItemStatus,
  setItemProgress,
  setSyncing,
} from './uploadsSlice';

/**
 * Upload a single shared file. Streams the multipart body from disk so large
 * videos don't blow the memory limit.
 */
async function uploadSharedFile({ file, syncPath, dispatch, signal }) {
  const id = file.path;

  if (signal.aborted) {
    dispatch(setItemStatus({ assetId: id, status: 'failed' }));
    return;
  }

  dispatch(setItemStatus({ assetId: id, status: 'syncing' }));

  try {
    await streamMultipartUpload({
      sourceUri: file.path,
      uploadUrl: buildUploadUrl(syncPath),
      fieldName: 'file',
      filename: file.fileName,
      mimeType: file.mimeType || 'application/octet-stream',
      fileSize: file.size || 0,
      signal,
      onProgress: (pct) => {
        dispatch(setItemProgress({ assetId: id, progress: pct }));
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
