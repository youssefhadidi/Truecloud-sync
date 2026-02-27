import { useQuery } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axiosClient from '../services/axiosClient';

/**
 * Fetches the list of files in the configured sync folder on the server.
 * Returns a Set<string> of filenames.
 */
export function useServerFiles() {
  return useQuery({
    queryKey: ['serverFiles'],
    queryFn: async () => {
      const syncPath = (await AsyncStorage.getItem('syncPath')) || 'sync';
      const email = await AsyncStorage.getItem('userEmail');

      // Don't fetch if not authenticated
      if (!email) return new Set();

      const res = await axiosClient.get(`/api/files?path=${syncPath}`);
      const files = res.data?.files || [];
      return new Set(files.map((f) => f.name));
    },
    staleTime: 60 * 1000, // 1 minute
    retry: 1,
    // Return empty Set on error so the app still works offline
    placeholderData: new Set(),
  });
}
