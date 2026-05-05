# Mobile Launch — M13 — TestFlight burndown

**Goal:** Cut TestFlight build #1, internal testing, bug burndown, TestFlight build #2 with external testers, final burndown.

**Status:** ⛔ BLOCKED — needs Apple Developer account + EAS Build configured.
**Branch:** N/A — this wave is process, not code (bug-fix PRs cut from `feat/mobile-rn-app` as needed).
**Depends on:** M0–M12 merged + Apple Developer + EAS configured.
**Complexity:** running, ~7-10 days calendar.

---

## What this wave does

1. EAS Build production iOS + Android builds.
2. Upload `.ipa` to App Store Connect → TestFlight.
3. Internal testing (3-5 days, solo or small group).
4. Bug burndown PRs as they surface — each follows the standard wave template.
5. Cut TestFlight build #2 once internal-testing bugs are fixed.
6. External testers (sandbox subscription verification, real-device push verification, etc.).
7. Final burndown.
8. Hand off to M14.

---

## EAS Build commands

```bash
# Once eas.json profiles are set up:
cd mobile
eas build --platform ios --profile production --auto-submit-with-profile production
eas build --platform android --profile production
```

**External setup checklist (parallel):**
- [ ] EAS project linked: `eas init` → `bursai/burs-mobile`
- [ ] EAS submit credentials uploaded (Apple App Store Connect API key, Google service account)
- [ ] Sandbox testers added in App Store Connect
- [ ] APNs auth key uploaded to Expo + RevenueCat (M5 + M6 prereq)
- [ ] App Store Connect IAP products in "Ready to Submit" status
- [ ] App Privacy nutrition label data declarations submitted
- [ ] Privacy policy + Terms URLs configured

---

## Bug-fix PR convention during M13

Each TestFlight bug → one focused PR:
- Branch: `mobile-tfbuild-<N>-<short-slug>`
- Title: `fix(mobile): TestFlight build #<N> — <description>`
- Body: link the TestFlight feedback note or screenshot.
- Tracker update: append to `docs/launch/findings-log.md` with `M13` prefix; do NOT advance the wave pointer until M14 is ready.

---

## Acceptance gates for cutting TestFlight build #1

- [ ] All M0–M12 merged
- [ ] `cd mobile && npx tsc --noEmit` 0 errors
- [ ] Real device dev-build smoke test passes for: account creation, garment add, outfit generate, push subscribe, paywall display
- [ ] No `Coming soon` or `mock` strings remaining in user-visible UI (grep verified)

## Acceptance gates for advancing to M14

- [ ] TestFlight build #2 internal+external testing completed with no P0/P1 bugs
- [ ] Sandbox subscription purchase + restore verified on iOS + Android
- [ ] Real APNs push received in foreground + background on iOS device
- [ ] Universal Link tap from Mail/Messages opens correct screen
- [ ] App Privacy nutrition label data submitted in App Store Connect
- [ ] Sentry receiving real device crashes (verify with intentional throw)

---

## Tracker updates

Each bug-fix PR appends to findings-log.md but does not move the wave pointer. Pointer moves to M14 only when all acceptance gates above pass.
