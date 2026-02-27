# Truecloud Sync

A cross-platform mobile app (iOS + Android) built with **Expo** that automatically synchronizes your device photo gallery to your own backend.

---

## Features

- Browse and sync photos/videos from your device gallery
- Incremental sync — only uploads new or changed media
- Background sync support
- Works on both iOS and Android
- Permission-aware — requests only what it needs

---

## Project Structure

```
truecloud-sync/
├── app/                    # Expo Router screens
│   ├── _layout.tsx         # Root layout (navigation, providers)
│   ├── index.tsx           # Splash / redirect
│   └── (tabs)/
│       ├── _layout.tsx     # Tab navigator
│       ├── gallery.tsx     # Gallery browser + sync UI
│       └── settings.tsx    # Backend URL, auth token config
├── components/
│   ├── GalleryGrid.tsx     # Thumbnail grid component
│   └── SyncButton.tsx      # Sync trigger + progress indicator
├── hooks/
│   └── useGallerySync.ts   # Core sync state hook
├── services/
│   ├── galleryService.ts   # expo-media-library wrapper
│   ├── apiService.ts       # HTTP client for your backend
│   └── syncService.ts      # Diff logic + upload orchestration
├── docs/                   # Project documentation
│   ├── architecture.md
│   ├── permissions.md
│   ├── gallery-sync.md
│   ├── backend-api.md
│   └── ios-sideloading.md
├── app.json                # Expo config (permissions, bundle IDs)
└── package.json
```

---

## Quick Start

### Prerequisites

- Node.js 18+
- [Expo CLI](https://docs.expo.dev/get-started/installation/) (`npm install -g expo-cli`)
- [EAS CLI](https://docs.expo.dev/eas/) (`npm install -g eas-cli`) — for building
- A running backend that implements the [Backend API](docs/backend-api.md)

### Install

```bash
cd truecloud-sync
npm install
```

### Run in development

```bash
npx expo start
```

Scan the QR code with **Expo Go** (Android) or the Camera app (iOS).

> **Note:** `expo-media-library` requires a real device for gallery access. The simulator/emulator has a limited fake library.

---

## Documentation

| Doc | Description |
|-----|-------------|
| [Architecture](docs/architecture.md) | Data flow, layers, state management |
| [Permissions](docs/permissions.md) | How iOS & Android permissions are handled |
| [Gallery Sync](docs/gallery-sync.md) | Incremental sync algorithm, background tasks |
| [Backend API](docs/backend-api.md) | API contract your backend must implement |
| [iOS Sideloading](docs/ios-sideloading.md) | Install on iOS without the App Store (free) |

---

## Environment Configuration

Settings are stored on-device via `AsyncStorage` and configured in the **Settings** tab at runtime:

| Setting | Description |
|---------|-------------|
| Backend URL | e.g. `https://api.yourdomain.com` |
| Auth Token | Bearer token sent with every request |
| Sync on Wi-Fi only | Prevent uploads on mobile data |
| Auto-sync interval | How often background sync runs |

---

## Building for Production

See [iOS Sideloading](docs/ios-sideloading.md) for how to build and install without the App Store.

For Android:

```bash
eas build --platform android --profile production
```

This produces an `.apk` or `.aab` you can install directly on any Android device.
