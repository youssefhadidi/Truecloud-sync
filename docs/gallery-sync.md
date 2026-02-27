# Gallery Sync

## How it works

Sync is **on-demand and selection-based**. The user selects photos in the Gallery tab and taps "Sync N selected".

### Sync flow

```
1. Wi-Fi check (if wifiOnly setting is enabled)
2. GET /api/files?path={syncPath}
      → build Set<filename> of files already on server
3. For each selected asset:
      filename ∈ serverFilenames? → status = 'skipped'
      else                        → status = 'pending'
4. For each 'pending' asset:
      a. check cancelRef (user may have tapped Cancel)
      b. set status = 'syncing'
      c. getAssetUri(id)  ← resolves localUri on iOS
      d. POST /api/files/upload?path={syncPath}
            multipart/form-data, field 'file'
      e. success → status = 'synced'
         error   → status = 'failed'
5. Invalidate ['serverFiles'] React Query cache
6. Clear selection
```

## Status icons

| Status | Icon | Meaning |
|--------|------|---------|
| `pending` | 🕐 amber | Queued, not yet uploaded |
| `syncing` | ☁️ blue | Currently uploading |
| `synced` | ✅ green | Successfully on server |
| `skipped` | ⊘ gray | Already on server, skipped |
| `failed` | ✗ red | Upload error |

## Cancellation

Tapping Cancel sets `cancelRef.current.cancelled = true`. The upload loop checks this flag before each file. Files already in progress finish their current upload.

## Wi-Fi only

When enabled (default), the app checks `expo-network` for `NetworkStateType.WIFI` before starting. If not on Wi-Fi, an alert is shown and sync is aborted.

## Incremental hint

The first sync uploads all selected photos. On subsequent syncs, photos already on the server (detected by filename match) are automatically skipped with status `skipped`.
