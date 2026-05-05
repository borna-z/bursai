## Wave 1 — Security (launch-blocking)

### P1 — Auth gaps in summarize_day + process_job_queue + daily_reminders

**Problem**
- `supabase/functions/summarize_day/index.ts` — creates `serviceClient` directly without `getUser()`. Any authenticated caller can POST with arbitrary `events_cache_key` and read any user's calendar summary.
- `supabase/functions/process_job_queue/index.ts` — `serve()` has no auth check. Exposed HTTP endpoint accepts any caller to trigger job processing.
- `supabase/functions/daily_reminders/index.ts` — same pattern. Exposed endpoint sends push notifications without auth.

**Fix**
For all three files, add auth at top of handler (inside try, after CORS preflight):

For user-facing endpoints (`summarize_day`):
```typescript
const authHeader = req.headers.get("Authorization");
if (!authHeader?.startsWith("Bearer ")) {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}
const token = authHeader.replace("Bearer ", "");
const userClient = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_ANON_KEY")!,
  { global: { headers: { Authorization: authHeader } } },
);
const { data: { user }, error: userError } = await userClient.auth.getUser(token);
if (userError || !user) {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}
const userId = user.id;
// ... rest uses userId, not req body user_id
```

For cron-only endpoints (`process_job_queue`, `daily_reminders`):
**HARD-REJECT any caller that isn't the service role.** No JWT fallback. These endpoints should never be callable by end-users — `process_job_queue` grants service-role access to write any user's job state, and `daily_reminders` sends push notifications to every subscribed user. A fallback that lets authenticated users through enables DoS against the queue and notification-storm attacks.

> Historical context: an earlier version of this spec included an `if (!isServiceRole) { require user JWT }` fallback copied from the `summarize_day` pattern. Codex rejected this on PR #643 for exactly that reason. Hard-reject is the final shipped pattern across both functions. When future prompts harden other cron-only endpoints (e.g., P7 on `process_job_queue` handlers), copy the hard-reject pattern below — NOT the user-facing pattern above.

```typescript
import { timingSafeEqual } from "../_shared/timing-safe.ts";

const authHeader = req.headers.get("Authorization");
const token = authHeader?.replace("Bearer ", "") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
if (!token || !serviceRoleKey || !timingSafeEqual(token, serviceRoleKey)) {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}
// Cron confirmed as caller — proceed with service-role client for service-level reads/writes
```

Rule of thumb for which pattern to use on a new endpoint:
- **User-facing** (client calls via `supabase.functions.invoke()`): use the `summarize_day` pattern above — `getUser(token)` against anon-key client.
- **Cron-only** (invoked only by pg_cron with service-role Bearer): use the hard-reject pattern here — `timingSafeEqual(token, SERVICE_ROLE_KEY)` and nothing else.
- **Dual-mode** (both user-facing and cron): use `timingSafeEqual` as a fast-path service-role bypass ABOVE the user JWT check, so cron takes the short path and end-users still work. P4's `prefetch_suggestions` is an example, though P4 only touched the user-facing branch.

**Files**
- `supabase/functions/summarize_day/index.ts`
- `supabase/functions/process_job_queue/index.ts`
- `supabase/functions/daily_reminders/index.ts`

**Reference pattern** (do not edit)
- `supabase/functions/detect_duplicate_garment/index.ts` lines 13-35 for user-auth pattern
- `supabase/functions/process_render_jobs/index.ts` for service-role pattern via `timingSafeEqual`

**Acceptance**
- Unauthenticated POST to each endpoint returns 401 JSON
- User A's JWT cannot be used to summarize User B's day
- Cron scheduler (using service-role Bearer) still triggers `process_job_queue` and `daily_reminders` successfully
- `summarize_day` uses `user.id` for all queries, ignores any `user_id` in request body

**Deploy**
```bash
npx supabase functions deploy summarize_day --project-ref khvkwojtlkcvxjxztduj --no-verify-jwt
npx supabase functions deploy process_job_queue --project-ref khvkwojtlkcvxjxztduj --no-verify-jwt
npx supabase functions deploy daily_reminders --project-ref khvkwojtlkcvxjxztduj --no-verify-jwt
```

---

### P2 — Remove anon-key bypass in calendar sync_all

**Problem**
`supabase/functions/calendar/index.ts` `handleSyncAll` (~line 383-389) accepts EITHER the anon key OR the service-role key as valid auth. The anon key is public (embedded in frontend). Any caller with it can trigger a global sync, DoS'ing Google Calendar API and burning quota.

