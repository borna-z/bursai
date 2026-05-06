# M30 — Push notifications + Expo send branch

| Field | Value |
|---|---|
| Goal | Register Expo push token on auth, expose notification preferences in Settings, add Expo branch to `send_push_notification` edge function. |
| Status | TODO |
| Branch | `mobile-m30-push` |
| PR count | 1 |
| Depends on | V0 |
| Complexity | L |

## Background

Web uses VAPID web push. Mobile uses Expo Push (APNs/FCM under the hood). Schema needs columns to differentiate token types. Live APNs verification waits on M43 Apple Developer setup, but all code can land now.

## Files touched

### New
- `mobile/src/hooks/usePushNotifications.ts` — `Notifications.getExpoPushTokenAsync` on grant; persist to `push_subscriptions` with `provider='expo'`.
- Migration: `supabase/migrations/<ts>_push_provider_columns.sql` — `ALTER TABLE push_subscriptions ADD COLUMN provider text NOT NULL DEFAULT 'web', ADD COLUMN expo_token text`. Backfill `provider='web'` for existing rows.
- Migration: `<ts>_profiles_notification_prefs.sql` — `ALTER TABLE profiles ADD COLUMN notification_prefs jsonb NOT NULL DEFAULT '{"daily":true,"new_outfit":true,"reminders":true}'::jsonb`.

### Modified
- `mobile/App.tsx` — register notification handler; deep-link from notification → screen.
- `mobile/src/screens/SettingsNotificationsScreen.tsx` — toggles bound to `profiles.notification_prefs`.
- `supabase/functions/send_push_notification/index.ts` — branch on `provider` column: `web` → existing VAPID; `expo` → POST to `https://exp.host/--/api/v2/push/send`.

## Pattern reference

Expo notifications docs. Webhook-style send pattern lifts cleanly from `web-push` to Expo's REST endpoint.

## Acceptance gates

- TypeScript: 0 errors
- V0 CI gates: all green (migration smoke check passes)
- Manual on EAS dev build: grant permissions → confirm token row in `push_subscriptions` with `provider='expo'`; trigger a test push from edge function → confirm device receives it
- Code-reviewer: approved

## Deploy

```bash
npx supabase db push --linked --yes
npx supabase functions deploy send_push_notification --project-ref khvkwojtlkcvxjxztduj --no-verify-jwt
```

## PR template

Title: `feat(mobile): M30 — push notifications + Expo branch`
