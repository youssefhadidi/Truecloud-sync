import React from 'react';
import { View } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { updateSettings } from '../store/settingsSlice';
import { setShareTargetPath } from '../store/shareSlice';
import FolderPicker from '../components/FolderPicker';

/**
 * Modal screen for picking a server folder.
 *
 * Query params:
 *   source — "settings" | "share" (determines what happens on select)
 */
export default function FolderPickerScreen() {
  const router = useRouter();
  const dispatch = useDispatch();
  const insets = useSafeAreaInsets();
  const { source } = useLocalSearchParams();
  const syncPath = useSelector((s) => s.settings.syncPath);

  const handleSelect = (path) => {
    if (source === 'settings') {
      dispatch(updateSettings({ syncPath: path }));
    } else if (source === 'share') {
      dispatch(setShareTargetPath(path));
    }
    router.back();
  };

  const handleCancel = () => {
    router.back();
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#0f172a', paddingTop: insets.top }}>
      <FolderPicker
        initialPath={syncPath || ''}
        onSelect={handleSelect}
        onCancel={handleCancel}
      />
    </View>
  );
}
