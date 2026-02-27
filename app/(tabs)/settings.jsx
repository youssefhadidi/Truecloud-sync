import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Switch,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { setAuth, setBackendUrl, clearAuth } from '../../store/authSlice';
import { updateSettings } from '../../store/settingsSlice';
import { clearUploads } from '../../store/uploadsSlice';
import { clearSelection } from '../../store/gallerySlice';
import { login, logout } from '../../services/authService';

export default function SettingsScreen() {
  const dispatch = useDispatch();
  const queryClient = useQueryClient();
  const router = useRouter();

  // ── Redux state ────────────────────────────────────────────────────────────
  const backendUrlStored = useSelector((state) => state.auth.backendUrl);
  const userEmail = useSelector((state) => state.auth.userEmail);
  const { syncPath: syncPathStored, wifiOnly: wifiOnlyStored, maxParallelUploads: maxParallelStored } =
    useSelector((state) => state.settings);

  // ── Local editable state (committed to Redux on Save) ─────────────────────
  const [backendUrl, setBackendUrlLocal] = useState(backendUrlStored || '');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [syncPath, setSyncPath] = useState(syncPathStored || 'sync');
  const [wifiOnly, setWifiOnly] = useState(wifiOnlyStored ?? true);
  const [maxParallel, setMaxParallel] = useState(String(maxParallelStored ?? 5));
  const [connecting, setConnecting] = useState(false);

  // ── Connect (re-login from settings if session expired) ───────────────────
  const handleConnect = useCallback(async () => {
    if (!backendUrl.trim()) {
      Alert.alert('Missing URL', 'Please enter the backend URL first.');
      return;
    }
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing credentials', 'Enter your email and password.');
      return;
    }
    setConnecting(true);
    try {
      const result = await login(backendUrl.trim(), email.trim(), password);
      dispatch(setAuth(result));
      setPassword('');
      Alert.alert('Connected', `Signed in as ${result.userEmail}`);
    } catch (err) {
      Alert.alert('Login failed', err.message || 'Could not connect to the server.');
    } finally {
      setConnecting(false);
    }
  }, [backendUrl, email, password, dispatch]);

  // ── Disconnect ─────────────────────────────────────────────────────────────
  const handleDisconnect = useCallback(() => {
    Alert.alert('Disconnect', 'Sign out of Truecloud Sync?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disconnect',
        style: 'destructive',
        onPress: async () => {
          await logout(backendUrlStored);
          dispatch(clearAuth());
          dispatch(clearUploads());
          dispatch(clearSelection());
          queryClient.clear();
          router.replace('/login');
        },
      },
    ]);
  }, [backendUrlStored, dispatch, queryClient, router]);

  // ── Save settings ──────────────────────────────────────────────────────────
  const handleSave = useCallback(() => {
    const parsedMax = parseInt(maxParallel, 10);
    dispatch(setBackendUrl(backendUrl.trim()));
    dispatch(
      updateSettings({
        syncPath: syncPath.trim() || 'sync',
        wifiOnly,
        maxParallelUploads: Number.isFinite(parsedMax) && parsedMax > 0 ? parsedMax : 5,
      })
    );
    queryClient.invalidateQueries({ queryKey: ['serverFiles'] });
    Alert.alert('Saved', 'Settings saved.');
  }, [backendUrl, syncPath, wifiOnly, maxParallel, dispatch, queryClient]);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Backend URL ── */}
        <Text style={styles.sectionLabel}>BACKEND</Text>

        <Text style={styles.fieldLabel}>Server URL</Text>
        <TextInput
          style={styles.input}
          value={backendUrl}
          onChangeText={setBackendUrlLocal}
          placeholder="https://cloud.yourdomain.com"
          placeholderTextColor="#475569"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          editable={!userEmail}
        />

        {/* ── Auth ── */}
        {backendUrl.trim().length > 0 && (
          <>
            <Text style={styles.sectionLabel}>ACCOUNT</Text>

            {userEmail ? (
              <View style={styles.connectedRow}>
                <View>
                  <Text style={styles.connectedLabel}>Connected as</Text>
                  <Text style={styles.connectedEmail}>{userEmail}</Text>
                </View>
                <TouchableOpacity style={styles.disconnectButton} onPress={handleDisconnect}>
                  <Text style={styles.disconnectText}>Disconnect</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <Text style={styles.fieldLabel}>Email</Text>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  placeholderTextColor="#475569"
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                />

                <Text style={styles.fieldLabel}>Password</Text>
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  placeholderTextColor="#475569"
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                />

                <TouchableOpacity
                  style={[styles.primaryButton, connecting && styles.buttonDisabled]}
                  onPress={handleConnect}
                  disabled={connecting}
                >
                  {connecting ? (
                    <ActivityIndicator color="#0f172a" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Connect</Text>
                  )}
                </TouchableOpacity>
              </>
            )}
          </>
        )}

        {/* ── Sync settings ── */}
        <Text style={styles.sectionLabel}>SYNC</Text>

        <Text style={styles.fieldLabel}>Sync folder (on server)</Text>
        <TextInput
          style={styles.input}
          value={syncPath}
          onChangeText={setSyncPath}
          placeholder="sync"
          placeholderTextColor="#475569"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Text style={styles.fieldLabel}>Parallel uploads (max)</Text>
        <TextInput
          style={styles.input}
          value={maxParallel}
          onChangeText={setMaxParallel}
          placeholder="5"
          placeholderTextColor="#475569"
          keyboardType="numeric"
          returnKeyType="done"
        />

        <View style={styles.switchRow}>
          <View>
            <Text style={styles.switchLabel}>Wi-Fi only</Text>
            <Text style={styles.switchSub}>Prevent uploads on mobile data</Text>
          </View>
          <Switch
            value={wifiOnly}
            onValueChange={setWifiOnly}
            trackColor={{ false: '#1e293b', true: '#38bdf8' }}
            thumbColor="#f8fafc"
          />
        </View>

        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Text style={styles.saveButtonText}>Save Settings</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  content: {
    padding: 20,
    paddingBottom: 48,
  },
  sectionLabel: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
    marginTop: 28,
    marginBottom: 10,
  },
  fieldLabel: {
    color: '#94a3b8',
    fontSize: 13,
    marginBottom: 6,
    marginTop: 14,
  },
  input: {
    backgroundColor: '#1e293b',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    color: '#f8fafc',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  connectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#22c55e40',
  },
  connectedLabel: {
    color: '#94a3b8',
    fontSize: 12,
  },
  connectedEmail: {
    color: '#22c55e',
    fontSize: 15,
    fontWeight: '600',
    marginTop: 2,
  },
  disconnectButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ef444440',
  },
  disconnectText: {
    color: '#ef4444',
    fontSize: 13,
    fontWeight: '600',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    marginTop: 10,
  },
  switchLabel: {
    color: '#f1f5f9',
    fontSize: 15,
  },
  switchSub: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 2,
  },
  primaryButton: {
    backgroundColor: '#38bdf8',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '700',
  },
  saveButton: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 28,
  },
  saveButtonText: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '600',
  },
});
