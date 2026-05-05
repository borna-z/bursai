# Mobile Launch — M14 — App Store submission

**Goal:** Submit BURS to App Store and Google Play. Target launch date: **2026-05-31**.

**Status:** ⛔ BLOCKED — depends on M0–M13 done + Apple Developer setup complete.
**Branch:** N/A — submission is via App Store Connect + Play Console UIs, not code.
**Depends on:** M0–M13 fully closed, all external setup done.
**Complexity:** external, ~3-7 days for review.

---

## What this wave does

1. Final EAS Build + TestFlight build #N (the one that gets promoted to App Store).
2. App Store Connect submission with full metadata (App Privacy nutrition label, screenshots, marketing copy, age rating, IAP descriptions).
3. Google Play Console submission with matching metadata.
4. Apple review (24-48hr typical, can stretch to 7 days; ~30% first-submission reject rate).
5. Address any rejection feedback → resubmit.
6. Once Approved + Released → launch announcement on burs.me + email + social.

---

## App Store Connect submission checklist

- [ ] App Information: name, subtitle, primary category, secondary category, content rights
- [ ] Pricing: subscriptions priced 119 SEK/m + 899 SEK/y (linked from M6 IAP products)
- [ ] App Privacy: data collection nutrition label (Sentry: crash logs + device ID; Supabase: email + user content; RevenueCat: purchase history + device ID)
- [ ] Privacy policy URL: `https://burs.me/privacy`
- [ ] Marketing URL: `https://burs.me`
- [ ] Support URL: `https://burs.me/support` (web Wave 11 deliverable)
- [ ] Age rating: 12+ likely (mild user-generated content, no objectionable categories)
- [ ] Screenshots: 6.7" (iPhone 16 Pro Max), 6.5" (iPhone 11 Pro Max), 12.9" (iPad Pro) — at least 3 per size, 5 ideal
- [ ] App preview videos: optional but recommended (15-30s)
- [ ] App review information: contact info, demo account credentials (IMPORTANT: Apple reviewers MUST be able to log in without OAuth)
- [ ] Version release: manual after approval
- [ ] In-app purchase metadata: descriptions, review screenshots
- [ ] App description, keywords, what's new in this version
- [ ] Localized App Store metadata (en + sv from M7)

## Google Play Console submission checklist

- [ ] App content: privacy policy, ads, app access (test login), content rating (IARC questionnaire), target audience, news app status, government app status
- [ ] Store presence: main store listing, store settings
- [ ] Pricing & distribution
- [ ] App release: production track, upload `.aab` from EAS Build

---

## Common rejection reasons to pre-empt

1. **5.1.1(v) account deletion** — covered by M1 (verified working).
2. **3.1.1 in-app purchase** — IAP must use StoreKit (M6 RevenueCat handles this; Stripe forbidden for digital goods on iOS).
3. **2.1 broken functionality** — verified via TestFlight in M13.
4. **5.1.1 privacy policy access** — covered by M2 (Linking.openURL).
5. **2.5.1 deprecated API** — Expo SDK 54 + React 18 are current.
6. **4.0 design** — BURS uses native components; should pass.
7. **App Privacy mismatch** — declarations must match actual data flows. Audit in advance.

---

## Day-of-launch checklist

- [ ] App Store Connect: tap "Release this version"
- [ ] Google Play: promote to production
- [ ] Email announcement to existing burs.me waitlist
- [ ] Social posts
- [ ] Sentry monitoring active
- [ ] On-call check first 24hr (refresh Sentry every few hours, watch for crash spikes)

---

## Tracker updates

When App Store + Play Store both Approved + Released:
- mobile-launch-overview.md: M14 → ✅ DONE — LAUNCHED
- CLAUDE.md root: CURRENT WAVE → "Post-launch v1.0.1 polish"
- Open `docs/launch/v1.0.1-polish.md` listing the deferred items (ShareOutfit web URL, GarmentDetail tabs polish, etc.)
