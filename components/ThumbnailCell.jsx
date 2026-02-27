import React from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  View,
  Dimensions,
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
 */
export default function ThumbnailCell({ asset, status, selected, onPress }) {
  if (!asset) {
    return <View style={styles.cell} />;
  }

  return (
    <TouchableOpacity
      style={[styles.cell, selected && styles.selectedCell]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Image source={{ uri: asset.uri }} style={styles.image} />

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