**Fix**
Change the auth check in `handleSyncAll` to service-role-only:
```typescript
async function handleSyncAll(authHeader: string): Promise<Response> {
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const providedKey = authHeader.replace('Bearer ', '');

  // Service-role only (use timingSafeEqual to prevent timing attacks)
  if (!timingSafeEqual(providedKey, serviceRoleKey)) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }
  // ... rest unchanged
}
```
Import `timingSafeEqual` from `../_shared/timing-safe.ts`.

**Files**
- `supabase/functions/calendar/index.ts`

**Acceptance**
- Anon key Bearer → 401
- Service-role key Bearer → works
- Cron scheduler continues to trigger `sync_all` (verify cron body uses service-role)

**Deploy** `npx supabase functions deploy calendar --project-ref khvkwojtlkcvxjxztduj --no-verify-jwt`

---

### P3 — OAuth hardening in google_calendar_auth

**Problem**
`supabase/functions/google_calendar_auth/index.ts`:
- `redirect_uri` (line 36) comes from request body, sent to Google verbatim. No allowlist check → attacker can phish users to a lookalike domain via crafted auth URL.
- `state: user.id` (line 68) is predictable. No CSRF token means a malicious site could link victim's Google Calendar to attacker's BURS account.

**Fix**
1. Add `ALLOWED_REDIRECT_URIS` constant at top of file:
```typescript
const ALLOWED_REDIRECT_URIS = [
  'https://app.burs.me/calendar/callback',
  'https://burs.me/calendar/callback',
  'http://localhost:8080/calendar/callback',
];
// Allow environment-configured extras for preview deployments
const envExtras = (Deno.env.get('ALLOWED_CALENDAR_REDIRECT_URIS') || '').split(',').map(s => s.trim()).filter(Boolean);
const ALL_ALLOWED = new Set([...ALLOWED_REDIRECT_URIS, ...envExtras]);
```
In both `get_auth_url` and `exchange_code` handlers, reject if `redirect_uri` not in `ALL_ALLOWED`:
```typescript
if (!ALL_ALLOWED.has(redirect_uri)) {
  return new Response(JSON.stringify({ error: 'redirect_uri not allowed' }), {
    status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}
```

2. Replace `state: user.id` with signed CSRF token:
```typescript
// At get_auth_url: generate CSRF token, store in DB with 10-min TTL
const csrfToken = crypto.randomUUID();
await serviceClient.from('oauth_csrf').insert({
  token: csrfToken, user_id: user.id, expires_at: new Date(Date.now() + 600_000).toISOString(),
});
const state = `${user.id}.${csrfToken}`;
```
```typescript
// At exchange_code: verify token
const [stateUserId, stateCsrf] = (body.state || '').split('.');
if (stateUserId !== user.id) return 401;
const { data: csrfRow } = await serviceClient.from('oauth_csrf')
  .select('token, expires_at').eq('token', stateCsrf).eq('user_id', user.id).single();
if (!csrfRow || new Date(csrfRow.expires_at) < new Date()) return 401;
await serviceClient.from('oauth_csrf').delete().eq('token', stateCsrf); // one-use
```

3. Client-side: `src/pages/GoogleCalendarCallback.tsx` passes `state` from URL back to `exchange_code` body.

4. New migration: `oauth_csrf` table
```sql
CREATE TABLE oauth_csrf (
  token UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX ON oauth_csrf (expires_at);
-- Cleanup cron (every hour)
SELECT cron.schedule('oauth_csrf_cleanup', '0 * * * *', $$DELETE FROM oauth_csrf WHERE expires_at < NOW()$$);
```

**Files**
- `supabase/functions/google_calendar_auth/index.ts`
- `src/pages/GoogleCalendarCallback.tsx`
- new migration `supabase/migrations/<ts>_oauth_csrf.sql`

**Acceptance**
- Unlisted `redirect_uri` returns 400
- Request with missing/mismatched state returns 401
- Request with expired CSRF token returns 401
- Replaying a successful state (one-use) returns 401
- Happy path still connects Google Calendar

**Deploy** `npx supabase functions deploy google_calendar_auth --project-ref khvkwojtlkcvxjxztduj --no-verify-jwt` + `npx supabase db push --linked --yes`

---

### P4 — prefetch_suggestions single-user-trigger identity check

**Problem**
`supabase/functions/prefetch_suggestions/index.ts` lines 105-121: if POST body contains `{user_id, trigger: "first_5_garments"}`, processes that user without verifying caller identity. Any authenticated caller can trigger AI work for ANY user, draining their cache quota.

