import React, { useCallback } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  View,
  Dimensions,
  PixelRatio,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSelector, useDispatch } from 'react-redux';
import StatusIcon from './StatusIcon';
import { selectSelectedIdsSet, toggleSelect } from '../store/gallerySlice';

export const GAP = 2;
export const COLS = 3;
export const CELL_SIZE = (Dimensions.get('window').width - GAP * (COLS + 1)) / COLS;
// Each cell has margin GAP/2 on all sides, so a row is taller than CELL_SIZE
// by one full GAP. Used by gallery's getItemLayout.
export const ROW_HEIGHT = CELL_SIZE + GAP;
// Physical pixel size for the thumbnail request.
// iOS PhotoKit and Android Glide both use this to deliver a thumbnail
// at exactly the display resolution instead of decoding the full image.
const THUMB_PX = Math.round(CELL_SIZE * PixelRatio.get());

/**
 * A single photo cell in the gallery grid.
 *
 * Props:
 *   asset        — MediaLibrary.Asset (or null for empty padding cell)
 *   serverSynced — boolean: filename exists on the server
 *
 * Selection state and per-asset upload status are read directly from Redux
 * via cell-local selectors. A single tap (or progress tick on one upload)
 * only re-renders the cells whose own derived value actually changed.
 */
function ThumbnailCell({ asset, serverSynced }) {
  const assetId = asset?.id ?? null;

  const selected = useSelector((state) =>
    assetId ? selectSelectedIdsSet(state).has(assetId) : false
  );
  const uploadStatus = useSelector((state) =>
    assetId ? state.uploads.items[assetId]?.status : undefined
  );
  const status = uploadStatus ?? (serverSynced ? 'synced' : null);

  const dispatch = useDispatch();
  const handlePress = useCallback(() => {
    if (assetId) dispatch(toggleSelect(assetId));
  }, [dispatch, assetId]);

  if (!asset) {
    return <View style={styles.cell} />;
  }

  return (
    <TouchableOpacity
      style={[styles.cell, selected && styles.selectedCell]}
      onPress={handlePress}
      activeOpacity={0.75}
    >
      <Image
        source={{ uri: asset.uri, width: THUMB_PX, height: THUMB_PX }}
        style={styles.image}
        contentFit="cover"
        recyclingKey={asset.id}
        cachePolicy="memory-disk"
      />

      {/* Selection ring overlay */}
      {selected && (
        <View style={styles.selectionOverlay}>
          <Ionicons name="checkmark-circle" size={22} color="#38bdf8" />
        </View>
      )}

      {/* Sync status badge (bottom-right) */}
      {status && !selected && (
        <View style={styles.statusBadge}>
          <StatusIcon status={status} size={16} />
        </View>
      )}
    </TouchableOpacity>
  );
}

export default React.memo(ThumbnailCell);

const styles = StyleSheet.create({
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    margin: GAP / 2,
    backgroundColor: '#1e293b',
    borderRadius: 3,
    overflow: 'hidden',
  },
  selectedCell: {
    opacity: 0.75,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  selectionOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    alignItems: 'flex-start',
    padding: 4,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
  },
  statusBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
  },
});
