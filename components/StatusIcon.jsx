import React from 'react';
import { Ionicons } from '@expo/vector-icons';

const STATUS_CONFIG = {
  synced: { name: 'checkmark-circle', color: '#22c55e' },
  syncing: { name: 'cloud-upload', color: '#38bdf8' },
  pending: { name: 'time', color: '#f59e0b' },
  skipped: { name: 'remove-circle', color: '#64748b' },
  failed: { name: 'close-circle', color: '#ef4444' },
};

/**
 * Renders an Ionicon for a given sync status string.
 * Returns null for unknown/empty statuses.
 */
export default function StatusIcon({ status, size = 18 }) {
  const config = STATUS_CONFIG[status];
  if (!config) return null;

  return <Ionicons name={config.name} size={size} color={config.color} />;
}
