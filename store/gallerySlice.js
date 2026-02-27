import { createSlice } from '@reduxjs/toolkit';

// Note: Redux state must be serializable, so we store selectedIds as an array.
// Use the selectSelectedIdsSet selector for O(1) lookups in components.
const gallerySlice = createSlice({
  name: 'gallery',
  initialState: {
    selectedIds: [],
  },
  reducers: {
    toggleSelect(state, action) {
      const id = action.payload;
      const idx = state.selectedIds.indexOf(id);
      if (idx >= 0) {
        state.selectedIds.splice(idx, 1);
      } else {
        state.selectedIds.push(id);
      }
    },
    selectAll(state, action) {
      for (const id of action.payload) {
        if (!state.selectedIds.includes(id)) {
          state.selectedIds.push(id);
        }
      }
    },
    deselectAll(state, action) {
      const toRemove = new Set(action.payload);
      state.selectedIds = state.selectedIds.filter((id) => !toRemove.has(id));
    },
    clearSelection(state) {
      state.selectedIds = [];
    },
  },
});

export const { toggleSelect, selectAll, deselectAll, clearSelection } = gallerySlice.actions;

/** Returns a Set for O(1) has() lookups — derive fresh Set per render only when array changes */
export const selectSelectedIdsSet = (state) => new Set(state.gallery.selectedIds);

export default gallerySlice.reducer;
