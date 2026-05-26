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
 * Fetch a single page of media assets (photos + videos), newest first.
 * Returns the raw MediaLibrary result: { assets, hasNextPage, endCursor, totalCount }.
 *
 * Pagination is driven by the caller (see useGalleryAssets) so the UI can
 * render the first page immediately while later pages stream in.
 */
export async function getAssetsPage({ first = 100, after } = {}) {
  return MediaLibrary.getAssetsAsync({
    first,
    after,
    mediaType: [MediaLibrary.MediaType.photo, MediaLibrary.MediaType.video],
    sortBy: [[MediaLibrary.SortBy.creationTime, false]],
  });
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
