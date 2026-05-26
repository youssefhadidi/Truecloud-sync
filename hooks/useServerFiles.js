import { useSelector } from 'react-redux';
import { useQuery } from '@tanstack/react-query';
import axiosClient from '../services/axiosClient';

// Reused as placeholderData so consumers that destructure `data` get a stable
// reference; a fresh `new Set()` per render would invalidate every downstream
// useMemo keyed on it (gallery `displaySections`, uploads `serverOnlyEntries`).
const EMPTY_FILENAME_SET = Object.freeze(new Set());

/**
 * Fetches the list of files in the configured sync folder on the server.
 * Returns a Set<string> of filenames.
 *
 * - Reads syncPath + userEmail from Redux (not AsyncStorage).
 * - Query is disabled when not authenticated.
 * - syncPath is included in the queryKey so a path change triggers a re-fetch.
 */
export function useServerFiles() {
  const userEmail = useSelector((state) => state.auth.userEmail);
  const syncPath = useSelector((state) => state.settings.syncPath);

  return useQuery({
    queryKey: ['serverFiles', syncPath],
    queryFn: async () => {
      const res = await axiosClient.get(`/api/files?path=${encodeURIComponent(syncPath)}`);
      const files = res.data?.files || [];
      return new Set(files.map((f) => f.name));
    },
    enabled: !!userEmail,
    staleTime: 60 * 1000, // 1 minute
    retry: 1,
    // Return empty Set on error so the app still works offline
    placeholderData: EMPTY_FILENAME_SET,
  });
}
