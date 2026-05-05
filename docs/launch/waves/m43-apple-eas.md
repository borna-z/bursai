# M43 — Apple Developer + EAS dev build (external setup)

| Field | Value |
|---|---|
| Goal | User-managed external setup wave. Code-side prerequisites confirmed; the actual purchase, certificate dance, and first EAS build run as a checklist the user works through. |
| Status | TODO (external) |
| Branch | `mobile-m43-apple-eas` (small code-side commit; no large code changes expected) |
| PR count | 1 (mostly tracker + checklist) |
| Depends on | V0, all functional waves (M0–M42) |
| Complexity | external |

## Background

This wave doesn't ship features. It records the external steps + flips related deferrals (M30 APNs, M34 `aps-environment` + `associatedDomains`).

## External checklist (user runs these)

Each item: tick when done.

- [ ] Apple Developer Program membership purchased ($99/year)
- [ ] Bundle ID `me.burs.app` registered in Apple Developer portal
- [ ] App Store Connect app record created (Name, SKU, Primary Language)
- [ ] App-Specific Shared Secret generated for App Store Connect (saved to RevenueCat dashboard)
- [ ] APNs Auth Key (.p8) generated → uploaded to Expo (`eas credentials` flow) and RevenueCat
- [ ] iOS Distribution Certificate created via `eas credentials` (Expo manages by default)
- [ ] Provisioning profile generated for `me.burs.app`
- [ ] First EAS dev build: `cd mobile && eas build --profile development --platform ios`
- [ ] Install dev build on a real iPhone via TestFlight or USB → smoke-test the golden path:
  - [ ] Sign in / sign up
  - [ ] Add a garment via Camera (M5–M8)
  - [ ] Generate an outfit (M16)
  - [ ] Open Style Chat (M14)
  - [ ] Push notification arrives (M30 — needs APNs key already uploaded)
- [ ] Apple App Site Association file at `https://burs.me/.well-known/apple-app-site-association` (Universal Links — M34 deferral)
- [ ] App.json amended: `expo.ios.associatedDomains: ["applinks:burs.me"]` and `expo.ios.entitlements.aps-environment: "production"` — run `eas build` again to bake in
- [ ] Confirm `findings-log.md` rows for M30 + M34 deferrals are flipped to RESOLVED

## Code-side (small)

- `mobile/app.json` — uncomment / add `associatedDomains` and `aps-environment` lines once Apple Developer is live.

## Acceptance gates

- All external checklist items ticked
- Dev build runs on a real device
- Push lands on the device

## Deploy

None — code-side change is small (app.json deltas).

## PR template

Title: `chore(mobile): M43 — Apple Developer + EAS dev build live`

PR body lists the external checklist with ticks + links to screenshots / receipts where appropriate (private). The PR exists primarily to flip the tracker.
