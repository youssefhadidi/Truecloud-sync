# iOS Sideloading

Install the app on your iPhone without an Apple Developer account or App Store.

## Prerequisites

- A Mac or Windows PC
- [AltStore](https://altstore.io) installed on your PC and iPhone
- Or [Sideloadly](https://sideloadly.io) (Windows/Mac)
- An Apple ID (free — no paid developer account needed)

## Step 1 — Build the IPA with EAS

```bash
# Install EAS CLI if not already installed
npm install -g eas-cli

# Log in to Expo
eas login

# Build for iOS (simulator distribution for sideloading)
eas build --platform ios --profile production
```

EAS will build the app in the cloud and give you a download link for the `.ipa` file.

> **Note:** For a free Apple ID, you must resign the IPA on your PC using AltStore or Sideloadly — this is handled automatically by those tools.

## Step 2 — Install with AltStore

1. Install **AltServer** on your PC and **AltStore** on your iPhone ([altstore.io](https://altstore.io))
2. Connect your iPhone via USB
3. Open AltStore on your iPhone → My Apps → `+` → select the downloaded `.ipa`
4. AltStore resigns and installs the app

> Apps sideloaded with a free Apple ID expire after **7 days** and need to be refreshed by opening AltStore while connected to the same Wi-Fi as AltServer.

## Step 3 — Install with Sideloadly (alternative)

1. Download [Sideloadly](https://sideloadly.io) for Windows or Mac
2. Connect your iPhone via USB
3. Drag the `.ipa` into Sideloadly, enter your Apple ID, click Start
4. Trust the developer certificate on your iPhone: Settings → General → VPN & Device Management

## Android

No sideloading complexity — Android allows direct APK installs.

```bash
eas build --platform android --profile preview
```

Download the `.apk` from the EAS dashboard and install it directly on your device (enable "Install from unknown sources" in Settings).
