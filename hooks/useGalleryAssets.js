import { useEffect, useMemo } from 'react';
import { AppState } from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { getAssetsPage, getPermissionStatus } from '../services/galleryService';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const COLS = 3;
const PAGE_SIZE = 100;

/**
 * Groups an array of assets by YYYY-MM and chunks each group into rows of COLS.
 * Returns { sections, assetsMap }.
 */
function buildSections(assets) {
  const grouped = {};
  const assetsMap = {};

  for (const asset of assets) {
    assetsMap[asset.id] = asset;

    const date = new Date(asset.creationTime);
    const year = date.getFullYear();
    const month = date.getMonth(); // 0-based
    const key = `${year}-${String(month + 1).padStart(2, '0')}`;

    if (!grouped[key]) {
      grouped[key] = {
        title: `${MONTHS[month]} ${year}`,
        key,
        assets: [],
        assetIds: [],
      };
    }

    grouped[key].assets.push(asset);
    grouped[key].assetIds.push(asset.id);
  }

  const sortedKeys = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  const sections = sortedKeys.map((key) => {
    const group = grouped[key];
    const rows = [];

    for (let i = 0; i < group.assets.length; i += COLS) {
      const row = group.assets.slice(i, i + COLS);
      while (row.length < COLS) row.push(null);
      rows.push(row);
    }

    return {
      title: group.title,
      key: group.key,
      assetIds: group.assetIds,
      data: rows,
    };
  });

  return { sections, assetsMap };
}

const EMPTY = { sections: [], assetsMap: {} };

/**
 * Loads the device gallery and groups it by year/month.
 *
 * Streams pages via useInfiniteQuery: the first PAGE_SIZE assets render almost
 * immediately, then a background effect calls fetchNextPage until the whole
 * library is loaded. `loading` only stays true while no page has landed yet —
 * once the first page is in, the screen is interactive while older months
 * continue to stream in below.
 *
 * Backed by React Query so both Gallery and Uploads tabs share one cache.
 * Permission is checked without prompting — call requestPermission()
 * elsewhere (Gallery tab on first mount) and invalidate ['galleryAssets']
 * when it's granted.
 */
export function useGalleryAssets(enabled = true) {
  const queryClient = useQueryClient();

  const query = useInfiniteQuery({
    queryKey: ['galleryAssets'],
    queryFn: async ({ pageParam }) => {
      const granted = await getPermissionStatus();
      if (!granted) return { assets: [], hasNextPage: false, endCursor: null };
      return getAssetsPage({ first: PAGE_SIZE, after: pageParam });
    },
    initialPageParam: undefined,
    getNextPageParam: (lastPage) =>
      lastPage.hasNextPage ? lastPage.endCursor : undefined,
    enabled,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query;

  // Auto-paginate: once a page lands, kick off the next one until done.
  // Effect re-fires when isFetchingNextPage flips back to false, so each
  // page chains naturally without a manual loop.
  useEffect(() => {
    if (!enabled) return;
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [enabled, hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Flatten pages → buildSections. Re-runs only when a new page lands.
  const { sections, assetsMap } = useMemo(() => {
    if (!query.data) return EMPTY;
    const assets = query.data.pages.flatMap((p) => p.assets);
    if (assets.length === 0) return EMPTY;
    return buildSections(assets);
  }, [query.data]);

  // Keep the gallery cache in sync with the device library. MediaLibrary fires
  // on additions/deletions/edits; AppState covers changes that happened while
  // backgrounded. Debounced so a bulk import doesn't trigger a refetch per photo.
  useEffect(() => {
    if (!enabled) return;

    let timer;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['galleryAssets'] });
      }, 500);
    };

    const mediaSub = MediaLibrary.addListener(refresh);
    const appSub = AppState.addEventListener('change', (s) => {
      if (s === 'active') refresh();
    });

    return () => {
      clearTimeout(timer);
      mediaSub.remove();
      appSub.remove();
    };
  }, [enabled, queryClient]);

  return {
    sections,
    assetsMap,
    // Only "loading" while the first page is still in flight — after that the
    // gallery is interactive even while older months continue streaming in.
    loading: query.isLoading,
    error: query.error ? (query.error.message || 'Failed to load gallery') : null,
    reload: query.refetch,
  };
}