**Fix**
Add auth check in the `triggeredUserId` branch:
```typescript
if (triggeredUserId) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
  const token = authHeader.replace("Bearer ", "");
  const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error } = await userClient.auth.getUser(token);
  if (error || !user || user.id !== triggeredUserId) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
  // proceed with processSingleUser(triggeredUserId, supabase)
}
```

Leave the cron-mode branch (no body, or no `trigger`) as-is — it already runs service-role only from pg_cron.

**Files**
- `supabase/functions/prefetch_suggestions/index.ts`

**Acceptance**
- POST `{user_id: otherUser, trigger: "first_5_garments"}` with User A's JWT → 403
- POST `{user_id: self, trigger: "first_5_garments"}` with matching JWT → 200
- Cron with service-role (no body) → 200, batch mode

**Deploy** `npx supabase functions deploy prefetch_suggestions --project-ref khvkwojtlkcvxjxztduj --no-verify-jwt`

---

### P5 — Email domain fix: hello@bursai.com → hello@burs.me

**Problem**
Two edge functions hardcode the wrong domain for push notification contact:
- `supabase/functions/send_push_notification/index.ts` — `mailto:hello@bursai.com`
- `supabase/functions/daily_reminders/index.ts` line ~50 — `mailto:hello@bursai.com`

Both are used as the `subject` parameter to `webpush.setVapidDetails()`. Apple/Firefox push services require a contactable `mailto:` or URL; using the wrong domain means push-service-level issues cannot be routed to the actual BURS team.

**Fix**
Grep-replace `hello@bursai.com` with `hello@burs.me` in both files (2 occurrences total).

**Files**
- `supabase/functions/send_push_notification/index.ts`
- `supabase/functions/daily_reminders/index.ts`

**Acceptance**
- No occurrences of `bursai.com` remain in `supabase/functions/` (verify with grep)
- Push notifications still send successfully (smoke test)

**Deploy**
```bash
npx supabase functions deploy send_push_notification --project-ref khvkwojtlkcvxjxztduj --no-verify-jwt
npx supabase functions deploy daily_reminders --project-ref khvkwojtlkcvxjxztduj --no-verify-jwt
```

---

### P6 — Outfit ownership check in suggest_accessories

**Problem**
`supabase/functions/suggest_accessories/index.ts`: the `outfit_id` in the request body is fetched via `serviceClient.from("outfit_items").select(...).eq("outfit_id", outfit_id)` — bypasses RLS, no ownership verification. Any authenticated user can pass another user's outfit_id and get AI suggestions based on it.

**Fix**
Before the parallel query block, verify outfit belongs to user:
```typescript
const { data: outfitRow, error: outfitError } = await serviceClient
  .from("outfits")
  .select("id")
  .eq("id", outfit_id)
  .eq("user_id", user.id)
  .maybeSingle();

if (outfitError || !outfitRow) {
  return new Response(JSON.stringify({ error: "Outfit not found" }), {
    status: 404, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}
```
Use single query filter (id AND user_id) to collapse "not yours" vs "doesn't exist" into one 404 — prevents enumeration oracle.

**Files**
- `supabase/functions/suggest_accessories/index.ts`

**Acceptance**
- User A requests accessories for User B's outfit_id → 404
- User requests for own outfit → 200 with suggestions
- Invalid UUID → 404 (or 400 if you add UUID validation — both acceptable)

**Deploy** `npx supabase functions deploy suggest_accessories --project-ref khvkwojtlkcvxjxztduj --no-verify-jwt`

---

### P7 — Cross-user validation in process_job_queue handlers

**Problem**
`supabase/functions/process_job_queue/index.ts` handlers (`handleGarmentEnrichment`, `handleImageProcessing`, `handleBatchAnalysis`) receive `payload.garment_id` and operate on it without verifying `job.user_id` matches the garment's `user_id`. A malicious job submission (if submitJob is ever callable by users) could target any garment.

**Fix**
At the top of each handler that operates on a `garment_id`, add ownership check:
```typescript
async function handleGarmentEnrichment(supabase: any, payload: Record<string, unknown>, userId: string | null): Promise<Record<string, unknown>> {
  const garmentId = payload.garment_id as string;
  if (!garmentId) throw new Error("Missing garment_id");
  if (!userId) throw new Error("Missing user_id on job");

  // NEW: verify ownership
  const { data: garment, error } = await supabase
    .from("garments")
    .select("id, user_id, image_path, enrichment_status")
    .eq("id", garmentId)
    .eq("user_id", userId)     // cross-user guard
    .single();

  if (error || !garment) throw new Error(`Garment not found or not owned: ${garmentId}`);
  // ... rest unchanged
}
```
Repeat for `handleImageProcessing`.

