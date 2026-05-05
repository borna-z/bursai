# Mobile Launch — M5 — Push notifications mobile-side + Expo send branch

**Goal:** Wire `expo-notifications` for permission/registration, store the Expo push token in `push_subscriptions` (alongside existing web-push rows), persist notification preference toggles, and add an Expo branch to `send_push_notification` so server-side fan-out reaches both web and native subscribers.

**Status:** 🔜 TODO (live APNs delivery verification deferred to M13 — Apple Dev required)
**Branch:** `mobile-w5-push`
**PR count:** 1
**Depends on:** M0
**Complexity:** L

---

## Files touched

**New:**
- `mobile/src/hooks/usePushNotifications.ts`
- `supabase/migrations/<UTCnow>_push_subscriptions_expo_token.sql` — adds `expo_push_token`, `platform`, `device_id` columns
- `supabase/migrations/<UTCnow + 1m>_profiles_notification_prefs.sql` — adds `profiles.notification_prefs jsonb`

**Modified:**
- `mobile/package.json` — add `expo-notifications`, `expo-device`, `expo-constants`
- `mobile/App.tsx` — `Notifications.setNotificationHandler` + foreground/tap listeners
- `mobile/app.json` — add `expo-notifications` to plugins (generic; Apple-specific entitlements like `aps-environment` deferred to M8)
- `mobile/src/screens/SettingsNotificationsScreen.tsx` — wire toggles to `profiles.notification_prefs` + master Push toggle calls `usePushNotifications.subscribe()` / `.unsubscribe()`
- `supabase/functions/send_push_notification/index.ts` — add Expo branch alongside existing web-push branch (read rows where `expo_push_token IS NOT NULL`, POST to `https://exp.host/--/api/v2/push/send`)

**Tracker (same PR):** mobile-launch-overview.md, completion-log.md, root CLAUDE.md, findings-log.md (note APNs verify deferred to M13).

---

## Migration: `push_subscriptions` columns

```sql
-- supabase/migrations/<TIMESTAMP>_push_subscriptions_expo_token.sql
ALTER TABLE public.push_subscriptions
  ADD COLUMN IF NOT EXISTS expo_push_token text,
  ADD COLUMN IF NOT EXISTS platform text CHECK (platform IN ('web', 'ios', 'android')) DEFAULT 'web',
  ADD COLUMN IF NOT EXISTS device_id text;

CREATE INDEX IF NOT EXISTS push_subscriptions_expo_token_idx
  ON public.push_subscriptions (expo_push_token)
  WHERE expo_push_token IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS push_subscriptions_user_device_uniq
  ON public.push_subscriptions (user_id, device_id)
  WHERE device_id IS NOT NULL;

-- Existing RLS policies cover the new columns (auth.uid() = user_id).
```

## Migration: `profiles.notification_prefs`

```sql
-- supabase/migrations/<TIMESTAMP+1m>_profiles_notification_prefs.sql
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notification_prefs jsonb DEFAULT '{}'::jsonb;
```

Run the migration timestamp/file convention from root `CLAUDE.md` Database Migration Rules — timestamps must match what `supabase migration list --linked` shows after `db push`.

---

## Hook + screen wiring

**Full verbatim:** see `docs/launch/mobile-launch-fix-plan-2026-05-31.md` § P1.6 (Push Notifications).

The master plan contains:
- `usePushNotifications` full implementation (`subscribe`, `unsubscribe`, permission state, Expo token registration, upsert into `push_subscriptions` with platform + device_id)
- `App.tsx` notification handler additions
- `SettingsNotificationsScreen` toggle persistence pattern
- `send_push_notification` Expo branch (read `expo_push_token IS NOT NULL` rows, POST to Expo push API)

Apply verbatim with one adaptation: the master plan's `expo-notifications` permission handling is correct for SDK 54.

---

## Acceptance gates

```bash
cd mobile && npx tsc --noEmit
```
0 errors.

```bash
npx supabase migration list --linked
```
Both new migrations show as Local-only (push on merge).

```bash
npx supabase db push --linked --dry-run --yes
```
Lists exactly the two new migrations.

```bash
deno check supabase/functions/send_push_notification/index.ts
```
0 errors.

**Manual smoke test (physical device — iOS Simulator can't deliver push):**
1. Settings → Notifications → toggle Push on → grant permission.
2. Verify `select * from push_subscriptions where user_id = '<id>'` shows a row with `expo_push_token` populated, `platform = 'ios'` (or `android`), `device_id` set.
3. Toggle individual prefs (e.g. "Weekly digest") — verify `profiles.notification_prefs` JSONB updates.
4. From web admin or Supabase SQL editor, manually invoke `send_push_notification` with title/body/url. **Expected on Apple Dev:** notification arrives in foreground (banner) and background (system tray). **Without Apple Dev:** Expo push API responds with `{ status: "error", details: { error: "DeviceNotRegistered" }}` for iOS — that's expected and verified at M13. Android Firebase delivery should still work even without Apple Dev.
5. Tap notification while app backgrounded → app opens to URL in `data.url` (or home if missing).

**Code-reviewer subagent:** mandatory.

---

## Deploy commands (post-merge)

```bash
npx supabase db push --linked --yes
npx supabase functions deploy send_push_notification --project-ref khvkwojtlkcvxjxztduj --no-verify-jwt
```

---

## PR template

**Title:** `feat(mobile): M5 — push notifications mobile-side + Expo send branch`

**Body sections:** Problem (no Expo registration path; existing web-push only). Fix (usePushNotifications + 2 migrations + Settings wiring + Expo branch in send_push). Verification above. Out of scope: live iOS APNs delivery verification (deferred to M13; needs Apple Dev). Findings: log "M13: verify APNs delivery on TestFlight build" to findings-log.md.

---

## Tracker updates (in this PR)

- mobile-launch-overview.md: M5 → DONE (with note "APNs verify deferred to M13"), pointer → **M7** (skipping M6 BLOCKED).
- completion-log.md: append M5.
- CLAUDE.md root: CURRENT WAVE → `Mobile Launch M7 — i18n Swedish + English`.
