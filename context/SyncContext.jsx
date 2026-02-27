import React, {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import * as Network from 'expo-network';
import { useQueryClient } from '@tanstack/react-query';
import axiosClient from '../services/axiosClient';
import { getAssetUri } from '../services/galleryService';

const SyncContext = createContext(null);

export function SyncProvider({ children }) {
  const queryClient = useQueryClient();

  // Set of assetIds currently selected in the gallery
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Map of assetId → status ('pending'|'syncing'|'synced'|'skipped'|'failed')
  const [syncStatus, setSyncStatus] = useState({});

  // Whether a sync is currently running
  const [syncing, setSyncing] = useState(false);

  // Cancel ref — set cancelled=true to abort mid-sync
  const cancelRef = useRef({ cancelled: false });

  // ----- Selection helpers -----

  const toggleSelect = useCallback((assetId) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(assetId)) {
        next.delete(assetId);
      } else {
        next.add(assetId);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback((assetIds) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      assetIds.forEach((id) => next.add(id));
      return next;
    });
  }, []);

  const deselectAll = useCallback((assetIds) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      assetIds.forEach((id) => next.delete(id));
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // ----- Sync -----

  const startSync = useCallback(
    async (assetsMap) => {
      // assetsMap: { [assetId]: asset } — full asset objects needed for filename + upload
      if (syncing) return;
      if (selectedIds.size === 0) {
        Alert.alert('Nothing selected', 'Tap photos to select them before syncing.');
        return;
      }

      // Wi-Fi check
      const wifiOnly = (await AsyncStorage.getItem('wifiOnly')) !== 'false';
      if (wifiOnly) {
        const net = await Network.getNetworkStateAsync();
        if (net.type !== Network.NetworkStateType.WIFI) {
          Alert.alert(
            'Wi-Fi required',
            'Connect to Wi-Fi or disable the Wi-Fi-only setting in Settings.'
          );
          return;
        }
      }

      // Get sync path
      const syncPath = (await AsyncStorage.getItem('syncPath')) || 'sync';

      // Fetch current server file list
      let serverFilenames = new Set();
      try {
        const res = await axiosClient.get(`/api/files?path=${syncPath}`);
        (res.data?.files || []).forEach((f) => serverFilenames.add(f.name));
      } catch {
        // If listing fails, proceed anyway — we'll just re-upload anything
      }

      // Build initial status map for selected assets
      const initialStatus = {};
      const toUpload = [];

      for (const assetId of selectedIds) {
        const asset = assetsMap[assetId];
        if (!asset) continue;

        if (serverFilenames.has(asset.filename)) {
          initialStatus[assetId] = 'skipped';
        } else {
          initialStatus[assetId] = 'pending';
          toUpload.push(asset);
        }
      }

      setSyncStatus((prev) => ({ ...prev, ...initialStatus }));
      setSyncing(true);
      cancelRef.current = { cancelled: false };

      // Upload loop
      for (const asset of toUpload) {
        if (cancelRef.current.cancelled) break;

        setSyncStatus((prev) => ({ ...prev, [asset.id]: 'syncing' }));

        try {
          const uri = await getAssetUri(asset.id);

          const formData = new FormData();
          formData.append('file', {
            uri,
            name: asset.filename,
            type: asset.mediaType === 'video' ? 'video/mp4' : 'image/jpeg',
          });

          await axiosClient.post(`/api/files/upload?path=${syncPath}`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
            timeout: 5 * 60 * 1000, // 5 minutes per file
          });

          setSyncStatus((prev) => ({ ...prev, [asset.id]: 'synced' }));
        } catch {
          setSyncStatus((prev) => ({ ...prev, [asset.id]: 'failed' }));
        }
      }

      setSyncing(false);
      clearSelection();

      // Refresh server file list so Upload tab + gallery badges update
      queryClient.invalidateQueries({ queryKey: ['serverFiles'] });
    },
    [syncing, selectedIds, clearSelection, queryClient]
  );

  const cancelSync = useCallback(() => {
    cancelRef.current.cancelled = true;
    setSyncing(false);
  }, []);

  return (
    <SyncContext.Provider
      value={{
        selectedIds,
        syncStatus,
        syncing,
        toggleSelect,
        selectAll,
        deselectAll,
        clearSelection,
        startSync,
        cancelSync,
      }}
    >
      {children}
    </SyncContext.Provider>
  );
}

export function useSyncContext() {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error('useSyncContext must be used within SyncProvider');
  return ctx;
}
