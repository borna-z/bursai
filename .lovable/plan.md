

# Fix Google Calendar OAuth `redirect_uri_mismatch`

## Root Cause
The app uses `window.location.origin` to build the redirect URI. In preview/dev this produces `https://id-preview--...lovable.app/calendar/callback`, which doesn't match what's registered in Google Cloud Console (`https://burs.me/calendar/callback`). Google rejects the mismatch with a 400 error.

## Changes

### 1. Hardcode redirect URI in `useCalendarSync.ts` (line 145)
Replace `window.location.origin` with the production URI constant `https://burs.me/calendar/callback`. This ensures the same URI is sent in both the auth URL request and the token exchange.

### 2. Hardcode redirect URI in `GoogleCalendarCallback.tsx` (line 37)
Same fix — the callback page currently sends `window.location.origin` during code exchange. Change to `https://burs.me/calendar/callback`.

### 3. Reduce scopes in `google_calendar_auth/index.ts` (lines 20-23)
Remove `calendar.readonly`, keep only `calendar.events.readonly` as requested.

### 4. Hardcode redirect URI in `CalendarConnectBanner.tsx` (not critical but consistent)
The plan connect banner also builds the URI dynamically. Align it.

## No new tables, edge functions, or routes needed
The existing `calendar_connections` table, `google_calendar_auth` edge function, `sync_google_calendar` edge function, and `/calendar/callback` route already handle the full flow correctly. The only bug is the dynamic redirect URI.

## Technical Detail
Google OAuth requires the `redirect_uri` sent during authorization to exactly match the one sent during token exchange, AND both must be registered in Google Cloud Console. By hardcoding `https://burs.me/calendar/callback` we satisfy all three constraints.

