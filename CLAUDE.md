# Truecloud Sync

Expo React Native app (iOS + Android) that syncs device photos / videos one-way to a self-hosted [Truecloud](../Truecloud) backend. Selection-driven (no automatic background sync). JavaScript only — no TypeScript.

## Stack

- **Expo SDK 54**, Expo Router 6, React Native 0.81 (new architecture enabled)
- **State**: Redux Toolkit + redux-persist (AsyncStorage). `auth` + `settings` are persisted; `uploads`, `gallery`, `share` are session-only
- **Server data**: TanStack React Query (`useServerFiles`, `useGalleryAssets`)
- **HTTP**: axios, forced to its browser bundle in [metro.config.js](metro.config.js) — relies on RN's native cookie jar (NSURLSession / CookieManager) for the NextAuth session cookie
- **Media**: `expo-media-library`, `expo-image`
- **Share-target**: `expo-share-intent`

## Auth (NextAuth credentials flow)

1. `GET /api/auth/csrf` → `{ csrfToken }`
2. `POST /api/auth/callback/credentials` form-encoded (csrfToken, email, password, callbackUrl) — NextAuth replies 302; in RN the redirect-follow often raises a "Network Error" *after* the session cookie has been stored in the native jar. [authService.js](services/authService.js) treats that error as non-fatal and proceeds to step 3.
3. `GET /api/auth/session` → verify `data.user.email`

Cookies are managed entirely by the platform (no manual `Cookie` header). Logout calls `/api/auth/signout` server-side but does **not** clear the native cookie jar. 401/403 responses fire the `authEvents.emit('auth:expired')` event, which the [AuthExpiredHandler](app/_layout.jsx) at the root listens for — it clears local auth + the React Query cache and bounces to `/login`.

## Backend endpoints used

| Verb | Path | Purpose |
|------|------|---------|
| GET  | `/api/files?path={p}`           | List files in a folder (used for "already uploaded" detection + folder picker) |
| POST | `/api/files/upload?path={p}`    | Multipart upload, field name `file` |
| POST | `/api/files/mkdir`              | `{ name, path }` — create folder from picker |
| GET  | `/api/auth/csrf` / `/session`   | NextAuth flow |
| POST | `/api/auth/callback/credentials` / `/signout` | NextAuth flow |

All `?path=` values are URL-encoded at the call site ([syncThunks.js](store/syncThunks.js), [shareThunks.js](store/shareThunks.js), [useServerFiles.js](hooks/useServerFiles.js), [FolderPicker.jsx](components/FolderPicker.jsx)). The empty string represents the root folder — never send `/` literally.

## Routes

```
app/_layout.jsx          Provider stack: Redux → PersistGate → ShareIntent → QueryClient.
                         Mounts <ShareIntentNavigator/> (redirects to /share-intent
                         on inbound share) and <AuthExpiredHandler/> (catches 401/403).
app/index.jsx            Redirects: no backendUrl → /setup, no userEmail → /login,
                         else → /(tabs)/gallery
app/setup.jsx            Backend URL entry
app/login.jsx            Email + password
app/folder-picker.jsx    Modal — source=settings dispatches updateSettings;
                         source=share dispatches setShareTargetPath
app/share-intent.jsx     Standalone screen for OS share-target uploads
app/(tabs)/gallery.jsx   SectionList grouped by year/month, multi-select, sync bar,
                         optional "Hide already-synced" filter
app/(tabs)/uploads.jsx   Per-file status list (session entries + server-synced)
app/(tabs)/settings.jsx  URL / login / sync path / wifi-only / hide-synced / parallel count
```

## State

- `store/authSlice.js`      — `{ backendUrl, userEmail }` (persisted)
- `store/settingsSlice.js`  — `{ syncPath, wifiOnly, maxParallelUploads, hideSynced }` (persisted)
- `store/uploadsSlice.js`   — `{ items: { [assetId]: { status, progress, ... } }, syncing }` (session)
- `store/gallerySlice.js`   — `{ selectedIds: string[] }` (session) + `selectSelectedIdsSet` memoized selector
- `store/shareSlice.js`     — `{ targetPath: string | null }` (session) — folder-picker → share-intent handoff
- `store/syncThunks.js`     — `startSync({ assetsMap })` — gallery upload pool
- `store/shareThunks.js`    — `startShareSync({ files, overridePath })` — share-intent uploads

Both thunks support cancellation via `dispatch(thunk).abort()` — the AbortSignal is forwarded to axios.

## Sync flow (gallery)

1. Wi-Fi check (`expo-network`) if `wifiOnly` is on
2. `GET /api/files?path={encoded syncPath}` → build `Set<filename>` of already-uploaded names
3. For each selected asset, mark `skipped` if its `filename` is in that set, otherwise `pending`
4. Run `runPool(tasks, maxParallelUploads)` — bounded-concurrency pool
5. Each task: `getAssetInfo(id)` → `localUri` + `fileSize`, then multipart POST with `onUploadProgress`
6. On completion, dispatch `purgeFinishedUploads()` (drops `synced`/`skipped`, keeps `failed` visible) + `clearSelection()`; the gallery effect invalidates the `serverFiles` query

## Sync flow (share-intent)

