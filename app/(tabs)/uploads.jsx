import React, { useMemo, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { useSelector } from 'react-redux';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useServerFiles } from '../../hooks/useServerFiles';
import { useGalleryAssets } from '../../hooks/useGalleryAssets';
import StatusIcon from '../../components/StatusIcon';

function formatDate(timestamp) {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatSpeed(bytesPerSecond) {
  if (!bytesPerSecond || bytesPerSecond <= 0) return '';
  if (bytesPerSecond >= 1024 * 1024) return `${(bytesPerSecond / 1024 / 1024).toFixed(1)} MB/s`;
  if (bytesPerSecond >= 1024) return `${(bytesPerSecond / 1024).toFixed(0)} KB/s`;
  return `${Math.round(bytesPerSecond)} B/s`;
}

// Equality fn for the parent's selector: ignore progress / bytesPerSecond so
// the list only rebuilds on key or status transitions (a handful of times per
// upload), not on every progress tick (dozens per second).
function shallowItemsByStatus(a, b) {
  if (a === b) return true;
  const ak = Object.keys(a);
  const bk = Object.keys(b);
  if (ak.length !== bk.length) return false;
  for (const k of ak) {
    const av = a[k];
    const bv = b[k];
    if (!bv) return false;
    if (av.status !== bv.status) return false;
    if (av.error !== bv.error) return false;
  }
  return true;
}

export default function UploadsScreen() {
  const insets = useSafeAreaInsets();
  const { data: serverFilenames = new Set(), isLoading: serverLoading } = useServerFiles();
  // The query is permission-gated inside the hook itself — passing `true` just
  // means "join the shared cache if the Gallery tab has already populated it"
  // (or load it now if not). It will not prompt the user.
  const { assetsMap } = useGalleryAssets(true);
  // Custom equality keeps this selector stable across progress dispatches;
  // it only fires a re-render when an item's status/error or the key set
  // changes. Per-item progress is read inside <UploadRow> instead.
  const uploadItems = useSelector(
    (state) => state.uploads.items,
    shallowItemsByStatus
  );

  // filename → asset, rebuilt only when the gallery cache changes. Iterating
  // serverFilenames (a Set of names) against this map is far cheaper than the
  // old Object.values(assetsMap) scan that ran on every progress tick.
  const assetsByFilename = useMemo(() => {
    const m = new Map();
    for (const id in assetsMap) m.set(assetsMap[id].filename, assetsMap[id]);
    return m;
  }, [assetsMap]);

  // Server-only entries (status='synced'), pre-sorted by creationTime desc.
  // Only recomputes when server data or the library changes — NOT per progress
  // tick. This is the slice that can grow into the thousands.
  const serverOnlyEntries = useMemo(() => {
    const arr = [];
    for (const filename of serverFilenames) {
      const asset = assetsByFilename.get(filename);
      if (!asset) continue;
      arr.push({
        assetId: asset.id,
        filename,
        uri: asset.uri,
        creationTime: asset.creationTime,
        status: 'synced',
        isSessionEntry: false,
      });
    }
    arr.sort((a, b) => (b.creationTime ?? 0) - (a.creationTime ?? 0));
    return arr;
  }, [serverFilenames, assetsByFilename]);

  // Session entries — pending / syncing / failed / synced / skipped. Only
  // status, filename, uri, creationTime are baked in here; progress / speed /
  // error are read inside <UploadRow> from Redux so progress ticks don't
  // invalidate this memo or re-render every row.
  const sessionEntries = useMemo(() => {
    const arr = [];
    for (const [assetId, item] of Object.entries(uploadItems)) {
      const asset = assetsMap[assetId];
      arr.push({
        assetId,
        filename: asset?.filename ?? item.filename ?? assetId,
        uri: asset?.uri ?? item.uri ?? null,
        creationTime: asset?.creationTime ?? item.creationTime ?? null,
        status: item.status,
        isSessionEntry: true,
      });
    }
    const statusOrder = { syncing: 0, pending: 1, failed: 2, skipped: 3, synced: 4 };
    arr.sort((a, b) => {
      const ao = statusOrder[a.status] ?? 99;
      const bo = statusOrder[b.status] ?? 99;
      if (ao !== bo) return ao - bo;
      return (b.creationTime ?? 0) - (a.creationTime ?? 0);
    });
    return arr;
  }, [uploadItems, assetsMap]);

  // Final merge: session entries (already sorted) come first, then any server
  // entry that isn't already represented in the session list. Skipping the
  // dedupe pass when there's nothing to dedupe against keeps this O(1) most
  // of the time.
  const entries = useMemo(() => {
    if (sessionEntries.length === 0) return serverOnlyEntries;
    const sessionIds = new Set(sessionEntries.map((e) => e.assetId));
    const tail = serverOnlyEntries.filter((e) => !sessionIds.has(e.assetId));
    return sessionEntries.concat(tail);
  }, [sessionEntries, serverOnlyEntries]);

  const renderItem = useCallback(
    ({ item }) => <UploadRow entry={item} />,
    []
  );

  if (serverLoading && entries.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#38bdf8" />
      </View>
    );
  }

  if (entries.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>No uploads yet</Text>
        <Text style={styles.emptySub}>
          Select photos in the Gallery tab and tap "Sync" to start uploading.
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={entries}
      keyExtractor={(item) => item.assetId}
      style={styles.container}
      contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
      renderItem={renderItem}
      ItemSeparatorComponent={ItemSeparator}
    />
  );
}

