import React, { useMemo } from 'react';
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

export default function UploadsScreen() {
  const insets = useSafeAreaInsets();
  const { data: serverFilenames = new Set(), isLoading: serverLoading } = useServerFiles();
  // The query is permission-gated inside the hook itself — passing `true` just
  // means "join the shared cache if the Gallery tab has already populated it"
  // (or load it now if not). It will not prompt the user.
  const { assetsMap } = useGalleryAssets(true);
  const uploadItems = useSelector((state) => state.uploads.items);

  // Combine session upload entries with server-side synced files
  const entries = useMemo(() => {
    const map = {};

    // Session entries (pending / syncing / failed / synced / skipped)
    for (const [assetId, item] of Object.entries(uploadItems)) {
      const asset = assetsMap[assetId];
      map[assetId] = {
        assetId,
        filename: asset?.filename ?? item.filename ?? assetId,
        uri: asset?.uri ?? item.uri ?? null,
        creationTime: asset?.creationTime ?? item.creationTime ?? null,
        status: item.status,
        progress: item.progress ?? 0,
        isSessionEntry: true,
      };
    }

    // Server entries not already in session map
    for (const asset of Object.values(assetsMap)) {
      if (!map[asset.id] && serverFilenames.has(asset.filename)) {
        map[asset.id] = {
          assetId: asset.id,
          filename: asset.filename,
          uri: asset.uri,
          creationTime: asset.creationTime,
          status: 'synced',
          progress: 100,
          isSessionEntry: false,
        };
      }
    }

    // Sort: active first (syncing → pending → failed → skipped → synced)
    const statusOrder = { syncing: 0, pending: 1, failed: 2, skipped: 3, synced: 4 };
    return Object.values(map).sort((a, b) => {
      const aOrder = statusOrder[a.status] ?? 99;
      const bOrder = statusOrder[b.status] ?? 99;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return (b.creationTime ?? 0) - (a.creationTime ?? 0);
    });
  }, [uploadItems, serverFilenames, assetsMap]);

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
      renderItem={({ item }) => (
        <View style={styles.row}>
          {item.uri ? (
            <Image source={{ uri: item.uri }} style={styles.thumbnail} />
          ) : (
            <View style={[styles.thumbnail, styles.thumbnailPlaceholder]} />
          )}

          <View style={styles.info}>
            <Text style={styles.filename} numberOfLines={1}>
              {item.filename}
            </Text>
            {item.creationTime ? (
              <Text style={styles.date}>{formatDate(item.creationTime)}</Text>
            ) : null}

            {/* Progress bar — only shown while actively uploading */}
            {item.status === 'syncing' && (
              <View style={styles.progressTrack}>
                <View
                  style={[styles.progressFill, { width: `${item.progress}%` }]}
                />
              </View>
            )}
          </View>

          <StatusIcon status={item.status} size={22} />
        </View>
      )}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
    />
  );
}

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
  separator: {
    height: 1,
    backgroundColor: '#1e293b',
    marginLeft: 80,
  },
});
