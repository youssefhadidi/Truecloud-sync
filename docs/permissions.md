# Permissions

## iOS

| Permission | Key | When requested |
|-----------|-----|---------------|
| Photo Library (read) | `NSPhotoLibraryUsageDescription` | On first Gallery tab visit |
| Photo Library (add) | `NSPhotoLibraryAddUsageDescription` | Declared in app.json |

iOS 14+ shows a limited/full access prompt. The app works with limited access but can only see selected photos.

## Android

| Permission | API level | Purpose |
|-----------|-----------|---------|
| `READ_MEDIA_IMAGES` | 33+ | Read photos |
| `READ_MEDIA_VIDEO` | 33+ | Read videos |
| `READ_EXTERNAL_STORAGE` | < 33 | Read media (legacy) |
| `INTERNET` | — | Upload to server |
| `ACCESS_NETWORK_STATE` | — | Wi-Fi only check |
| `ACCESS_WIFI_STATE` | — | Wi-Fi only check |

## Handling denied permissions

If the user denies the photo library permission, the Gallery screen shows an explanatory message prompting them to open Settings. The app does not request the permission again automatically — the user must open device Settings to grant it.
