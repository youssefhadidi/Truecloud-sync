import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { setBackendUrl } from '../store/authSlice';

export default function SetupScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch();
  const storedUrl = useSelector((state) => state.auth.backendUrl);
  const [url, setUrl] = useState(storedUrl || '');

  const handleContinue = () => {
    const trimmed = url.trim().replace(/\/$/, '');
    if (!trimmed) return;
    dispatch(setBackendUrl(trimmed));
    router.replace('/login');
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.container, { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.header}>
          <Text style={styles.title}>Truecloud Sync</Text>
          <Text style={styles.subtitle}>Enter your server address to get started</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Server URL</Text>
          <TextInput
            style={styles.input}
            value={url}
            onChangeText={setUrl}
            placeholder="https://cloud.yourdomain.com"
            placeholderTextColor="#475569"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            returnKeyType="done"
            onSubmitEditing={handleContinue}
          />

          <TouchableOpacity
            style={[styles.button, !url.trim() && styles.buttonDisabled]}
            onPress={handleContinue}
            disabled={!url.trim()}
          >
            <Text style={styles.buttonText}>Continue</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    paddingHorizontal: 28,
  },
  header: {
    marginBottom: 48,
  },
  title: {
    color: '#f8fafc',
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 8,
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: 15,
    lineHeight: 22,
  },
  form: {
    gap: 8,
  },
  label: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    color: '#f8fafc',
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#38bdf8',
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonText: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '700',
  },
});
