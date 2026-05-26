import * as FileSystem from 'expo-file-system/legacy';
import { store } from '../store';
import { authEvents } from './axiosClient';

/**
 * Streams a file directly from disk to the Truecloud raw-upload endpoint.
 *
 * Uses expo-file-system's BINARY_CONTENT mode, which is the only upload path
 * that doesn't buffer the body in RAM — it hands the source file URL straight
 * to NSURLSession.uploadTask(with:fromFile:) on iOS / OkHttp file body on
 * Android. Memory stays flat regardless of file size.
 *
 * The server endpoint is the raw-body branch of POST /api/files/upload:
 *   ?path=<dir>&filename=<name>
 *   Content-Type: <file mime type>   (anything other than multipart/form-data)
 *   body: raw bytes
 *
 * @param {object} args
 * @param {string} args.sourceUri     file:// URI of the asset to upload
 * @param {string} args.syncPath      destination folder on the server
 * @param {string} args.filename      filename on the server (dedupe key)
 * @param {string} args.mimeType
 * @param {number} [args.fileSize]    known size for progress fallback
 * @param {AbortSignal} args.signal
 * @param {(pct: number) => void} [args.onProgress]
 */
export async function uploadFile({
  sourceUri,
  syncPath,
  filename,
  mimeType,
  fileSize = 0,
  signal,
  onProgress,
}) {
  if (!sourceUri || !sourceUri.startsWith('file://')) {
    throw new Error('uploadFile requires a file:// source URI');
  }

  const { backendUrl } = store.getState().auth;
  const url =
    `${backendUrl}/api/files/upload` +
    `?path=${encodeURIComponent(syncPath)}` +
    `&filename=${encodeURIComponent(filename)}`;

  let lastPct = -1;
  const task = FileSystem.createUploadTask(
    url,
    sourceUri,
    {
      httpMethod: 'POST',
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      // FOREGROUND keeps the upload in-process. The default BACKGROUND mode
      // hands the request to nsurlsessiond (a separate system daemon), which
      // can't read PhotoKit-managed files — NSURLSession fails with
      // NSURLErrorDomain Code=-1 (Unknown) the moment it tries.
      sessionType: FileSystem.FileSystemSessionType.FOREGROUND,
      headers: { 'Content-Type': mimeType || 'application/octet-stream' },
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

  let result;
  try {
    result = await task.uploadAsync();
  } finally {
    signal?.removeEventListener('abort', onAbort);
  }

  if (!result) throw new Error('Upload cancelled');

  if (result.status === 401 || result.status === 403) {
    authEvents.emit('auth:expired');
    throw new Error(`HTTP ${result.status}`);
  }
  if (result.status >= 400) {
    const snippet = (result.body || '').slice(0, 200);
    throw new Error(`HTTP ${result.status}${snippet ? ` — ${snippet}` : ''}`);
  }

  return result;
}
