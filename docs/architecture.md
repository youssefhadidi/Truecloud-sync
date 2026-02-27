# Architecture

## Overview

```
┌─────────────────────────────────────┐
│              Expo Router            │
│  app/_layout.jsx  (QueryClient)     │
│  app/(tabs)/_layout.jsx (SyncCtx)   │
│                                     │
│  ┌──────────┐ ┌────────┐ ┌───────┐  │
│  │ Gallery  │ │Uploads │ │Settings│  │
│  └────┬─────┘ └───┬────┘ └───┬───┘  │
└───────┼───────────┼──────────┼──────┘
        │           │          │
        ▼           ▼          ▼
┌───────────────────────────────────┐
│           Context / Hooks         │
│  SyncContext  – selected, status  │
│  useGalleryAssets – device photos │
│  useServerFiles  – React Query    │
└──────────────┬────────────────────┘
               │
        ┌──────┴──────┐
        ▼             ▼
┌──────────────┐ ┌──────────────┐
│   Services   │ │  expo-media  │
│ axiosClient  │ │   -library   │
│ authService  │ └──────────────┘
│ galleryServ. │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  Truecloud   │
│   Backend    │
│  (Next.js)   │
└──────────────┘
```

## Layers

| Layer | Files | Responsibility |
|-------|-------|----------------|
| Navigation | `app/_layout.jsx`, `app/(tabs)/_layout.jsx` | Route tree, providers |
| Screens | `app/(tabs)/*.jsx` | UI composition |
| Context | `context/SyncContext.jsx` | Cross-tab sync state |
| Hooks | `hooks/` | Data fetching, gallery loading |
| Services | `services/` | Network, device media, auth |

## State Management

- **React Query** — server state: `useServerFiles` queries `GET /api/files?path=sync` and caches the result for 1 minute.
- **SyncContext** — client state: which assets are selected and their upload status for the current session.
- **AsyncStorage** — persisted settings: backend URL, session token, sync folder, Wi-Fi preference.
