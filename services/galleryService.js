import * as MediaLibrary from 'expo-media-library';

/**
 * Request photo library permission.
 * Returns true if granted.
 */
export async function requestPermission() {
  const { status } = await MediaLibrary.requestPermissionsAsync();
  return status === 'granted';
}

/**
 * Fetch all media assets (photos + videos) from the device gallery.
 * Returns a flat array of MediaLibrary.Asset objects, newest first.
 */
export async function getAllAssets() {
  const assets = [];
  let hasNextPage = true;
  let endCursor;

  while (hasNextPage) {
    const result = await MediaLibrary.getAssetsAsync({
      first: 100,
      after: endCursor,
      mediaType: [MediaLibrary.MediaType.photo, MediaLibrary.MediaType.video],
      sortBy: [[MediaLibrary.SortBy.creationTime, false]],
    });

    assets.push(...result.assets);
    hasNextPage = result.hasNextPage;
    endCursor = result.endCursor;
  }

  return assets;
}

/**
 * Get the full local URI for an asset (needed for upload).
 * Uses getAssetInfoAsync to resolve localUri on iOS.
 */
export async function getAssetUri(assetId) {
  const info = await MediaLibrary.getAssetInfoAsync(assetId);
  return info.localUri || info.uri;
}
