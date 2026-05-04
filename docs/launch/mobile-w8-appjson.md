# Mobile Launch — M8 — App.json metadata + Universal Links + privacy manifest

**Goal:** Complete `mobile/app.json` with iOS info.plist usage descriptions, intent filters, plugins, and (when external setup is ready) APNs entitlement + associated domains.

**Status:** 🟡 PARTIAL — most can ship now; `aps-environment` entitlement and `associatedDomains` need Apple Dev account.
**Branch:** `mobile-w8-appjson`
**PR count:** 1 now (writable items) + 1 amendment when Apple Dev arrives
**Depends on:** M0
**Complexity:** S

---

## What ships now (writable)

- iOS info.plist usage descriptions (camera, photos, location, ATT)
- `CFBundleURLTypes` for `burs://` scheme
- `UIBackgroundModes: ["remote-notification"]` declaration
- Android intent filters for App Links (BROWSABLE/DEFAULT)
- Android permissions
- Bundle ID rename `burs.expo.build` → `me.burs.app`
- Plugins: `expo-notifications`, `expo-image-picker`, `expo-tracking-transparency`, `@sentry/react-native/expo`, `expo-build-properties`
- `userInterfaceStyle: "automatic"`
- `version: "1.0.0"` + `buildNumber: "1"`

## What waits for Apple Dev

- iOS `entitlements.aps-environment: "production"` — needs APNs cert / push capability provisioning
- iOS `associatedDomains: ["applinks:burs.me"]` — needs `apple-app-site-association` published at burs.me/.well-known/
- Android `assetlinks.json` published at burs.me/.well-known/

These ship as a 1-line amendment PR when external setup arrives.

---

## Files touched

**Modified:**
- `mobile/app.json`

**External (parallel):**
- [ ] Apple Developer — `me.burs.app` registered, push capability enabled
- [ ] Apple Developer — APNs auth key generated → uploaded to Expo + RevenueCat (see M5 + M6)
- [ ] Web side — `apple-app-site-association` and `assetlinks.json` at `burs.me/.well-known/`
- [ ] Privacy manifest data declarations decided (drafted in PR body, finalized via Apple's PrivacyInfo.xcprivacy at TestFlight time)

---

## Code skeleton

**Full verbatim:** see `docs/launch/mobile-launch-fix-plan-2026-05-31.md` § P1.0′ (App.json Metadata Completion). The master plan has the complete `app.json` diff.

For PR 1 (writable now), apply everything EXCEPT:
- Remove `entitlements: { "aps-environment": "production" }` block — adds in amendment PR.
- Remove `associatedDomains: ["applinks:burs.me"]` — adds in amendment PR.
- Keep everything else verbatim.

---

## Acceptance gates

```bash
cd mobile && npx tsc --noEmit
```
0 errors (app.json is JSON, not TS, but Expo's type-check covers it).

```bash
cd mobile && npx expo prebuild --clean --no-install
```
This regenerates the iOS/Android native projects from app.json. Should succeed without errors. Discard the generated `ios/` and `android/` directories after verification (they're generated; not committed).

**Manual smoke test (no native build needed):**
- `cd mobile && npx expo start` — app launches with new bundle ID identifier visible in console output.
- Tap a `burs://reset-password` link from email (M2) — app opens. Confirms `CFBundleURLTypes` registration.

**Code-reviewer subagent:** mandatory.

---

## PR template

**Title:** `feat(mobile): M8 — app.json metadata + scheme + intent filters + plugins (Apple-Dev items deferred)`

**Body:** Problem (app.json missing iOS info.plist usage descriptions, intent filters, plugins required for M5/M6). Fix (apply master plan diff minus Apple-Dev items). Verification above. External: lists the Apple-Dev items as parallel checkboxes. Findings: log "M8 amendment: add aps-environment + associatedDomains when Apple Dev ready" to findings-log.md.

---

## Tracker updates (in this PR)

- mobile-launch-overview.md: M8 row → 🟡 PARTIAL DONE (PR #<N>, amendment pending Apple Dev), pointer → M9.
- completion-log.md: M8 row.
- CLAUDE.md root: CURRENT WAVE → M9.