Also tighten `submitJob` in `_shared/scale-guard.ts` to always require `userId` (currently optional).

**Files**
- `supabase/functions/process_job_queue/index.ts`
- `supabase/functions/_shared/scale-guard.ts` (tighten submitJob signature)

**Acceptance**
- Job with mismatched user_id vs garment's user_id → fails gracefully (logged as "Garment not found or not owned")
- Normal enrichment flow unchanged

**Deploy**
```bash
npx supabase functions deploy process_job_queue --project-ref khvkwojtlkcvxjxztduj --no-verify-jwt
# Plus redeploy every function that calls submitJob — check with:
#   grep -rl "submitJob" supabase/functions/
```

---

### P8 — Complete delete_user_account cascade

**Problem**
`supabase/functions/delete_user_account/index.ts` deletes from 8 tables but leaves orphaned rows in 12 more. Deleted user's data persists indefinitely, violating GDPR right-to-erasure.

Tables currently NOT cleared (from `list_tables` + audit):
- `garment_pair_memory`
- `feedback_signals`
- `analytics_events`
- `chat_messages`
- `outfit_feedback`
- `push_subscriptions`
- `render_jobs`
- `render_credits`
- `render_credit_transactions`
- `travel_capsules`
- `ai_response_cache` (rows matching the user — see L554 note below; pre-L554 the column didn't exist)
- `ai_rate_limits`

**Fix**
In `delete_user_account/index.ts`, add DELETE calls for all 12 tables BEFORE the final `auth.admin.deleteUser()`. Group logically:

```typescript
// AI / analytics
await adminClient.from("chat_messages").delete().eq("user_id", userId);
await adminClient.from("feedback_signals").delete().eq("user_id", userId);
await adminClient.from("garment_pair_memory").delete().eq("user_id", userId);
await adminClient.from("analytics_events").delete().eq("user_id", userId);
await adminClient.from("ai_rate_limits").delete().eq("user_id", userId);

// Render pipeline
await adminClient.from("render_credit_transactions").delete().eq("user_id", userId);
await adminClient.from("render_jobs").delete().eq("user_id", userId);
await adminClient.from("render_credits").delete().eq("user_id", userId);

// Feedback / social
await adminClient.from("outfit_feedback").delete().eq("user_id", userId);

// Notifications
await adminClient.from("push_subscriptions").delete().eq("user_id", userId);

// Travel
await adminClient.from("travel_capsules").delete().eq("user_id", userId);

// ai_response_cache — shipped via L554 (PR #659, Wave 2-C): nullable `user_id`
// column + partial index, populated by `storeCache` in `_shared/burs-ai.ts`
// for every user-scoped call. FK cascade on `auth.users.id ON DELETE CASCADE`
// handles the row cleanup automatically when `auth.admin.deleteUser()` runs
// below. The explicit `.eq("user_id", userId).delete()` line is kept here as
// belt-and-suspenders so cleanup is independent of cascade ordering:
await adminClient.from("ai_response_cache").delete().eq("user_id", userId);
//
// Historical context (for future maintainers): pre-L554, the table had no
// `user_id` column and `cache_key` was a SHA-256 hash that destroyed any
// user-id substring, so neither `.like("cache_namespace", ...)` (column
// never existed) nor `.like("cache_key", ...)` (hashed away) could match
// any rows. PR #652 shipped a TTL-decay mitigation comment; PR #659 added
// the `user_id` column + index and redeployed all 22 AI functions. See
// CLAUDE.md Findings Log (2026-04-21 P8) + Completion Log (PR #659 L554)
// for the full writeup.
```

Order matters only where there are FK constraints. `render_credit_transactions` references `render_jobs` → delete transactions first (already done above). Verify with `list_tables` foreign-key info if uncertain.

**Files**
- `supabase/functions/delete_user_account/index.ts`

**Acceptance**
- After `delete_user_account`, no rows with `user_id = deletedUser` remain in any of the 11 physically-cleanable tables (verify with a SQL probe post-delete). `ai_response_cache` is exempt per the note above — its rows decay via TTL.
- FK constraints don't fire (if they do, reorder)
- Profile + auth.users delete still succeed at end

**Deploy** `npx supabase functions deploy delete_user_account --project-ref khvkwojtlkcvxjxztduj --no-verify-jwt`

---

