import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  View,
  Dimensions,
  InteractionManager,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import StatusIcon from './StatusIcon';

const GAP = 2;
const COLS = 3;
const CELL_SIZE = (Dimensions.get('window').width - GAP * (COLS + 1)) / COLS;

/**
 * A single photo cell in the gallery grid.
 *
 * Props:
 *   asset      — MediaLibrary.Asset (or null for empty padding cell)
 *   status     — sync status string ('synced'|'syncing'|'pending'|'skipped'|'failed')
 *   selected   — boolean
 *   onPress    — () => void
 *
 * Lazy loading: the image is only fetched after all in-flight JS interactions
 * (scroll, animation) have settled, so fast scrolling never triggers a burst
 * of network/decode work for off-screen cells.
 */
function ThumbnailCell({ asset, status, selected, onPress }) {
  // Start false — image renders only after interactions settle
  const [imageReady, setImageReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void InteractionManager.runAfterInteractions().then(() => {
      if (!cancelled) setImageReady(true);
    });
    return () => { cancelled = true; };
  }, []);

  if (!asset) {
    return <View style={styles.cell} />;
  }

  return (
    <TouchableOpacity
      style={[styles.cell, selected && styles.selectedCell]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      {imageReady && (
        <Image
          source={{ uri: asset.uri }}
          style={styles.image}
          contentFit="cover"
          recyclingKey={asset.id}
        />
      )}

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
