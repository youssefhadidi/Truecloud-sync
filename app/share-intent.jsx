import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useSelector, useDispatch } from 'react-redux';
import { useShareIntentContext } from 'expo-share-intent';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import StatusIcon from '../components/StatusIcon';
import { startShareSync } from '../store/shareThunks';
import { clearUploads } from '../store/uploadsSlice';
import { clearShareTargetPath } from '../store/shareSlice';

export default function ShareIntentScreen() {
  const router = useRouter();
  const dispatch = useDispatch();
  const insets = useSafeAreaInsets();
  const { shareIntent, resetShareIntent } = useShareIntentContext();
  const syncing = useSelector((s) => s.uploads.syncing);
  const uploadItems = useSelector((s) => s.uploads.items);
  const backendUrl = useSelector((s) => s.auth.backendUrl);
  const userEmail = useSelector((s) => s.auth.userEmail);
  const defaultSyncPath = useSelector((s) => s.settings.syncPath);
  const shareTargetPath = useSelector((s) => s.share.targetPath);
  const targetPath = shareTargetPath ?? defaultSyncPath ?? 'sync';
  const thunkRef = useRef(null);

  const files = shareIntent?.files ?? [];

  const dismiss = () => {
    dispatch(clearUploads());
    dispatch(clearShareTargetPath());
    resetShareIntent(true);
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  // If the screen unmounts mid-sync (e.g. OS kills the share extension),
  // make sure we don't leave a dangling abort target.
  useEffect(() => {
    return () => {
      thunkRef.current?.abort();
    };
  }, []);

  const handleUpload = () => {
    if (!backendUrl || !userEmail) {
      Alert.alert(
        'Not logged in',
        'Please open the app and log in before sharing files.'
      );
      return;
    }
    thunkRef.current = dispatch(startShareSync({ files, overridePath: targetPath }));
  };

  const handleDone = () => {
    dismiss();
  };

  const handleCancel = () => {
    thunkRef.current?.abort();
    dismiss();
  };

  // Check if all uploads finished
  const itemValues = Object.values(uploadItems);
  const allDone =
    itemValues.length > 0 &&
    itemValues.every((i) => i.status === 'synced' || i.status === 'failed');

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleCancel}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Share to Truecloud</Text>
        <View style={{ width: 60 }} />
      </View>

      {files.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>No files to upload</Text>
        </View>
      ) : (
        <>
          <TouchableOpacity
            style={styles.destRow}
            onPress={() => router.push('/folder-picker?source=share')}
            disabled={syncing}
          >
            <Ionicons name="folder-outline" size={18} color="#38bdf8" />
            <Text style={styles.destText} numberOfLines={1}>
              {files.length} {files.length === 1 ? 'file' : 'files'} → {targetPath || 'Root'}
            </Text>
            <Ionicons name="chevron-forward" size={16} color="#475569" />
          </TouchableOpacity>

          <FlatList
            data={files}
            keyExtractor={(item) => item.path}
            style={styles.list}
            contentContainerStyle={{ paddingBottom: 16 }}
            renderItem={({ item }) => {
              const upload = uploadItems[item.path];
              return (
                <View style={styles.row}>
                  {item.mimeType?.startsWith('image/') ||
                  item.mimeType?.startsWith('video/') ? (
                    <Image source={{ uri: item.path }} style={styles.thumb} />
                  ) : (
                    <View style={[styles.thumb, styles.thumbPlaceholder]} />
                  )}
                  <View style={styles.info}>
                    <Text style={styles.filename} numberOfLines={1}>
                      {item.fileName}
                    </Text>
                    {item.size ? (
                      <Text style={styles.size}>
                        {(item.size / 1024 / 1024).toFixed(1)} MB
                      </Text>
                    ) : null}
                    {upload?.status === 'syncing' && (
                      <View style={styles.progressTrack}>
                        <View
                          style={[
                            styles.progressFill,
                            { width: `${upload.progress}%` },
                          ]}
                        />
                      </View>
                    )}
                  </View>
                  {upload ? (
                    <StatusIcon status={upload.status} size={22} />
                  ) : null}
                </View>
              );
            }}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />

          <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
            {syncing ? (
              <View style={styles.syncingRow}>
                <ActivityIndicator color="#38bdf8" />
                <Text style={styles.syncingText}>Uploading…</Text>
              </View>
            ) : allDone ? (
              <TouchableOpacity style={styles.button} onPress={handleDone}>
                <Text style={styles.buttonText}>Done</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.button} onPress={handleUpload}>
                <Text style={styles.buttonText}>
                  Upload {files.length} {files.length === 1 ? 'file' : 'files'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  cancelText: {
    color: '#38bdf8',
    fontSize: 16,
    width: 60,
  },
  title: {
    color: '#f8fafc',
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  destRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    gap: 8,
  },
  destText: {
    flex: 1,
    color: '#94a3b8',
    fontSize: 14,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 16,
  },
  list: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  thumb: {
    width: 52,
    height: 52,
    borderRadius: 6,
    backgroundColor: '#1e293b',
    marginRight: 12,
  },
  thumbPlaceholder: {
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
  size: {
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
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
  },
  button: {
    backgroundColor: '#38bdf8',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonText: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '700',
  },
  syncingRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 10,
  },
  syncingText: {
    color: '#38bdf8',
    fontSize: 16,
    fontWeight: '600',
  },
});
