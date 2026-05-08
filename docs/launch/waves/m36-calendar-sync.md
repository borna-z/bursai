# M36 — Calendar sync (Google OAuth + useCalendarSync)

| Field | Value |
|---|---|
| Goal | Optional Google Calendar sync so M15 day intelligence reads real upcoming events for occasion classification. |
| Status | DONE (PR #772) |
| Branch | `mobile-m36-calendar-sync` |
| PR count | 1 |
| Depends on | V0 |
| Complexity | M |

## Background

`google_calendar_auth` + `calendar` edge functions deployed (web uses them). The token exchange happens in the edge function; mobile just initiates OAuth + reads back synced events from `calendar_events`.

## Files touched

### New
- `mobile/src/hooks/useCalendarSync.ts` — connect/disconnect actions; reads `calendar_events` for the next 7 days.
- `mobile/src/screens/SettingsAccountScreen.tsx` — "Connect Google Calendar" row with status toggle.

### Modified
- `mobile/src/hooks/useSmartDayRecommendation.ts` (from M15) — when calendar synced, feed the next event's title + start time into `dayIntelligence` for sharper occasion classification.
- `mobile/src/lib/i18n.ts` — append `settings.calendar.*` keys.

## Pattern reference

OAuth flow uses `expo-auth-session/providers/google`; redirect to a deep-link route that posts the auth code to `google_calendar_auth`. Token storage stays server-side.

## Acceptance gates

- TypeScript: 0 errors
- V0 CI gates: all green
- Manual on EAS dev build: tap "Connect Google Calendar" → consent screen opens → return to app → confirm next event title appears in M15 day suggestion
- Code-reviewer: approved

## Deploy

None — both edge functions already deployed.

## PR template

Title: `feat(mobile): M36 — calendar sync`
