import { useEffect, useState, useCallback } from 'react';
import { getAllAssets } from '../services/galleryService';

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

export function useGalleryAssets(permissionGranted) {
  const [sections, setSections] = useState([]);
  const [assetsMap, setAssetsMap] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!permissionGranted) return;
    setLoading(true);
    setError(null);
    try {
      const assets = await getAllAssets();
      const { sections: s, assetsMap: m } = buildSections(assets);
      setSections(s);
      setAssetsMap(m);
    } catch (e) {
      setError(e.message || 'Failed to load gallery');
    } finally {
      setLoading(false);
    }
  }, [permissionGranted]);

  useEffect(() => {
    load();
  }, [load]);

  return { sections, assetsMap, loading, error, reload: load };
}
