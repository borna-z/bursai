# M34 — App.json metadata + Universal Links + privacy manifest

| Field | Value |
|---|---|
| Goal | Complete `app.json` for App Store submission: bundle ID, info.plist usage strings, intent filters, plugins, privacy manifest stub. |
| Status | TODO |
| Branch | `mobile-m34-appjson` |
| PR count | 1 |
| Depends on | V0 |
| Complexity | S |

## Background

The current `app.json` is partial. Reviewers reject builds missing camera/photo/location/ATT usage strings. Universal Links + Android App Links need `apple-app-site-association` + `assetlinks.json` on `https://burs.me/.well-known/` (web side) plus matching app-side config.

## Files touched

### Modified
- `mobile/app.json`:
  - `expo.ios.bundleIdentifier: "me.burs.app"`
  - `expo.android.package: "me.burs.app"`
  - `expo.ios.infoPlist.NSCameraUsageDescription`, `NSPhotoLibraryUsageDescription`, `NSLocationWhenInUseUsageDescription`, `NSUserTrackingUsageDescription`
  - `expo.ios.associatedDomains`: deferred until M43 Apple Developer setup confirms paid account
  - `expo.ios.infoPlist.UIBackgroundModes`: `["remote-notification"]`
  - `expo.android.intentFilters`: deep-link + Android App Link config
  - `expo.scheme: "burs"`
  - `expo.plugins`: ensure `@sentry/react-native/expo`, `expo-camera`, `expo-image-picker`, `expo-notifications`, `expo-localization`, `react-native-purchases` (M31), `react-native-vision-camera` (M6)
- `mobile/ios/PrivacyInfo.xcprivacy` (auto-managed by Expo from app.json `privacyManifests` block) — declare data collection categories: device ID, photos, location.

### Tracker
- Note in `findings-log.md`: `expo.ios.associatedDomains` + `aps-environment` deferred to M43.

## Acceptance gates

- TypeScript: 0 errors
- V0 CI gates: all green
- `npx expo-doctor` passes
- `npx expo prebuild --no-install` produces an iOS project that opens in Xcode without warnings
- Code-reviewer: approved

## Deploy

None.

## PR template

Title: `feat(mobile): M34 — app.json metadata + privacy manifest`
