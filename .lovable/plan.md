

# BURS Roadmap v3 — Production Readiness & Growth (12 Steps)

All 25 steps from Roadmap v2 are complete. This next phase focuses on hardening the app for real users: security, data integrity, notifications, onboarding conversion, and retention mechanics.

---

## Phase 5: Production Hardening & Retention (Steps 1-6)

### Step 1: Push Notification System
Add web push notifications (via Service Worker + backend function) for:
- Daily outfit reminder (morning prompt)
- Planner reminder ("You have no outfit planned for tomorrow")
- Laundry cycle complete
- Weekly style report ready

**Changes:**
- New edge function `send_push_notification` using Web Push API
- New `push_subscriptions` table (user_id, endpoint, keys, created_at)
- Service Worker registration in `main.tsx`
- Notification permission prompt in Settings > Notifications
- Scheduled cron-style edge function `daily_reminders` to trigger notifications

### Step 2: Email Digest System
Weekly email summary sent to users with:
- Outfits worn this week
- Streak status
- Unused garment nudge
- Premium upsell for free users

**Changes:**
- New edge function `weekly_digest` using Resend or built-in email
- Unsubscribe toggle in Settings > Notifications
- `email_preferences` column on profiles (or in preferences JSON)

### Step 3: Onboarding Conversion Funnel
Improve first-time user experience to reduce drop-off:
- Add a "Quick Add" step after style quiz: camera/gallery upload of 3-5 garments
- Show progress indicator (1/4, 2/4...) during onboarding
- Add "Skip for now" options that still complete onboarding
- Post-onboarding celebration screen with "Your wardrobe is ready" and CTA to Today page

**Changes:**
- New `QuickUploadStep` component in onboarding
- Update `Onboarding.tsx` with step progress bar
- New celebration/completion animation

### Step 4: Garment Duplicate Detection
Prevent users from uploading the same garment twice:
- On upload, compare new image against existing wardrobe using perceptual hash or AI similarity
- Show "This looks similar to..." modal with option to continue or cancel

**Changes:**
- New edge function `check_duplicate_garment` using Gemini vision
- Duplicate warning modal in `AddGarment.tsx`

### Step 5: Data Export & Account Portability
Let users export their wardrobe data:
- Export wardrobe as CSV (title, category, color, wear count, etc.)
- Export outfit history
- Download all garment images as zip

**Changes:**
- New edge function `export_wardrobe` that generates CSV + zip
- Export button in Settings > Account
- Download progress UI

### Step 6: Error Recovery & Retry UX
Improve error handling across the app:
- Add retry buttons on all failed data fetches (not just empty states)
- Add toast-based error messages with "Retry" action for mutations
- Network error boundary with full-page retry

**Changes:**
- Update `ErrorBoundary` with network-aware retry
- Add `onError` handlers to React Query mutations globally
- Create `RetryCard` component for inline error states

---

## Phase 6: Engagement & Intelligence v4 (Steps 7-12)

### Step 7: Outfit Calendar View
Add a monthly calendar view to the Plan page showing outfit thumbnails on each day:
- Tap a day to see the outfit or plan one
- Color-coded dots for worn/planned/empty days

**Changes:**
- New `OutfitCalendar` component using existing Calendar UI
- Integration with `planned_outfits` and `wear_logs` data
- New tab on Plan page: "Week" | "Month"

### Step 8: Smart Notifications & Nudges
Context-aware in-app nudges:
- "You haven't worn X in 30 days" on Home page
- "Your wardrobe is 80% tops — consider adding bottoms"
- "Weather is changing — swap to layering"

**Changes:**
- New `useSmartNudges` hook analyzing wardrobe data
- Nudge cards on Home page (below existing SmartInsightCard)
- Dismissible with "Don't show again" per nudge type

### Step 9: Garment Tags & Custom Labels
Let users add custom tags to garments (e.g., "date night", "gym", "work from home"):
- Tags visible on garment cards and filterable in wardrobe
- AI suggests tags during analysis

**Changes:**
- Add `tags` text[] column to garments table
- Tag chips in GarmentDetail and AddGarment
- Tag filter in FilterSheet
- Update `analyze_garment` to suggest tags

### Step 10: Outfit Templates
Save outfit structures as reusable templates:
- "Business casual" template = blazer + shirt + chinos + loafers
- Generate new outfit from template with different garments

**Changes:**
- New `outfit_templates` table (user_id, name, slots JSON)
- Template creation from OutfitDetail ("Save as template")
- Template selector in outfit generation flow

### Step 11: Seasonal Wardrobe Rotation
Prompt users to rotate seasonal items:
- Detect season change based on weather trends
- Show "Time to bring out summer clothes" banner
- Bulk toggle seasonal items in/out of active rotation

**Changes:**
- New `useSeasonalRotation` hook
- Season transition banner on Home page
- Bulk season toggle in Wardrobe filter

### Step 12: Analytics Dashboard for Users
Personal usage analytics page:
- Outfits generated per month
- Most productive styling day
- Average outfit rating trend
- Garment utilization percentage

**Changes:**
- New `UserAnalytics` component with Recharts
- Route at `/insights/analytics`
- Data aggregation from wear_logs, outfits, and garments

---

## Technical Notes

- All new tables require RLS policies scoped to `auth.uid()`
- Push notifications require VAPID keys stored as secrets
- Email digest requires a scheduled cron (pg_cron or external trigger)
- All new features use existing i18n pattern via `useLanguage`
- Premium-gating applies to Steps 2, 5, 10, 12

