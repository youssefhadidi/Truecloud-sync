import { createSlice } from '@reduxjs/toolkit';

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    backendUrl: '',
    userEmail: null,
  },
  reducers: {
    setAuth(state, action) {
      state.backendUrl = action.payload.backendUrl;
      state.userEmail = action.payload.userEmail;
    },
    setBackendUrl(state, action) {
      state.backendUrl = action.payload;
    },
    clearAuth(state) {
      state.userEmail = null;
    },
  },
});

export const { setAuth, setBackendUrl, clearAuth } = authSlice.actions;
export default authSlice.reducer;
