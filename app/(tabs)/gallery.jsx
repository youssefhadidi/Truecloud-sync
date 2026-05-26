import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  SectionList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { requestPermission } from '../../services/galleryService';
import { useGalleryAssets } from '../../hooks/useGalleryAssets';
import { useServerFiles } from '../../hooks/useServerFiles';
import { selectSelectedIdsSet, toggleSelect } from '../../store/gallerySlice';
import { startSync } from '../../store/syncThunks';
import ThumbnailCell from '../../components/ThumbnailCell';
import SectionHeader from '../../components/SectionHeader';

const COLS = 3;

export default function GalleryScreen() {
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch();
  const queryClient = useQueryClient();
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [permissionChecked, setPermissionChecked] = useState(false);

  const { sections, assetsMap, loading, error } = useGalleryAssets(permissionGranted);
  const { data: serverFilenames = new Set() } = useServerFiles();

  const selectedIds = useSelector(selectSelectedIdsSet);
  const uploadItems = useSelector((state) => state.uploads.items);
  const syncing = useSelector((state) => state.uploads.syncing);
  const hideSynced = useSelector((state) => state.settings.hideSynced);

  // Hold the thunk promise so we can call .abort() on cancel
  const syncThunkRef = useRef(null);
  // Track previous syncing value to detect transition true → false
  const prevSyncing = useRef(false);

  useEffect(() => {
    requestPermission().then((granted) => {
      setPermissionGranted(granted);
      setPermissionChecked(true);
      if (granted) {
        // The shared `galleryAssets` query was disabled while permission was
        // pending; nudge it now that we have access.
        queryClient.invalidateQueries({ queryKey: ['galleryAssets'] });
      }
    });
  }, [queryClient]);

  // After sync completes, refresh the server file list so newly uploaded
  // photos immediately show green checkmarks in the gallery.
  useEffect(() => {
    if (prevSyncing.current && !syncing) {
      queryClient.invalidateQueries({ queryKey: ['serverFiles'] });
    }
    prevSyncing.current = syncing;
  }, [syncing, queryClient]);

  const handleSync = useCallback(() => {
    syncThunkRef.current = dispatch(startSync({ assetsMap }));
  }, [dispatch, assetsMap]);

  const handleCancel = useCallback(() => {
    syncThunkRef.current?.abort();
  }, []);

  const getStatus = useCallback(
    (asset) => {
      if (uploadItems[asset.id]) return uploadItems[asset.id].status;
      if (serverFilenames.has(asset.filename)) return 'synced';
      return null;
    },
    [uploadItems, serverFilenames]
  );

  // When "Hide synced" is on, strip server-side synced assets and re-chunk
  // each section into rows of COLS so the grid stays even.
  const displaySections = useMemo(() => {
    if (!hideSynced) return sections;

    return sections
      .map((section) => {
        const kept = section.data
          .flat()
          .filter((a) => a && !serverFilenames.has(a.filename));
        if (kept.length === 0) return null;

        const rows = [];
        for (let i = 0; i < kept.length; i += COLS) {
          const row = kept.slice(i, i + COLS);
          while (row.length < COLS) row.push(null);
          rows.push(row);
        }
        return {
          ...section,
          data: rows,
          assetIds: kept.map((a) => a.id),
        };
      })
      .filter(Boolean);
  }, [sections, serverFilenames, hideSynced]);

  if (!permissionChecked) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#38bdf8" />
      </View>
    );
  }

  if (!permissionGranted) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>Photo access required</Text>
        <Text style={styles.emptySub}>
          Open your device Settings and grant photo library access to Truecloud Sync.
        </Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#38bdf8" />
        <Text style={styles.loadingText}>Loading gallery…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <SectionList
        sections={displaySections}
        keyExtractor={(row) =>
          // The first non-null asset id uniquely identifies the row across all
          // sections. Padding cells are always at the end.
          row.find((a) => a)?.id ?? `empty-${Math.random()}`
        }
        renderSectionHeader={({ section }) => (
          <SectionHeader title={section.title} assetIds={section.assetIds} />
        )}
        renderItem={({ item: row }) => (
          <View style={styles.row}>
            {row.map((asset, idx) => (
              <ThumbnailCell
                key={asset?.id ?? `empty-${idx}`}
                asset={asset}
                status={asset ? getStatus(asset) : null}
                selected={asset ? selectedIds.has(asset.id) : false}
                onPress={asset ? () => dispatch(toggleSelect(asset.id)) : undefined}
              />
            ))}
          </View>
        )}
        contentContainerStyle={styles.list}
        stickySectionHeadersEnabled
        // Virtual-scroller tuning: render 2 screens above/below instead of default 10
        windowSize={5}
        initialNumToRender={15}
        maxToRenderPerBatch={9}
        updateCellsBatchingPeriod={50}
        removeClippedSubviews
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={styles.emptyTitle}>
              {hideSynced ? 'Everything is synced' : 'No photos found'}
            </Text>
            {hideSynced ? (
              <Text style={styles.emptySub}>
                Turn off "Hide already-synced" in Settings to see them.
              </Text>
            ) : null}
          </View>
        }
      />

      {/* Floating sync/cancel bar */}
      {(selectedIds.size > 0 || syncing) && (
        <View style={[styles.syncBar, { paddingBottom: insets.bottom + 8 }]}>
          {syncing ? (
            <>
              <Text style={styles.syncBarText}>Syncing…</Text>
              <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity style={styles.syncButton} onPress={handleSync}>
              <Text style={styles.syncButtonText}>
                Sync {selectedIds.size} selected
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
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
  list: {
    paddingBottom: 100,
  },
  row: {
    flexDirection: 'row',
    paddingHorizontal: 1,
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
  loadingText: {
    color: '#94a3b8',
    fontSize: 14,
    marginTop: 12,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 15,
    textAlign: 'center',
  },
  syncBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#0f172a',
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 12,
  },
  syncButton: {
    flex: 1,
    backgroundColor: '#38bdf8',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  syncButtonText: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '700',
  },
  cancelButton: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cancelText: {
    color: '#94a3b8',
    fontSize: 15,
    fontWeight: '600',
  },
  syncBarText: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '600',
  },
});
