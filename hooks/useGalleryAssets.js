import { useQuery } from '@tanstack/react-query';
import { getAllAssets, getPermissionStatus } from '../services/galleryService';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const COLS = 3;

/**
 * Groups an array of assets by YYYY-MM and chunks each group into rows of COLS.
 * Returns { sections, assetsMap }.
 *   sections  → array ready for SectionList
 *   assetsMap → { [assetId]: asset } for fast lookup
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

  // Sort sections newest-first
  const sortedKeys = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  const sections = sortedKeys.map((key) => {
    const group = grouped[key];
    const rows = [];

    for (let i = 0; i < group.assets.length; i += COLS) {
      const row = group.assets.slice(i, i + COLS);
      // Pad last row with nulls for even grid
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
 * Backed by React Query so both the Gallery and Uploads tabs share a single
 * in-memory copy. Permission is checked without prompting — call
 * `requestPermission()` from galleryService elsewhere (e.g. the Gallery tab on
 * first mount) and invalidate the `['galleryAssets']` query when it's granted.
 */
export function useGalleryAssets(enabled = true) {
  const query = useQuery({
    queryKey: ['galleryAssets'],
    queryFn: async () => {
      const granted = await getPermissionStatus();
      if (!granted) return EMPTY;
      const assets = await getAllAssets();
      return buildSections(assets);
    },
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: false,
  });

  return {
    sections: query.data?.sections ?? EMPTY.sections,
    assetsMap: query.data?.assetsMap ?? EMPTY.assetsMap,
    loading: query.isLoading,
    error: query.error ? (query.error.message || 'Failed to load gallery') : null,
    reload: query.refetch,
  };
}
