import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useDispatch } from 'react-redux';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import axiosClient, { authEvents } from '../services/axiosClient';
import { clearAuth } from '../store/authSlice';

/**
 * Listens for `session:locked` axios events and prompts the user for their
 * 4-digit session-lock PIN. POSTs to /api/account/verify-pin; on success the
 * interceptor retries the original request that triggered the prompt.
 *
 * Sign Out rejects the gate — the original request fails — and clears auth
 * the same way AuthExpiredHandler does.
 */
export default function SessionLockModal() {
  const [visible, setVisible] = useState(false);
  const [pin, setPin] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState(null);
  const [retryAfter, setRetryAfter] = useState(0);
  const resolverRef = useRef(null);
  const dispatch = useDispatch();
  const router = useRouter();
  const queryClient = useQueryClient();

  useEffect(() => {
    return authEvents.on('session:locked', ({ resolve, reject }) => {
      resolverRef.current = { resolve, reject };
      setPin('');
      setError(null);
      setRetryAfter(0);
      setVisible(true);
    });
  }, []);

  // If the session is fully expired (401/403 elsewhere), AuthExpiredHandler
  // routes to /login — dismiss this modal too so it doesn't float over it.
  useEffect(() => {
    return authEvents.on('auth:expired', () => {
      if (!resolverRef.current) return;
      const r = resolverRef.current;
      resolverRef.current = null;
      setVisible(false);
      r.reject(new Error('Auth expired while session was locked'));
    });
  }, []);

  // Countdown the rate-limit retryAfter (server returned 429 with seconds).
  useEffect(() => {
    if (retryAfter <= 0) return;
    const t = setInterval(() => {
      setRetryAfter((s) => (s > 1 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(t);
  }, [retryAfter]);

  const handleUnlock = async () => {
    if (pin.length !== 4 || verifying || retryAfter > 0) return;
    setVerifying(true);
    setError(null);
    try {
      const res = await axiosClient.post('/api/account/verify-pin', { pin });
      if (res.data?.success) {
        const r = resolverRef.current;
        resolverRef.current = null;
        setVisible(false);
        // Invalidate everything — the session lock probably caused stale
        // empty results in cached queries.
        queryClient.invalidateQueries();
        r?.resolve();
      } else {
        setError('Incorrect PIN');
        setPin('');
      }
    } catch (err) {
      const status = err.response?.status;
      const data = err.response?.data;
      if (status === 429 && data?.retryAfter) {
        setRetryAfter(data.retryAfter);
        setError('Too many attempts');
      } else {
        setError(data?.error || 'Verification failed');
      }
      setPin('');
    } finally {
      setVerifying(false);
    }
  };

  const handleSignOut = () => {
    const r = resolverRef.current;
    resolverRef.current = null;
    setVisible(false);
    dispatch(clearAuth());
    queryClient.clear();
    router.replace('/login');
    r?.reject(new Error('User signed out from locked session'));
  };

  const unlockDisabled = pin.length !== 4 || verifying || retryAfter > 0;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => {}}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}
      >
        <View style={styles.card}>
          <Text style={styles.title}>Session locked</Text>
          <Text style={styles.subtitle}>Enter your 4-digit PIN to continue.</Text>

          <TextInput
            style={styles.pinInput}
            value={pin}
            onChangeText={(v) => setPin(v.replace(/\D/g, '').slice(0, 4))}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={4}
            autoFocus
            editable={!verifying && retryAfter === 0}
            placeholder="••••"
            placeholderTextColor="#475569"
            onSubmitEditing={handleUnlock}
            returnKeyType="done"
          />

          {error ? (
            <Text style={styles.error}>
              {error}
              {retryAfter > 0 ? ` — try again in ${retryAfter}s` : ''}
            </Text>
          ) : null}

          <TouchableOpacity
            style={[styles.unlockButton, unlockDisabled && styles.disabled]}
            onPress={handleUnlock}
            disabled={unlockDisabled}
          >
            {verifying ? (
              <ActivityIndicator color="#0f172a" />
            ) : (
              <Text style={styles.unlockText}>Unlock</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
            <Text style={styles.signOutText}>Sign out instead</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 14,
  },
  title: {
    color: '#f8fafc',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: 14,
    textAlign: 'center',
  },
  pinInput: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    color: '#f8fafc',
    fontSize: 28,
    letterSpacing: 12,
    textAlign: 'center',
    paddingVertical: 14,
    marginTop: 4,
  },
  error: {
    color: '#ef4444',
    fontSize: 13,
    textAlign: 'center',
  },
  unlockButton: {
    backgroundColor: '#38bdf8',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  disabled: {
    opacity: 0.4,
  },
  unlockText: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '700',
  },
  signOutButton: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  signOutText: {
    color: '#94a3b8',
    fontSize: 14,
  },
});
