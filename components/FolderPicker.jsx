import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axiosClient from '../services/axiosClient';

/**
 * FolderPicker — navigates server directories and lets the user select a folder.
 *
 * Props:
 *   initialPath  — starting path (default: '')
 *   onSelect     — called with the chosen path string
 *   onCancel     — called when user cancels
 */
export default function FolderPicker({ initialPath = '', onSelect, onCancel }) {
  const [currentPath, setCurrentPath] = useState(initialPath);
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [creating, setCreating] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const fetchFolders = useCallback(async (path) => {
    setLoading(true);
    setError(null);
    try {
      const res = await axiosClient.get(`/api/files?path=${encodeURIComponent(path)}`);
      const dirs = (res.data?.files || [])
        .filter((f) => f.isDirectory)
        .sort((a, b) => a.name.localeCompare(b.name));
      setFolders(dirs);
    } catch (err) {
      setError(err.response?.status === 404 ? 'Folder not found' : 'Could not load folders');
      setFolders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFolders(currentPath);
  }, [currentPath, fetchFolders]);

  const navigateInto = (folderName) => {
    setCurrentPath(currentPath ? `${currentPath}/${folderName}` : folderName);
  };

  const navigateUp = () => {
    const parts = currentPath.split('/').filter(Boolean);
    parts.pop();
    setCurrentPath(parts.join('/'));
  };

  const handleCreateFolder = async () => {
    const name = newFolderName.trim();
    if (!name) return;
    setCreating(true);
    try {
      await axiosClient.post('/api/files/mkdir', {
        name,
        path: currentPath || undefined,
      });
      setNewFolderName('');
      fetchFolders(currentPath);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Could not create folder');
    } finally {
      setCreating(false);
    }
  };

  const breadcrumbs = currentPath ? currentPath.split('/').filter(Boolean) : [];

  return (
    <View style={styles.container}>
      {/* Breadcrumb path */}
      <View style={styles.breadcrumbRow}>
        <TouchableOpacity
          onPress={() => setCurrentPath('')}
          style={styles.breadcrumbItem}
        >
          <Ionicons name="home-outline" size={16} color="#38bdf8" />
        </TouchableOpacity>
        {breadcrumbs.map((seg, i) => (
          <React.Fragment key={i}>
            <Ionicons name="chevron-forward" size={14} color="#475569" />
            <TouchableOpacity
              onPress={() =>
                setCurrentPath(breadcrumbs.slice(0, i + 1).join('/'))
              }
              style={styles.breadcrumbItem}
            >
              <Text
                style={[
                  styles.breadcrumbText,
                  i === breadcrumbs.length - 1 && styles.breadcrumbActive,
                ]}
                numberOfLines={1}
              >
                {seg}
              </Text>
            </TouchableOpacity>
          </React.Fragment>
        ))}
      </View>

      {/* Folder list */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#38bdf8" />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => fetchFolders(currentPath)}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={folders}
          keyExtractor={(item) => item.id || item.name}
          style={styles.list}
          ListHeaderComponent={
            currentPath ? (
              <TouchableOpacity style={styles.folderRow} onPress={navigateUp}>
                <Ionicons name="arrow-back-outline" size={20} color="#94a3b8" />
                <Text style={styles.folderBackText}>Back</Text>
              </TouchableOpacity>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No subfolders</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.folderRow}
              onPress={() => navigateInto(item.name)}
            >
              <Ionicons name="folder-outline" size={22} color="#38bdf8" />
              <Text style={styles.folderName} numberOfLines={1}>
                {item.displayName || item.name}
              </Text>
              <Ionicons name="chevron-forward" size={18} color="#475569" />
            </TouchableOpacity>
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}

      {/* New folder input */}
      <View style={styles.newFolderRow}>
        <TextInput
          style={styles.newFolderInput}
          value={newFolderName}
          onChangeText={setNewFolderName}
          placeholder="New folder name"
          placeholderTextColor="#475569"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={handleCreateFolder}
        />
        <TouchableOpacity
          style={[styles.newFolderButton, creating && { opacity: 0.5 }]}
          onPress={handleCreateFolder}
          disabled={creating || !newFolderName.trim()}
        >
          {creating ? (
            <ActivityIndicator size="small" color="#0f172a" />
          ) : (
            <Ionicons name="add" size={22} color="#0f172a" />
          )}
        </TouchableOpacity>
      </View>

      {/* Action buttons */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.selectButton}
          onPress={() => onSelect(currentPath)}
        >
          <Text style={styles.selectButtonText}>
            Select {currentPath ? `"${breadcrumbs[breadcrumbs.length - 1]}"` : 'Root'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  breadcrumbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    flexWrap: 'wrap',
    gap: 4,
  },
  breadcrumbItem: {
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  breadcrumbText: {
    color: '#94a3b8',
    fontSize: 14,
  },
  breadcrumbActive: {
    color: '#f8fafc',
    fontWeight: '600',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
  },
  retryText: {
    color: '#38bdf8',
    fontSize: 14,
    fontWeight: '600',
  },
  list: {
    flex: 1,
  },
  folderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  folderBackText: {
    color: '#94a3b8',
    fontSize: 15,
    flex: 1,
  },
  folderName: {
    color: '#f1f5f9',
    fontSize: 15,
    flex: 1,
  },
  separator: {
    height: 1,
    backgroundColor: '#1e293b',
    marginLeft: 50,
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: '#64748b',
    fontSize: 14,
  },
  newFolderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    gap: 10,
  },
  newFolderInput: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    color: '#f8fafc',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  newFolderButton: {
    backgroundColor: '#38bdf8',
    borderRadius: 8,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  cancelButtonText: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '600',
  },
  selectButton: {
    flex: 2,
    backgroundColor: '#38bdf8',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  selectButtonText: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '700',
  },
});
