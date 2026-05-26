import { createAsyncThunk } from '@reduxjs/toolkit';
import * as Network from 'expo-network';
import * as FileSystem from 'expo-file-system/legacy';
import { authEvents } from '../services/axiosClient';
import { store } from './index';
import {
  initUploadItems,
  setItemStatus,
  setItemProgress,
  setSyncing,
} from './uploadsSlice';

/**
 * Upload a single shared file via expo-file-system's streaming upload — keeps
 * memory flat regardless of file size (large videos would OOM the FormData
 * path).
 */
async function uploadSharedFile({ file, syncPath, dispatch, signal }) {
  const id = file.path;

  if (signal.aborted) {
    dispatch(setItemStatus({ assetId: id, status: 'failed' }));
    return;
  }

  dispatch(setItemStatus({ assetId: id, status: 'syncing' }));

  try {
    const { backendUrl } = store.getState().auth;
    const url = `${backendUrl}/api/files/upload?path=${encodeURIComponent(syncPath)}`;

    let lastPct = -1;
    const task = FileSystem.createUploadTask(
      url,
      file.path,
      {
        httpMethod: 'POST',
        uploadType: FileSystem.FileSystemUploadType.MULTIPART,
        fieldName: 'file',
        mimeType: file.mimeType || 'application/octet-stream',
        parameters: {},
      },
      ({ totalBytesSent, totalBytesExpectedToSend }) => {
        const denom = totalBytesExpectedToSend > 0 ? totalBytesExpectedToSend : (file.size || 0);
        if (denom <= 0) return;
        const pct = Math.round((totalBytesSent / denom) * 100);
        if (pct === lastPct) return;
        lastPct = pct;
        dispatch(setItemProgress({ assetId: id, progress: pct }));
      }
    );

    const onAbort = () => { task.cancelAsync().catch(() => {}); };
    signal.addEventListener('abort', onAbort);

    let result;
    try {
      result = await task.uploadAsync();
    } finally {
      signal.removeEventListener('abort', onAbort);
    }

    if (!result) throw new Error('Upload cancelled');

    if (result.status === 401 || result.status === 403) {
      authEvents.emit('auth:expired');
      throw new Error(`HTTP ${result.status}`);
    }
    if (result.status >= 400) {
      throw new Error(`HTTP ${result.status}`);
    }

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