const ItemSeparator = () => <View style={styles.separator} />;

/**
 * Renders a single row. Session entries subscribe to their own slice of
 * `state.uploads.items` so that a progress tick on asset A doesn't re-render
 * the row for asset B. Server-only entries skip the subscription entirely.
 */
const UploadRow = React.memo(function UploadRow({ entry }) {
  const { assetId, isSessionEntry, status: staticStatus, filename, uri, creationTime } = entry;

  // useSelector with default (===) equality: only re-fires when this specific
  // item's reference in state.uploads.items changes — which immer/RTK only does
  // for the asset whose action ran. Other rows stay quiet.
  const liveItem = useSelector((s) =>
    isSessionEntry ? s.uploads.items[assetId] : null
  );

  const status = liveItem?.status ?? staticStatus;
  const progress = liveItem?.progress ?? 0;
  const bytesPerSecond = liveItem?.bytesPerSecond ?? 0;
  const error = liveItem?.error ?? null;

  return (
    <View style={styles.row}>
      {uri ? (
        <Image source={{ uri }} style={styles.thumbnail} />
      ) : (
        <View style={[styles.thumbnail, styles.thumbnailPlaceholder]} />
      )}

      <View style={styles.info}>
        <Text style={styles.filename} numberOfLines={1}>
          {filename}
        </Text>
        {creationTime ? (
          <Text style={styles.date}>{formatDate(creationTime)}</Text>
        ) : null}

        {status === 'syncing' && (
          <>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progress}%` }]} />
            </View>
            <Text style={styles.speedText}>
              {progress}%
              {bytesPerSecond ? ` • ${formatSpeed(bytesPerSecond)}` : ''}
            </Text>
          </>
        )}

        {status === 'failed' && error ? (
          <Text style={styles.errorText} numberOfLines={2}>
            {error}
          </Text>
        ) : null}
      </View>

      <StatusIcon status={status} size={22} />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    padding: 32,
  },
  emptyTitle: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySub: {
    color: '#94a3b8',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#0f172a',
  },
  thumbnail: {
    width: 52,
    height: 52,
    borderRadius: 6,
    backgroundColor: '#1e293b',
    marginRight: 12,
  },
  thumbnailPlaceholder: {
    backgroundColor: '#1e293b',
  },
  info: {
    flex: 1,
    marginRight: 12,
  },
  filename: {
    color: '#f1f5f9',
    fontSize: 14,
    fontWeight: '500',
  },
  date: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 3,
  },
  progressTrack: {
    height: 3,
    backgroundColor: '#1e293b',
    borderRadius: 2,
    marginTop: 6,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#38bdf8',
    borderRadius: 2,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 12,
    marginTop: 4,
  },
  speedText: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 4,
  },
  separator: {
    height: 1,
    backgroundColor: '#1e293b',
    marginLeft: 80,
  },
});
