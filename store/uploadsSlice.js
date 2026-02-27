import { createSlice } from '@reduxjs/toolkit';

/**
 * Each item shape:
 * {
 *   assetId: string,
 *   filename: string,
 *   uri: string | null,
 *   creationTime: number | null,
 *   status: 'pending' | 'syncing' | 'synced' | 'skipped' | 'failed',
 *   progress: number,   // 0–100, only meaningful when status === 'syncing'
 * }
 */
const uploadsSlice = createSlice({
  name: 'uploads',
  initialState: {
    items: {},    // { [assetId]: UploadItem }
    syncing: false,
  },
  reducers: {
    initUploadItems(state, action) {
      for (const item of action.payload) {
        state.items[item.assetId] = { ...item, progress: 0 };
      }
    },
    setItemStatus(state, action) {
      const { assetId, status } = action.payload;
      if (state.items[assetId]) {
        state.items[assetId].status = status;
        if (status !== 'syncing') {
          state.items[assetId].progress = status === 'synced' ? 100 : 0;
        }
      }
    },
    setItemProgress(state, action) {
      const { assetId, progress } = action.payload;
      if (state.items[assetId]) {
        state.items[assetId].progress = progress;
      }
    },
    setSyncing(state, action) {
      state.syncing = action.payload;
    },
    clearUploads(state) {
      state.items = {};
      state.syncing = false;
    },
  },
});

export const {
  initUploadItems,
  setItemStatus,
  setItemProgress,
  setSyncing,
  clearUploads,
} = uploadsSlice.actions;

export default uploadsSlice.reducer;
