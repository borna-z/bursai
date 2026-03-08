

## Backend Analysis & Fix Plan

### Issues Found

**1. Google Calendar Sync — Token Revoked (Primary Error)**
The `sync_google_calendar` function returns 500 with `"Token refresh failed"`. The Google refresh token has been revoked/expired (`invalid_grant`). The code handles this as a generic error but doesn't tell the user to reconnect. Fix: when token refresh fails, auto-delete the stale connection and return a clear error code so the UI can prompt re-authentication instead of showing a cryptic error.

**2. CORS Headers Incomplete on 9 Edge Functions**
Many functions use the short CORS header list (`authorization, x-client-info, apikey, content-type`) while the Supabase JS client v2.91 sends additional headers (`x-supabase-client-platform`, etc.). This can cause CORS preflight failures on some browsers. Functions needing the fix:
- `sync_calendar`
- `sync_google_calendar`
- `google_calendar_auth`
- `create_checkout_session`
- `create_portal_session`
- `restore_subscription`
- `suggest_outfit_combinations`
- `import_garments_from_links`
- `analyze_garment`
- `sync_all_calendars`

**3. sync_google_calendar — No Graceful Reconnect Flow**
When the refresh token is invalid, the function should delete the stale `calendar_connections` row and return a `401` with `reconnect_required: true` so the client knows to show a "Reconnect Google Calendar" prompt instead of a generic error toast.

### Plan

1. **Fix CORS headers** on all 10 edge functions — update to the full header list.

2. **Improve token-revoked handling in `sync_google_calendar`**:
   - When `refreshAccessToken` fails, delete the stale connection from `calendar_connections` using service role client.
   - Return `{ error: "reconnect_required", reconnect: true }` with status 401 instead of 500.

3. **Update client-side `useCalendarSync`**:
   - In `syncGoogleMutation.onError`, check if the error indicates reconnect is required.
   - Show a specific toast with an action button to reconnect Google Calendar instead of a generic error.

4. **Deploy all updated edge functions** to apply changes immediately.

### Files to Edit
- `supabase/functions/sync_google_calendar/index.ts` — CORS + reconnect logic
- `supabase/functions/google_calendar_auth/index.ts` — CORS
- `supabase/functions/sync_calendar/index.ts` — CORS
- `supabase/functions/sync_all_calendars/index.ts` — CORS
- `supabase/functions/create_checkout_session/index.ts` — CORS
- `supabase/functions/create_portal_session/index.ts` — CORS
- `supabase/functions/restore_subscription/index.ts` — CORS
- `supabase/functions/suggest_outfit_combinations/index.ts` — CORS
- `supabase/functions/import_garments_from_links/index.ts` — CORS
- `supabase/functions/analyze_garment/index.ts` — CORS
- `src/hooks/useCalendarSync.ts` — handle reconnect error gracefully

