import * as MediaLibrary from 'expo-media-library';

/**
 * Request photo library permission (prompts the user if undetermined).
 * Returns true if granted.
 */
export async function requestPermission() {
  const { status } = await MediaLibrary.requestPermissionsAsync();
  return status === 'granted';
}

/**
 * Read current permission status without prompting.
 */
export async function getPermissionStatus() {
  const { status } = await MediaLibrary.getPermissionsAsync();
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
 * Get the local URI and file size for an asset (needed for upload).
 * Uses getAssetInfoAsync to resolve localUri on iOS.
 * Returns { uri, fileSize } — fileSize may be 0 if MediaLibrary doesn't report it.
 */
export async function getAssetInfo(assetId) {
  const info = await MediaLibrary.getAssetInfoAsync(assetId);
  return {
    uri: info.localUri || info.uri,
    fileSize: info.fileSize ?? 0,
  };
}
