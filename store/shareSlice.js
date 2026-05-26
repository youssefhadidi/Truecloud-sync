import { createSlice } from '@reduxjs/toolkit';

const shareSlice = createSlice({
  name: 'share',
  initialState: {
    targetPath: null,
  },
  reducers: {
    setShareTargetPath(state, action) {
      state.targetPath = action.payload;
    },
    clearShareTargetPath(state) {
      state.targetPath = null;
    },
  },
});

export const { setShareTargetPath, clearShareTargetPath } = shareSlice.actions;
export default shareSlice.reducer;
