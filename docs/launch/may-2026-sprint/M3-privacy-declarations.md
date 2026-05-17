# M3 — Privacy declarations (Apple App Privacy + Google Data Safety)

**Owner:** Claude drafts → Borna confirms each line against actual data behavior → Borna pastes into both stores.

**Reference truth:**
- Privacy policy live at `https://burs.me/privacy` (Borna confirms current version before submission).
- Account deletion in-app via Settings → Account → Delete Account (calls `delete_user_account` edge function — confirmed deployed 2026-05-17, see N20 PR #881).
- Web account deletion at `https://burs.me/delete-account` (Borna confirms live).

**Data-handling inventory (single source of truth — both stores derive from this):**

| Data type | Collected | Stored where | Purpose | Linked to user | Used for tracking | Optional |
|---|---|---|---|---|---|---|
| Email address | Yes | Supabase `auth.users` (eu-central-1) | Account creation, auth, transactional email | Yes | No | No (required for account) |
| Account name (display name only) | Yes | Supabase `profiles` | UI personalization | Yes | No | Yes |
| Garment photos | Yes | Supabase Storage `garments` bucket | Wardrobe management, outfit generation | Yes | No | No (core feature) |
| Garment metadata (category, color, warmth) | Yes (derived from photos) | Supabase `garments` table | Wardrobe management, outfit generation | Yes | No | No (core feature) |
| Outfit photos (user-uploaded for feedback) | Yes | Supabase Storage | Outfit photo feedback feature | Yes | No | Yes (per-feature opt-in) |
| Wear log | Yes | Supabase `wear_logs` | Track what user actually wears, personalize suggestions | Yes | No | Yes |
| Calendar events (planned outfits + synced Google Calendar events) | Yes | Supabase `planned_outfits`, `calendar_events` | Outfit planning, calendar sync. When user opts into Google Calendar sync (Settings → Calendar Sync), the `calendar` edge function fetches `title`, `description`, `date`, `start_time`, `end_time` from the primary Google Calendar and writes them to `calendar_events` (`supabase/functions/calendar/index.ts:274-314`) so suggestions can take upcoming events into account. | Yes | No | Yes (sync is opt-in; in-app `planned_outfits` always required as a core feature) |
| Home / secondary city (free-text, user-entered in onboarding) | Yes | Supabase `profiles.preferences.style_profile_v4_jsonb` (homeCity, secondaryCity) + legacy `profiles.home_city` column | Weather-aware outfit suggestions, climate-aware style scoring | Yes (stored on the user's profile row) | No | Yes (user can leave the field empty; suggestions still work without it) |
| Device GPS coordinates | Yes (only if user grants OS-level location permission) | Not stored — passed to weather API in-memory only and discarded after the request resolves | Real-time weather forecast for the current location | No | No | Yes |
| Push notification token | Yes (only if user opts in) | Supabase `push_subscriptions` | Daily outfit reminders | Yes | No | Yes |
| Subscription status | Yes | Supabase `subscriptions` + RevenueCat | Entitlement gating | Yes | No | No (required if subscribed) |
| Crash logs and performance data | Yes | Sentry (sentry.io, EU region) | Diagnostics, crash fixing | Yes (linked to Supabase user UUID via `Sentry.setUser({ id: nextUser.id })` in `mobile/src/contexts/AuthContext.tsx:110,142` — set on auth-state change and on session hydration; cleared on sign-out, so pre-auth crashes are unlinked but every signed-in crash carries the user ID) | No | No (v1.0.0 has no in-app opt-out — Sentry initializes whenever `EXPO_PUBLIC_SENTRY_DSN` is set in the build, which it is for every production build) |
| Image processing payloads (transient) | Yes | Gemini API (Google) — not retained by Gemini per their terms; pass-through only | Background removal, garment classification, outfit generation | No (no user identifier sent to Gemini) | No | No (core feature) |

> **Excluded from v1.0.0 declarations:** Meta Pixel + Conversions API events (install, trial, subscribe) and the advertising identifier (IDFA / Android Ad ID). These are part of Plan B (Meta Ads agent), which is co-founder-owned and not in the v1.0.0 build — see `00-overview.md` ("Pixel/CAPI deferred to Plan B"). Declaring them now would misrepresent shipped data behavior and unnecessarily add tracking disclosures. When Plan B ships, add the rows back to this inventory AND update both stores' forms in the same release.

---

## Apple App Privacy Details (App Store Connect → App Privacy)

For each data type below, fields are:
- **Linked to User:** Yes / No
- **Used for Tracking:** Yes / No
- **Purposes:** App Functionality / Analytics / Product Personalization / App Functionality / Developer Advertising or Marketing / Third-Party Advertising

### 1. Contact Info → Email Address
- **Linked to User:** Yes
- **Used for Tracking:** No
- **Purposes:** App Functionality

### 2. User Content → Photos or Videos
- **Linked to User:** Yes
- **Used for Tracking:** No
- **Purposes:** App Functionality, Product Personalization

### 3. User Content → Other User Content
- **What:** Garment metadata, outfit selections, wear log, planned outfits, and — when the user opts into Google Calendar sync (Settings → Calendar Sync) — synced calendar events (title, description, date, start/end time) from the primary calendar, written to `calendar_events` so suggestions can take upcoming events into account (`supabase/functions/calendar/index.ts:274-314`).
- **Linked to User:** Yes
- **Used for Tracking:** No
- **Purposes:** App Functionality, Product Personalization

### 4. Identifiers → User ID
- **What:** Supabase user UUID.
- **Linked to User:** Yes
- **Used for Tracking:** No
- **Purposes:** App Functionality

### 5. Diagnostics → Crash Data
- **Linked to User:** Yes (Sentry receives the Supabase user UUID via `Sentry.setUser({ id })` from `AuthContext.tsx` whenever a user is signed in — pre-auth crashes are unlinked but post-auth crashes are linked).
- **Used for Tracking:** No
- **Purposes:** App Functionality
- **Opt-out:** Not available in v1.0.0 — declare collected on every install with the DSN configured.

### 6. Diagnostics → Performance Data
- **Linked to User:** Yes (same `Sentry.setUser` mechanism as crash data — performance events ship with the user UUID once signed in).
- **Used for Tracking:** No
- **Purposes:** Analytics

### 7. Purchases → Purchase History
- **Linked to User:** Yes
- **Used for Tracking:** No
- **Purposes:** App Functionality

### 8. Location → Coarse Location
- **What:** Two distinct paths, both declared under this single Apple category:
  1. **User-entered home / secondary city** (free-text, asked during onboarding's climate step — see `mobile/src/screens/onboarding/StyleQuizV4Step.questions1.tsx:251-281`). Stored linked to the user in `profiles.preferences.style_profile_v4_jsonb` and the legacy `profiles.home_city` column. Used for weather-aware outfit suggestions and climate-aware style scoring.
  2. **Device GPS coordinates** (only when the user grants OS-level location permission). Passed to the weather API in-memory and discarded after the request resolves — never persisted.
- **Linked to User:** Yes (the user-entered city is stored on the profile row; the in-memory GPS path is unlinked, but Apple requires the whole category to be declared at the broadest applicable scope, so the row must be linked).
- **Used for Tracking:** No
- **Purposes:** App Functionality

**Data NOT collected (explicit declarations to mark as "Not Collected"):**
- Health and Fitness
- Financial Info (card details — RevenueCat/Apple handles payment, app never sees cards)
- Sensitive Info (race, sexual orientation, religion, etc.)
- Contacts
- Browsing History
- Search History (in-app search uses local state only, not transmitted)
- Audio Data
- Identifiers → Device ID (no advertising identifier collection in v1.0.0 — Plan B re-enables this)
- Usage Data → Product Interaction (no third-party event tracking in v1.0.0 — Plan B re-enables this)
- Other Data Types (none)

**Privacy Choices URL (optional but recommended):** `https://burs.me/privacy#choices`

---

## Google Play Data Safety form

Play's form asks two parallel questions for each data type: **Collected** and **Shared**. "Collected" means the app transmits it off the device; "Shared" means it goes to a third party for their independent use.

| Data type | Collected? | Shared? | Optional? | Purposes | Notes |
|---|---|---|---|---|---|
| **Personal info** ||||||
| Name | Yes | No | Yes | Account management, App functionality | Display name only; required only if user sets one. |
| Email address | Yes | No | No | Account management, App functionality | Required for account. |
| User IDs | Yes | No | No | Account management, App functionality | Supabase UUID. Not shared with any third party in v1.0.0 (Plan B's hashed-email-to-Meta-CAPI flow is deferred). |
| **Financial info** ||||||
| Purchase history | Yes | No | No | App functionality, Account management | Subscription state only. App never sees card details (Google Play + RevenueCat handles payment). |
| **Location** ||||||
| Approximate location | Yes | No | Yes | App functionality | Two paths declared together under this row: (1) user-entered home / secondary city from onboarding, stored on the user's profile in `profiles.preferences.style_profile_v4_jsonb` + `profiles.home_city` — linked to the account, optional (field can be left blank); (2) device GPS coordinates, only when user grants OS-level permission, used in-memory for weather and not retained. The stored path is what makes this row "Collected" and linked; the in-memory GPS path alone would not be. |
| **Photos and videos** ||||||
| Photos | Yes | No | No | App functionality, Personalization | Garment photos required for core feature. Outfit-feedback photos optional. |
| **Calendar** ||||||
| Calendar events | Yes | No | Yes | App functionality | Synced from the user's primary Google Calendar **only when they opt in** via Settings → Calendar Sync. `title`, `description`, `date`, `start_time`, `end_time` are stored in `calendar_events` so outfit suggestions can take upcoming events into account. Not shared with any third party. Cleared on calendar disconnect and on account deletion (see `delete_user_account` cascade). |
| **App activity** ||||||
| Other user-generated content | Yes | No | No | App functionality, Personalization | Wardrobe metadata, outfit selections, wear log. Includes in-app `planned_outfits` (core feature, required); does NOT include Google Calendar event content — that is declared under the Calendar row above. |
| **App info and performance** ||||||
| Crash logs | Yes | No | No | App functionality | Sentry. Linked to the Supabase user UUID once signed in (`Sentry.setUser` in `AuthContext.tsx`). v1.0.0 has no in-app opt-out — `EXPO_PUBLIC_SENTRY_DSN` is bundled into every production build and Sentry initializes unconditionally. If you want an opt-out shipped before v1.0.0, treat it as a separate wave; do not back-claim "optional" in this form. |
| Diagnostics | Yes | No | No | App functionality, Analytics | Sentry performance metrics. Linked to user same as crash logs above. Same v1.0.0 caveat. |
**Data NOT collected (must be explicitly marked):**
- All "Personal info" except Name / Email / User IDs
- Health and Fitness
- Messages
- Audio files
- Files and docs
- Contacts
- Web browsing
- Other app activity (in-app search history is not transmitted; no third-party event tracking in v1.0.0 — Plan B re-enables `App interactions → advertising`)
- Device or other IDs (no advertising identifier collection in v1.0.0 — Plan B re-enables `Device or other IDs → advertising`)

### Security practices (Play form mandatory questions)

| Question | Answer | Notes |
|---|---|---|
| Is data encrypted in transit? | Yes | TLS 1.3 across all Supabase/Sentry/Gemini/RevenueCat endpoints. |
| Is data encrypted at rest? | Yes | Supabase Postgres + Storage at-rest encryption. Sentry at-rest encryption per their SOC2. |
| Can users request data deletion? | Yes | In-app: Settings → Account → Delete Account. Web: burs.me/delete-account. |
| Do you follow Google Play's Families Policy? | N/A | App targets 13+. |
| Has your app been independently security-reviewed? | No | Self-review only for v1.0.0 — note for v1.1+ planning. |

### Account deletion (Play-specific section)

- **In-app deletion:** Settings → Account → Delete Account. Triggers `delete_user_account` edge function which cascades across 24+ tables and storage paths (see function source for full inventory).
- **Web deletion URL:** `https://burs.me/delete-account` (must be live at submission — Borna to verify).
- **Data deleted:** Account, profile, all garments + photos, all outfits, wear logs, calendar events, subscription state, AI memory tables, push subscriptions, travel capsules, response cache. Cascades complete within seconds.
- **Data retained after deletion:** None for the user. Aggregated/anonymized analytics may persist but contain no user identifier.

---

## Cross-store consistency checks

Both stores' answers must agree on these load-bearing claims:

| Claim | App Store reflection | Play Store reflection |
|---|---|---|
| App collects email and links to user | "Contact Info → Email" Yes/Yes | "Personal info → Email" Yes |
| App stores user-content photos linked to user | "User Content → Photos" Yes | "Photos and videos → Photos" Yes |
| App offers in-app account deletion | App description mentions Settings → Delete | Data Safety: Yes for deletion + web URL |
| Cards never touch the app | "Financial Info" Not Collected | "Financial info → Purchase history" only |
| No third-party advertising tracking in v1.0.0 | "Identifiers → Device ID" Not Collected + "Usage Data → Product Interaction" Not Collected | "Device or other IDs" Not Collected + "App activity → App interactions" Not Collected |
| Google Calendar event content is collected (opt-in only) | "User Content → Other User Content" covers planned outfits + synced calendar events | "Calendar → Calendar events" Yes / No / Yes (optional) |
| Coarse location is collected AND linked to user (via user-entered home city, stored on profile) | "Location → Coarse Location" Yes, Linked Yes, optional | "Location → Approximate location" Yes, Optional Yes |

If any row above disagrees between the two stores' actual submitted forms, **stop and reconcile** — that's a guaranteed rejection vector.

---

## Borna pre-submission checklist for this doc

- [ ] `burs.me/privacy` page reflects the inventory above. Specifically: it must NOT claim Meta Pixel / CAPI data collection — that is Plan B and is not part of v1.0.0.
- [ ] `burs.me/delete-account` page is live and returns a real form (Play requires a web-accessible path even when in-app deletion exists).
- [ ] Confirm crash-log / diagnostics rows are filed as **not** optional in both stores' forms (v1.0.0 has no in-app opt-out — see the inventory above). A future wave can add the toggle and flip the row to optional, but not in v1.0.0.
- [ ] Confirm the ATT prompt is NOT triggered in v1.0.0 (no IDFA collection until Plan B ships). If a stray ATT request slips through Info.plist, Apple will reject the build for tracking-purpose mismatch.
- [ ] Account Deletion URL declared in App Store Connect → App Information section.
- [ ] When Plan B (Meta Ads agent) lands: re-add the Meta CAPI inventory rows + Apple "Identifiers → Device ID" + "Usage Data → Product Interaction" sections + Play "Device or other IDs" + "App activity → App interactions" rows + the cross-store consistency row. Update both stores' forms in the same release — never let the privacy declarations and the in-app data behavior diverge.
