# M44 — RevenueCat sandbox + final smoke + App Store submission (external setup)

| Field | Value |
|---|---|
| Goal | RevenueCat dashboard configuration, sandbox subscription verification, final pre-submission smoke, then submit to App Store + Play Store. |
| Status | TODO (external) |
| Branch | `mobile-m44-submission` |
| PR count | 1 (tracker + final smoke notes) |
| Depends on | M43 |
| Complexity | external |

## Background

This is the closing wave. Most of it is dashboard work + walking the App Store / Play Console submission flows. The PR exists to record the smoke-test results + flip the launch tracker.

## External checklist — RevenueCat

- [ ] RevenueCat account created at app.revenuecat.com
- [ ] Project `BURS Mobile` created
- [ ] App Store Connect app linked (App-Specific Shared Secret pasted)
- [ ] iOS IAP products created in App Store Connect:
  - [ ] `burs_premium_monthly_119sek` (auto-renewing subscription, 119 SEK)
  - [ ] `burs_premium_annual_899sek` (auto-renewing subscription, 899 SEK)
- [ ] Both products mapped in RevenueCat dashboard to entitlement `premium`
- [ ] Sandbox tester accounts created (3+) in App Store Connect
- [ ] RevenueCat webhook endpoint configured: `https://khvkwojtlkcvxjxztduj.supabase.co/functions/v1/revenuecat_webhook`
- [ ] Webhook signing secret pasted into Supabase secrets:
  ```bash
  npx supabase secrets set REVENUECAT_WEBHOOK_SECRET=<value>
  ```

## External checklist — sandbox verification

- [ ] On a real device signed in with a sandbox tester:
  - [ ] Trigger purchase of monthly → confirm webhook fires → confirm `subscriptions` row updates to `plan='premium', status='trialing'` → confirm app unlocks
  - [ ] Trigger restore purchases → confirm same end state on a fresh sign-in
  - [ ] Cancel subscription → confirm webhook fires `CANCELLATION` → confirm `subscriptions.status='canceled'` after period end
- [ ] Trigger purchase of annual → same checks

## Final pre-submission smoke (golden path on a release-channel build)

- [ ] EAS production build: `eas build --profile production --platform ios`
- [ ] Onboarding → quiz (M25) + accent color (M26) + photo tutorial (M27)
- [ ] Add 3 garments (Camera, Library, Visual Search M19)
- [ ] Generate outfit (M16)
- [ ] Plan a week (M16)
- [ ] Style chat 8-mode (M14)
- [ ] Photo feedback (M18)
- [ ] Travel capsule (M28)
- [ ] Subscription purchase + restore (M31, M32)
- [ ] Sign out → sign in → confirm state persists

## App Store submission

- [ ] App Store Connect: build uploaded via EAS Submit
- [ ] Metadata: name, subtitle, primary category (Lifestyle), keywords (max 100 chars), description, support URL, marketing URL, copyright
- [ ] Screenshots (6.7" + 6.5" + 5.5") for each language we support (en + sv)
- [ ] App Privacy nutrition labels: data linked / not linked / used for tracking
- [ ] Sign-in account credentials provided to reviewers (sandbox tester)
- [ ] In-App Purchase products attached to first build
- [ ] Submit for review

## Play Store submission

- [ ] Internal testing track build uploaded
- [ ] Subscription products created and matched to RevenueCat
- [ ] Privacy Policy URL provided
- [ ] Data safety section completed
- [ ] Production track submission

## Acceptance gates

- All external checklist items ticked
- App Store review: Approved
- Play Store review: Approved
- Tracker reflects DONE; CURRENT WAVE pointer cleared (or pointed to a post-launch maintenance file).

## PR template

Title: `chore(mobile): M44 — App Store + Play Store submitted`

PR body: full checklist with ticks, links to screenshots, sandbox test results.
