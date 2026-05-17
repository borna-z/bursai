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
| Calendar events (planned outfits) | Yes | Supabase `planned_outfits`, `calendar_events` | Outfit planning, calendar sync | Yes | No | Yes |
| Location (city/coordinates) | Yes (only if user grants permission for weather features) | Not stored — passed to weather API in-memory only | Weather-aware outfit suggestions | No (not stored linked to user) | No | Yes |
| Push notification token | Yes (only if user opts in) | Supabase `push_subscriptions` | Daily outfit reminders | Yes | No | Yes |
| Subscription status | Yes | Supabase `subscriptions` + RevenueCat | Entitlement gating | Yes | No | No (required if subscribed) |
| Crash logs and performance data | Yes | Sentry (sentry.io, EU region) | Diagnostics, crash fixing | No (anonymized event IDs) | No | Yes (Settings → Privacy → Send Crash Reports) |
| Image processing payloads (transient) | Yes | Gemini API (Google) — not retained by Gemini per their terms; pass-through only | Background removal, garment classification, outfit generation | No (no user identifier sent to Gemini) | No | No (core feature) |
| Advertising identifier (IDFA / Android Ad ID) | Yes (only if user grants ATT / Ads ID permission) | Sent to Meta Pixel + Conversions API | Attribution for Meta Ads campaigns | No (hashed before send) | Yes | Yes (denying ATT disables Meta tracking — no app impact) |
| Install + first-launch event | Yes | Meta Conversions API (server-side) | Install attribution | No | Yes | No (anonymized, no user PII) |
| `StartTrial` and `Subscribe` events | Yes | Meta Conversions API (server-side via revenuecat_webhook) | Conversion attribution | Yes (hashed email per Meta's spec) | Yes | No |

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
- **What:** Garment metadata, outfit selections, wear log, planned outfits.
- **Linked to User:** Yes
- **Used for Tracking:** No
- **Purposes:** App Functionality, Product Personalization

### 4. Identifiers → User ID
- **What:** Supabase user UUID.
- **Linked to User:** Yes
- **Used for Tracking:** No
- **Purposes:** App Functionality

### 5. Identifiers → Device ID
- **What:** Advertising identifier sent to Meta when user has granted ATT permission.
- **Linked to User:** No
- **Used for Tracking:** Yes
- **Purposes:** Third-Party Advertising

### 6. Diagnostics → Crash Data
- **Linked to User:** No
- **Used for Tracking:** No
- **Purposes:** App Functionality

### 7. Diagnostics → Performance Data
- **Linked to User:** No
- **Used for Tracking:** No
- **Purposes:** Analytics

### 8. Usage Data → Product Interaction
- **What:** Anonymized event names sent to Meta CAPI (install, trial start, subscribe). No screen-level analytics in v1.0.0.
- **Linked to User:** Yes (hashed email per Meta CAPI spec)
- **Used for Tracking:** Yes
- **Purposes:** Third-Party Advertising

### 9. Purchases → Purchase History
- **Linked to User:** Yes
- **Used for Tracking:** No
- **Purposes:** App Functionality

### 10. Location → Coarse Location
- **What:** City-level for weather suggestions, only with user permission. Not stored linked to user — passed to weather API in-memory and discarded.
- **Linked to User:** No
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
| User IDs | Yes | Yes | No | Account management, App functionality, Analytics, Advertising or marketing | Supabase UUID (collected). Hashed email to Meta CAPI (shared). |
| **Financial info** ||||||
| Purchase history | Yes | No | No | App functionality, Account management | Subscription state only. App never sees card details (Google Play + RevenueCat handles payment). |
| **Location** ||||||
| Approximate location | Yes | No | Yes | App functionality | Only when user grants permission. City-level for weather. Not retained. |
| **Photos and videos** ||||||
| Photos | Yes | No | No | App functionality, Personalization | Garment photos required for core feature. Outfit-feedback photos optional. |
| **App activity** ||||||
| Other user-generated content | Yes | No | No | App functionality, Personalization | Wardrobe metadata, outfit selections, wear log. |
| App interactions | Yes | Yes | No | Advertising or marketing, Analytics | Install + trial + subscribe events to Meta CAPI. |
| **App info and performance** ||||||
| Crash logs | Yes | No | Yes | App functionality | Sentry. Opt-out available in Settings. |
| Diagnostics | Yes | No | Yes | App functionality, Analytics | Sentry performance metrics. |
| **Device or other IDs** ||||||
| Device or other IDs | Yes | Yes | Yes | Advertising or marketing | Android Ad ID to Meta when user has not opted out of personalized ads at the OS level. |

**Data NOT collected (must be explicitly marked):**
- All "Personal info" except Name / Email / User IDs
- Health and Fitness
- Messages
- Audio files
- Files and docs
- Calendar
- Contacts
- Web browsing
- Other app activity (in-app search history is not transmitted)

### Security practices (Play form mandatory questions)

| Question | Answer | Notes |
|---|---|---|
| Is data encrypted in transit? | Yes | TLS 1.3 across all Supabase/Sentry/Gemini/Meta/RevenueCat endpoints. |
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
| App sends anonymized install/trial events to Meta for ads attribution | "Usage Data → Product Interaction" + tracking flag | "App activity → App interactions" + advertising purpose |
| App offers in-app account deletion | App description mentions Settings → Delete | Data Safety: Yes for deletion + web URL |
| Cards never touch the app | "Financial Info" Not Collected | "Financial info → Purchase history" only |

If any row above disagrees between the two stores' actual submitted forms, **stop and reconcile** — that's a guaranteed rejection vector.

---

## Borna pre-submission checklist for this doc

- [ ] `burs.me/privacy` page reflects the inventory above (especially the Meta CAPI disclosure, which is new for v1.0).
- [ ] `burs.me/delete-account` page is live and returns a real form (Play requires a web-accessible path even when in-app deletion exists).
- [ ] Settings → Privacy → "Send Crash Reports" toggle exists and disables Sentry init on opt-out.
- [ ] ATT prompt copy on iOS reads something like "BURS uses this to measure which ads helped people discover the app. It does not enable any in-app advertising." (Apple rejects vague ATT explanations.)
- [ ] Account Deletion URL declared in App Store Connect → App Information section.
