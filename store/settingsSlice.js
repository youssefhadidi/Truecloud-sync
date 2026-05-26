import { createSlice } from '@reduxjs/toolkit';

const settingsSlice = createSlice({
  name: 'settings',
  initialState: {
    syncPath: 'sync',
    wifiOnly: true,
    maxParallelUploads: 3,
    hideSynced: false,
  },
  reducers: {
    updateSettings(state, action) {
      return { ...state, ...action.payload };
    },
  },
});

export const { updateSettings } = settingsSlice.actions;
export default settingsSlice.reducer;
