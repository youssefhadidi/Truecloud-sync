import { createSlice, createSelector } from '@reduxjs/toolkit';

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
      // O(N+M) dedupe — `includes` per id would be O(N*M) and stalled the
      // UI for ~1s on months with several hundred photos.
      const existing = new Set(state.selectedIds);
      for (const id of action.payload) {
        if (!existing.has(id)) {
          existing.add(id);
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

/** Returns a Set for O(1) has() lookups — memoized so the same Set reference is returned when the array hasn't changed */
export const selectSelectedIdsSet = createSelector(
  (state) => state.gallery.selectedIds,
  (selectedIds) => new Set(selectedIds)
);

export default gallerySlice.reducer;
