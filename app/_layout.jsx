import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Provider, useDispatch } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { ShareIntentProvider, useShareIntentContext } from 'expo-share-intent';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { store, persistor } from '../store';
import { clearAuth } from '../store/authSlice';
import { authEvents } from '../services/axiosClient';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function ShareIntentNavigator() {
  const router = useRouter();
  const { hasShareIntent } = useShareIntentContext();

  useEffect(() => {
    if (hasShareIntent) {
      router.replace('/share-intent');
    }
  }, [hasShareIntent]);

  return null;
}

// Listens for 401/403 responses from any axios call. When the session
// expires we drop the local auth state and kick the user back to /login,
// instead of letting the gallery silently render an empty state.
function AuthExpiredHandler() {
  const router = useRouter();
  const dispatch = useDispatch();

  useEffect(() => {
    return authEvents.on('auth:expired', () => {
      // Guard against multiple concurrent 401s — once we've logged out,
      // ignore the rest until the user signs back in.
      if (!store.getState().auth.userEmail) return;
      dispatch(clearAuth());
      queryClient.clear();
      router.replace('/login');
    });
  }, [router, dispatch]);

  return null;
}

export default function RootLayout() {
  return (
    <Provider store={store}>
      <PersistGate
        loading={
          <View style={{ flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#38bdf8" />
          </View>
        }
        persistor={persistor}
      >
        <ShareIntentProvider>
          <QueryClientProvider client={queryClient}>
            <StatusBar style="light" />
            <ShareIntentNavigator />
            <AuthExpiredHandler />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="folder-picker" options={{ presentation: 'modal' }} />
            </Stack>
          </QueryClientProvider>
        </ShareIntentProvider>
      </PersistGate>
    </Provider>
  );
}
