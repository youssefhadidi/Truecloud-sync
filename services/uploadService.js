import * as FileSystem from 'expo-file-system/legacy';
import { File, Directory, Paths } from 'expo-file-system';
import { store } from '../store';
import { authEvents } from './axiosClient';

/**
 * Streaming multipart upload that works on large files.
 *
 * Why we can't just call `FileSystem.createUploadTask(..., MULTIPART)`:
 * Expo's MULTIPART path calls `Data(contentsOf: sourceUrl)` in Swift, which
 * loads the entire file into RAM to assemble the multipart body. A 900 MB
 * video triggers iOS jetsam and the app crashes.
 *
 * Workaround: build the multipart envelope on disk in 8 MB chunks using the
 * new FileHandle API (peak memory ≈ one chunk), then upload the resulting
 * file with `BINARY_CONTENT`, which is the only mode that actually streams
 * via NSURLSession's `uploadTask(with:fromFile:)`.
 *
 * @param {object} args
 * @param {string} args.sourceUri        file:// URI of the asset to upload
 * @param {string} args.uploadUrl        full destination URL (including query)
 * @param {string} args.fieldName        multipart field name (e.g. 'file')
 * @param {string} args.filename         multipart filename to advertise
 * @param {string} args.mimeType
 * @param {number} [args.fileSize]       known size for progress fallback
 * @param {AbortSignal} args.signal
 * @param {(pct: number) => void} [args.onProgress]
 */
export async function streamMultipartUpload({
  sourceUri,
  uploadUrl,
  fieldName,
  filename,
  mimeType,
  fileSize = 0,
  signal,
  onProgress,
}) {
  if (!sourceUri || !sourceUri.startsWith('file://')) {
    throw new Error('streamMultipartUpload requires a file:// source URI');
  }

  const boundary = `----TrueCloudBoundary${Date.now()}${Math.floor(Math.random() * 1e9)}`;
  const preamble =
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="${fieldName}"; filename="${filename}"\r\n` +
    `Content-Type: ${mimeType}\r\n\r\n`;
  const trailer = `\r\n--${boundary}--\r\n`;

  const encoder = new TextEncoder();
  const preambleBytes = encoder.encode(preamble);
  const trailerBytes = encoder.encode(trailer);

  // Ensure cache/uploads exists, then create a unique temp file inside it.
  const uploadsDir = new Directory(Paths.cache, 'truecloud-uploads');
  if (!uploadsDir.exists) uploadsDir.create();
  const tempFile = new File(
    uploadsDir,
    `${Date.now()}-${Math.floor(Math.random() * 1e9)}.multipart`
  );
  if (tempFile.exists) tempFile.delete();
  tempFile.create();

  // ── Build the multipart envelope on disk ───────────────────────────────────
  const outHandle = tempFile.open();
  try {
    outHandle.writeBytes(preambleBytes);

    const srcFile = new File(sourceUri);
    const srcHandle = srcFile.open();
    try {
      const CHUNK = 8 * 1024 * 1024; // 8 MB — fits well below jetsam, few JSI round-trips
      const totalBytes = srcHandle.size ?? 0;
      let remaining = totalBytes > 0 ? totalBytes : Infinity;
      while (remaining > 0) {
        if (signal?.aborted) throw new Error('Upload cancelled');
        const want = Math.min(CHUNK, remaining);
        const chunk = srcHandle.readBytes(want);
        if (!chunk || chunk.length === 0) break;
        outHandle.writeBytes(chunk);
        remaining -= chunk.length;
      }
    } finally {
      srcHandle.close();
    }

    outHandle.writeBytes(trailerBytes);
  } finally {
    outHandle.close();
  }

  // ── Upload the prepared file as a raw binary body ──────────────────────────
  // BINARY_CONTENT is the only upload mode that actually streams; we set the
  // multipart Content-Type ourselves so the server still parses it correctly.
  let lastPct = -1;
  const task = FileSystem.createUploadTask(
    uploadUrl,
    tempFile.uri,
    {
      httpMethod: 'POST',
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
    },
    ({ totalBytesSent, totalBytesExpectedToSend }) => {
      const denom = totalBytesExpectedToSend > 0 ? totalBytesExpectedToSend : fileSize;
      if (denom <= 0 || !onProgress) return;
      const pct = Math.round((totalBytesSent / denom) * 100);
      if (pct === lastPct) return;
      lastPct = pct;
      onProgress(pct);
    }
  );

  const onAbort = () => { task.cancelAsync().catch(() => {}); };
  signal?.addEventListener('abort', onAbort);

  try {
    const result = await task.uploadAsync();
    if (!result) throw new Error('Upload cancelled');

    if (result.status === 401 || result.status === 403) {
      authEvents.emit('auth:expired');
      throw new Error(`HTTP ${result.status}`);
    }
    if (result.status >= 400) {
      throw new Error(`HTTP ${result.status}`);
    }
    return result;
  } finally {
    signal?.removeEventListener('abort', onAbort);
    try { tempFile.delete(); } catch { /* best-effort cleanup */ }
  }
}

/** Build the full upload URL from the configured backend + sync path. */
export function buildUploadUrl(syncPath) {
  const { backendUrl } = store.getState().auth;
  return `${backendUrl}/api/files/upload?path=${encodeURIComponent(syncPath)}`;
}