1. Inbound share fires `ShareIntentNavigator` → `/share-intent`
2. User confirms target folder (default = `settings.syncPath`, overridable through the folder picker which writes to `share.targetPath`)
3. `startShareSync` runs files sequentially (smaller batches than gallery)
4. Items stay in `uploads.items` until the user taps Done or Cancel — `dismiss()` clears uploads + share slice + share-intent state

## Conventions

- Dark theme baked in. Palette: `#0f172a` (bg), `#1e293b` (surface), `#38bdf8` (accent), `#22c55e` / `#ef4444` / `#f59e0b` (status).
- Filenames are the dedupe key on the server — there is no content hashing.
- Always wrap `syncPath` (and any user-controlled path) in `encodeURIComponent` before interpolating into a URL.
- Root folder is represented by the empty string `''` — never `/`.
- `axiosClient` baseURL is injected from Redux at request time — never hardcode URLs in calls.
- `useGalleryAssets` is backed by React Query with key `['galleryAssets']` — both Gallery and Uploads tabs share one cache. Invalidate that key after granting MediaLibrary permission.

## Stale docs

- `README.md` still describes an earlier TypeScript file layout (`apiService.ts`, `syncService.ts`, `GalleryGrid.tsx`, etc.) — does not match the source tree.
- `docs/architecture.md` and `docs/gallery-sync.md` still reference `SyncContext` / `getAssetUri` — those were removed.

---

# Audit history

The original review found 16 issues. The ones below were fixed in the same pass that added the **Hide already-synced** setting; the remainder are intentionally deferred (cosmetic or require new dependencies).

## Fixed

| # | Issue | Resolution |
|---|-------|-----------|
| 1 | `auth:expired` event had no listener | [`AuthExpiredHandler`](app/_layout.jsx) subscribes at the root, dispatches `clearAuth()`, clears React Query, and routes to `/login`. Guards against double-fire by checking `userEmail`. |
| 2 | `startShareSync` clearing uploads broke the share-intent "Done" state | Thunk now ends with `setSyncing(false)` only; items survive until the user taps Done / Cancel ([`dismiss()`](app/share-intent.jsx)). |
| 3 | `startSync` erased failed entries on completion | Replaced `clearUploads()` with the new [`purgeFinishedUploads`](store/uploadsSlice.js) reducer (drops `synced`/`skipped`, keeps `failed`). |
| 4 | Cancellation erased the same data as #3 | Same `purgeFinishedUploads` path — failures from cancellation now stay in the Uploads tab. |
| 5 | Root folder selection stored `/` instead of `''` | [FolderPicker.jsx](components/FolderPicker.jsx) and [folder-picker.jsx](app/folder-picker.jsx) now pass the raw `currentPath` through. `settings.jsx` / `share-intent.jsx` render `'Root'` for the empty case. |
| 6 | `?path=` interpolations weren't URL-encoded | Wrapped all four call sites in `encodeURIComponent`: [syncThunks.js](store/syncThunks.js), [shareThunks.js](store/shareThunks.js), [useServerFiles.js](hooks/useServerFiles.js) (FolderPicker was already correct). |
| 7 | Dead `context/SyncContext.jsx` (imports removed `getAssetUri`) | Deleted; `context/` directory removed. |
| 8 | `useGalleryAssets` re-paginated the library per screen mount | Converted to React Query under key `['galleryAssets']` with a 5-minute `staleTime`. Both tabs now hit one cache. |
| 9 | Uploads tab called `useGalleryAssets(true)` with no permission check | Hook now checks permission internally via `getPermissionStatus()` (non-prompting) and returns empty when not granted. |
| 10 | `handleSave` always dispatched `setBackendUrl` even when unchanged | Guards on `trimmedUrl !== backendUrlStored`. |
| 11 | Share folder selection used `globalThis.__shareFolderCallback` | New [`shareSlice`](store/shareSlice.js) — folder-picker dispatches `setShareTargetPath`, share-intent reads it, dismiss clears it. |
| 14 | Gallery `keyExtractor` included per-section index, causing reconciliation churn | Now uses the first non-null asset id in the row, which is globally unique. |

## Deferred

| # | Issue | Reason |
|---|-------|--------|
| 12 | `KeyboardAvoidingView` with `behavior={undefined}` on Android | No-op in practice; Android handles soft input via `windowSoftInputMode`. Revisit if a real layout bug shows up. |
| 13 | Logout doesn't clear the native cookie jar | Requires `@react-native-cookies/cookies` (new native dep). Acceptable as-is for the single-account flow. |
| 15 | `README.md` / `docs/` reference the old architecture | Worth a rewrite — listed under "Stale docs" above. |
| 16 | `assets/adaptative-icon.png` typo | Path matches `app.json`; works fine. Rename if the icon is ever regenerated. |

## New feature: Hide already-synced

- [`settingsSlice`](store/settingsSlice.js) — new `hideSynced: boolean` (persisted, default `false`).
- [`(tabs)/settings.jsx`](app/(tabs)/settings.jsx) — Switch under the existing Wi-Fi-only toggle.
- [`(tabs)/gallery.jsx`](app/(tabs)/gallery.jsx) — `displaySections` `useMemo` strips assets whose filename appears in the server `Set` and re-chunks each section into rows of `COLS=3`, dropping sections that empty out. Empty state shows a tailored message ("Everything is synced") when the filter is on.
- During an active sync, items only leave the visible grid after `useServerFiles` refetches — the gallery's existing post-sync `invalidateQueries({ queryKey: ['serverFiles'] })` already covers that.
