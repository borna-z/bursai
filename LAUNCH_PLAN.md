# BURS Launch Plan — Detailed Prompt Specs

Full executable spec for every prompt referenced by CLAUDE.md's Launch Plan section.

**How to use this file**
1. CLAUDE.md's `CURRENT PROMPT` pointer tells you which prompt to execute.
2. Jump to the matching `### P<id>` heading below.
3. Follow the spec exactly. Follow the Fix Protocol in CLAUDE.md.
4. Do NOT read other prompts' sections — that wastes context.

**Spec structure per prompt**
- **Problem** — exact bug with file references
- **Fix** — concrete steps
- **Files** — paths to edit (absolute under repo root)
- **Reference** — pattern to copy from, if applicable
- **Acceptance** — what "done" means
- **Deploy** — edge functions to redeploy after merge

---

## Wave 0 — Safety Net (do first)

### P0a — Husky pre-commit hook

**Problem**
No local enforcement of tsc/eslint/build. Broken code can be committed. CI catches it later; waste cycles.

**Fix**
1. Ask user permission: "`npm install --save-dev husky` adds one devDep — approve?"
2. `npm install --save-dev husky`
3. `npx husky init` (creates `.husky/pre-commit` with `npm test` placeholder + adds `prepare` script to package.json)
4. Replace `.husky/pre-commit` contents with:
   ```bash
   #!/usr/bin/env sh
   npx tsc --noEmit --skipLibCheck || exit 1
   npx eslint src/ --ext .ts,.tsx --max-warnings 0 || exit 1
   npm run build || exit 1
   ```
5. Test: `git commit --allow-empty -m "test husky"` — must run all three checks.

**Files**
- `package.json` — new `devDependencies.husky` + `scripts.prepare: "husky"`
- `.husky/pre-commit` — new
- `.gitignore` — add `.husky/_` if not already

**Acceptance**
- `git commit` locally fails if tsc/eslint/build fail
- Fresh clone + `npm install` auto-installs hooks via `prepare`
- No warnings on a clean commit

**Deploy** None.

---

### P0b — GitHub Actions CI workflow

**Problem**
No remote enforcement. A PR can be merged without running tsc/eslint/build/tests.

**Fix**
Create `.github/workflows/ci.yml`:
```yaml
name: CI
on:
  pull_request:
    branches: [main]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npx tsc --noEmit --skipLibCheck
      - run: npx eslint src/ --ext .ts,.tsx --max-warnings 0
      - run: npm run build
      - run: npx vitest run
```
Then in GitHub repo Settings → Branches → add rule for `main` requiring the `check` job to pass.

**Files**
- `.github/workflows/ci.yml` — new

**Acceptance**
- Opening a PR triggers the workflow
- Workflow passes on a clean diff
- Workflow fails with intentionally-broken code
- `main` branch rule blocks merge until `check` is green (requires user to configure in GitHub UI — document in PR body)

**Deploy** None.

---

### P0c — Verify Fix Protocol is in CLAUDE.md

**Problem**
Fix Protocol was added in the Launch Plan baseline PR, but needs a wording pass once we've executed a few prompts and know what's friction.

**Fix**
After completing Wave 1 (at least P1-P3), re-read the Fix Protocol section of CLAUDE.md. Adjust based on real experience:
- Which steps were skipped or forgotten? Tighten wording.
- Which subagent invocations were helpful vs wasteful? Refine.
- Any new hard rules to promote from "common sense" to "documented"?

**Files**
- `CLAUDE.md` — Fix Protocol section only

**Acceptance**
- No contradictions in the protocol
- Every step is enforceable by a fresh agent who hasn't seen prior sessions
- User sign-off on wording

**Deploy** None.

---

### P0d — Integration smoke tests

**Problem**
30% line coverage threshold isn't enough to catch regressions. No tests exist for end-to-end user flows. A refactor in any Wave 1-10 can silently break a critical path.

**Fix**
Create 10 smoke tests under `src/test/smoke/`. Each test:
1. Creates a test user via Supabase admin client
2. Runs the flow
3. Asserts response shape
4. Tears down user

Flows (one test each):
1. `signup.test.ts` — create user, verify profile row exists, verify default preferences
2. `garment-add.test.ts` — upload garment image, call `analyze_garment`, verify title/category returned
3. `enrichment.test.ts` — submit garment_enrichment job, poll until complete, verify `ai_raw` populated
4. `render.test.ts` — call `enqueue_render_job`, poll render_jobs until `status='succeeded'`, verify `rendered_image_path` set
5. `outfit-generate.test.ts` — call `generate_outfit` with 10 seed garments, verify complete outfit (top+bottom+shoes or dress+shoes)
6. `outfit-refine.test.ts` — create outfit, call style_chat refine, verify swap happened
7. `plan-week.test.ts` — create 7 planned_outfits, verify query by date range works
8. `visual-search.test.ts` — upload image, call `visual_search`, verify matches returned
9. `shopping-chat.test.ts` — send message, stream response, verify final payload shape
10. `travel-capsule.test.ts` — build capsule for 5-day trip, verify `capsule_items` + `outfits[]` both populated

Each test uses `SUPABASE_SERVICE_ROLE_KEY_TEST` env var. Runs in CI as part of P0b (add `npx vitest run src/test/smoke` step).

**Files**
- `src/test/smoke/*.test.ts` (10 new files)
- `src/test/smoke/harness.ts` (new — shared setup/teardown helpers)

**Acceptance**
- All 10 tests pass against current main
- Tests run in CI
- Failure in any test blocks PR merge

**Deploy** None.

---

### P0e — Migration drift check in CI

**Problem**
`supabase/migrations/` and remote `schema_migrations` can drift. Drift breaks `npx supabase db push` and forces MCP workarounds. Currently no automated drift detection.

**Fix**
Add two steps to `.github/workflows/ci.yml`, conditional on any file under `supabase/migrations/` changing:
```yaml
      - name: Check migration drift
        if: contains(steps.files.outputs.all_changed_files, 'supabase/migrations/')
        run: |
          npx supabase migration list --linked | tee migration_list.txt
          ! grep -E '^\s+20' migration_list.txt | grep -v -E '\|\s+20' || (echo "DRIFT DETECTED" && exit 1)
          npx supabase db push --linked --dry-run --yes
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
          SUPABASE_DB_PASSWORD: ${{ secrets.SUPABASE_DB_PASSWORD }}
```

The grep logic: any row from `migration list --linked` that has a timestamp in the `Local` column but nothing in `Remote` (or vice versa) = drift. The row format is `<local_ts> | <remote_ts> | <applied_at>`. If local exists without remote AND it's not a new migration introduced by this PR, it's drift.

**Files**
- `.github/workflows/ci.yml`
- `.github/dependabot.yml` (optional — add supabase-cli version pin)

**Acceptance**
- PRs that touch migrations trigger the drift check
- PRs without migration changes skip the drift check
- Drift blocks merge

**Deploy** None.

---

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

For cron-style endpoints (`process_job_queue`, `daily_reminders`):
Also accept service-role key via `timingSafeEqual`:
```typescript
import { timingSafeEqual } from "../_shared/timing-safe.ts";

const providedKey = authHeader.replace("Bearer ", "");
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const isServiceRole = timingSafeEqual(providedKey, serviceKey);

if (!isServiceRole) {
  // require user JWT (same pattern as summarize_day)
  const { data: { user }, error } = await userClient.auth.getUser(providedKey);
  if (error || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
}
```

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
- `ai_response_cache` (rows where `cache_namespace` contains user_id)
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

// Cache — only rows scoped to this user (namespace contains user_id)
await adminClient.from("ai_response_cache").delete()
  .like("cache_namespace", `%${userId}%`);
```

Order matters only where there are FK constraints. `render_credit_transactions` references `render_jobs` → delete transactions first (already done above). Verify with `list_tables` foreign-key info if uncertain.

**Files**
- `supabase/functions/delete_user_account/index.ts`

**Acceptance**
- After `delete_user_account`, no rows with `user_id = deletedUser` remain in any of the 12 tables (verify with a SQL probe post-delete)
- FK constraints don't fire (if they do, reorder)
- Profile + auth.users delete still succeed at end

**Deploy** `npx supabase functions deploy delete_user_account --project-ref khvkwojtlkcvxjxztduj --no-verify-jwt`

---

## Wave 2 — Rate Limiting & Idempotency

### P9 — Add rate limit + overload to 14 functions

**Problem**
These 14 functions lack `enforceRateLimit` + `checkOverload`, leaving them open to abuse:
`import_garments_from_links`, `insights_dashboard`, `seed_wardrobe`, `send_push_notification`, `restore_subscription`, `create_portal_session`, `delete_user_account`, `calendar`, `google_calendar_auth`, `daily_reminders`, `process_job_queue`, `process_garment_image` (being removed in P15), `generate_outfit`, `cleanup_ai_cache`.

**Fix**
For each user-facing function, add at top of handler (after auth):
```typescript
import { enforceRateLimit, RateLimitError, rateLimitResponse, checkOverload, overloadResponse } from "../_shared/scale-guard.ts";

// After CORS preflight:
if (checkOverload("<function_name>")) {
  return overloadResponse(CORS_HEADERS);
}

// After user auth (have user.id):
await enforceRateLimit(serviceClient, user.id, "<function_name>");
```

Wrap the whole try/catch to convert `RateLimitError` to 429:
```typescript
} catch (e) {
  if (e instanceof RateLimitError) return rateLimitResponse(e, CORS_HEADERS);
  // ... existing error handling
}
```

For each function, also add a tier entry to `RATE_LIMIT_TIERS` in `_shared/scale-guard.ts`. Suggested tiers:
- `import_garments_from_links`: 10/hour, 2/minute (expensive, scraping)
- `insights_dashboard`: 60/hour, 15/minute (8 parallel queries)
- `seed_wardrobe`: 5/hour, 1/minute (destructive option exists)
- `send_push_notification`: 30/hour, 10/minute
- `restore_subscription`: 10/hour, 2/minute (Stripe API calls)
- `create_portal_session`: 10/hour, 2/minute
- `delete_user_account`: 3/hour, 1/minute (one-way action)
- `calendar`: 30/hour, 10/minute (sync calls)
- `google_calendar_auth`: 10/hour, 2/minute
- `daily_reminders` / `process_job_queue` / `cleanup_ai_cache`: skip user rate limit (service-role cron), keep overload check only
- `generate_outfit`: 30/hour, 5/minute (matches burs_style_engine — they call each other)

For cron-style endpoints, skip `enforceRateLimit` but keep `checkOverload`.

**Files**
- 14 edge function `index.ts` files
- `supabase/functions/_shared/scale-guard.ts` (RATE_LIMIT_TIERS)

**Reference pattern** (do not edit)
- `supabase/functions/detect_duplicate_garment/index.ts` — canonical user-facing rate-limit pattern

**Acceptance**
- Each function returns 429 when limit exceeded
- Each function returns 503 when circuit breaker tripped
- Cron functions don't 429 legitimate service-role callers
- `RATE_LIMIT_TIERS` covers all 14

**Deploy**
Deploy each function individually (14 commands). This is a large PR but each deploy is isolated. Consider batching this prompt into 2-3 sessions (5 functions per session) to keep deploys manageable.

---

### P10 — UUID validation in PublicProfile + ShareOutfit

**Problem**
- `src/pages/PublicProfile.tsx` line ~67: `username` from URL passed verbatim to `.eq('username', username)`. Username isn't a UUID but should be validated (alphanumeric, length cap) to prevent injection attempts in RLS logs.
- `src/pages/ShareOutfit.tsx` line ~69: `id` from URL passed to `.eq('id', id)` without UUID validation. A non-UUID string triggers Postgres error leak.

**Fix**
Add lightweight validators at the top of each component's fetch effect:
```typescript
function isUuid(v: string | undefined): boolean {
  return typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

function isValidUsername(v: string | undefined): boolean {
  return typeof v === 'string' && /^[a-z0-9_]{3,32}$/i.test(v);
}
```
Use before query:
```typescript
if (!isValidUsername(username)) { setNotFound(true); setLoading(false); return; }
// ... query
```

**Files**
- `src/pages/PublicProfile.tsx`
- `src/pages/ShareOutfit.tsx`
- `src/lib/validators.ts` (new — if not already)

**Acceptance**
- Invalid chars in URL → clean "not found" view, no DB call
- Happy path still works

**Deploy** None.

---

### P11 — Gate seed_wardrobe delete_all

**Problem**
`supabase/functions/seed_wardrobe/index.ts` accepts `{mode: "delete_all"}` from any authenticated caller with no confirmation. Wipes entire wardrobe.

**Fix**
Require confirmation token in request body that matches a fresh server-side token:
```typescript
if (mode === "delete_all") {
  const confirmation = body.confirmation;
  const { data: profile } = await supabase.from("profiles").select("delete_confirmation_token, delete_confirmation_expires_at").eq("id", userId).single();
  if (!confirmation || confirmation !== profile?.delete_confirmation_token) {
    return new Response(JSON.stringify({ error: "Confirmation token required. Call GET /confirm-delete to receive one." }), {
      status: 403, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
  if (new Date(profile.delete_confirmation_expires_at) < new Date()) {
    return new Response(JSON.stringify({ error: "Token expired" }), { status: 403, headers });
  }
  // Clear token so it's one-use
  await supabase.from("profiles").update({ delete_confirmation_token: null, delete_confirmation_expires_at: null }).eq("id", userId);
  // ... proceed with delete
}
```
Add `confirm-delete` action to same function (returns new token, valid 5 min).

Migration: add 2 columns to `profiles`:
```sql
ALTER TABLE profiles ADD COLUMN delete_confirmation_token TEXT;
ALTER TABLE profiles ADD COLUMN delete_confirmation_expires_at TIMESTAMPTZ;
```

**Files**
- `supabase/functions/seed_wardrobe/index.ts`
- new migration for profile columns

**Acceptance**
- `delete_all` without token → 403
- `delete_all` with expired token → 403
- Happy path: request token → use within 5 min → success
- Same token can't be used twice

**Deploy** `npx supabase functions deploy seed_wardrobe` + `npx supabase db push --linked --yes`

---

### P12 — DB-backed idempotency

**Problem**
`supabase/functions/_shared/idempotency.ts` uses a per-isolate in-memory `Map`. Edge Functions are stateless isolates; cold starts lose the cache. Two requests with the same idempotency key hitting different isolates both execute side effects — idempotency guarantees broken.

**Fix**
Replace with a DB table using atomic upsert pattern (same as stripe_events):

Migration:
```sql
CREATE TABLE request_idempotency (
  key TEXT PRIMARY KEY,
  body TEXT NOT NULL,
  status INT NOT NULL,
  headers JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX ON request_idempotency (expires_at);

-- Cleanup cron every hour
SELECT cron.schedule('request_idempotency_cleanup', '0 * * * *',
  $$DELETE FROM request_idempotency WHERE expires_at < NOW()$$);
```

Rewrite `_shared/idempotency.ts`:
```typescript
export async function checkIdempotency(req: Request, supabaseAdmin: any): Promise<Response | null> {
  const key = req.headers.get("x-idempotency-key");
  if (!key) return null;

  const { data } = await supabaseAdmin
    .from("request_idempotency")
    .select("body, status, headers")
    .eq("key", key)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (!data) return null;
  return new Response(data.body, { status: data.status, headers: new Headers(data.headers) });
}

export async function storeIdempotencyResult(req: Request, response: Response, supabaseAdmin: any, ttlMs = 5 * 60 * 1000): Promise<void> {
  const key = req.headers.get("x-idempotency-key");
  if (!key) return;
  const clone = response.clone();
  const body = await clone.text();
  const headers: Record<string, string> = {};
  clone.headers.forEach((v, k) => { headers[k] = v; });
  await supabaseAdmin.from("request_idempotency").upsert({
    key, body, status: clone.status, headers,
    expires_at: new Date(Date.now() + ttlMs).toISOString(),
  }, { onConflict: "key" });
}
```

Update all callers to pass `supabaseAdmin` as 2nd arg:
- `supabase/functions/create_checkout_session/index.ts`
- `supabase/functions/delete_user_account/index.ts`
- (grep for `checkIdempotency` for full list)

**Files**
- `supabase/functions/_shared/idempotency.ts`
- new migration `<ts>_request_idempotency.sql`
- all consumers

**Acceptance**
- Two concurrent POSTs with same `x-idempotency-key` to different isolates both return same response, only one set of side effects
- Expired keys get re-executed
- Cleanup cron runs hourly

**Deploy** Every function calling `checkIdempotency`/`storeIdempotencyResult`. Plus `db push` for migration.

---

### P13 — User-scope 7 cache namespaces

**Problem**
These 7 functions use a static `cacheNamespace` that doesn't include user_id. Cached responses leak across users when content is not uniquely user-distinctive:
- `style_twin` — `"style_twin"`
- `clone_outfit_dna` — `"clone_dna"`
- `wardrobe_aging` — `"wardrobe_aging"`
- `wardrobe_gap_analysis` — `"wardrobe_gap"`
- `smart_shopping_list` — `"smart_shopping"`
- `suggest_accessories` — `"suggest_accessories"`
- `travel_capsule` — `"travel_capsule"`

**Fix**
In each function's `callBursAI` call, change:
```typescript
cacheNamespace: "style_twin",
```
to:
```typescript
cacheNamespace: `style_twin_${userId}`,
```
Apply consistently to all 7. The SHA-256 cache key in `burs-ai.ts` includes namespace + full message content, so user-scoping the namespace guarantees no cross-user hits even if prompts ever match.

**Files**
- `supabase/functions/style_twin/index.ts`
- `supabase/functions/clone_outfit_dna/index.ts`
- `supabase/functions/wardrobe_aging/index.ts`
- `supabase/functions/wardrobe_gap_analysis/index.ts`
- `supabase/functions/smart_shopping_list/index.ts`
- `supabase/functions/suggest_accessories/index.ts`
- `supabase/functions/travel_capsule/index.ts`

**Acceptance**
- User A's cache hit cannot be served to User B
- Hit rate per user unaffected (same user re-query still cached)

**Deploy** 7 functions.

---

### P14 — Fix summarize_day + suggest_outfit_combinations cache collisions

**Problem**
- `summarize_day`: `cacheNamespace: summarize_day_${eventsCacheKey}` — two users with identical calendar content collide.
- `suggest_outfit_combinations`: `cacheNamespace: suggest_combos_${user.id.slice(0, 8)}` — 8-char prefix, collision at scale.

**Fix**
- `summarize_day`: append user_id: `cacheNamespace: summarize_day_${userId}_${eventsCacheKey}`
- `suggest_outfit_combinations`: use full UUID: `cacheNamespace: suggest_combos_${user.id}`

**Files**
- `supabase/functions/summarize_day/index.ts`
- `supabase/functions/suggest_outfit_combinations/index.ts`

**Acceptance** No collisions between users at any cache scale.

**Deploy** Both functions.

---

## Wave 3 — PhotoRoom Removal + Ghost Mannequin for All Categories

### P15 — Unwire PhotoRoom entirely

**Problem**
- `supabase/functions/process_garment_image/index.ts` is a stub returning `{ok: true, skipped: true}` on every call. Never does real work.
- `src/lib/garmentIntelligence.ts:425` still invokes it on every garment save (1s timeout). Wasted HTTP round-trip.
- `src/pages/GarmentDetail.tsx` polls `image_processing_status` — but that status is always `'ready'` immediately. Redundant.
- `process_job_queue.ts` `handleImageProcessing` handler is also dead.

**Fix**
1. Delete the edge function:
   ```bash
   rm -rf supabase/functions/process_garment_image/
   ```
2. Remove from `supabase/config.toml` if listed.
3. In `src/lib/garmentIntelligence.ts`:
   - Delete `startGarmentImageProcessingInBackground` function (lines ~420-440)
   - Remove the `void startGarmentImageProcessingInBackground(...)` call site.
4. In `src/pages/GarmentDetail.tsx`:
   - Remove `garment?.image_processing_status === 'pending'` / `'processing'` from the `shouldPoll` calculation.
   - Keep `render_status === 'pending'/'rendering'` polling.
5. In `supabase/functions/process_job_queue/index.ts`:
   - Remove `image_processing: handleImageProcessing` from `JOB_HANDLERS`.
   - Delete `handleImageProcessing` function.
6. DB columns (`image_processing_status`, `image_processing_provider`, `image_processing_confidence`, `image_processing_error`, `image_processed_at`, `processed_image_path`) — LEAVE IN PLACE for now. Separate decision whether to drop them in a future migration.

**Files**
- `supabase/functions/process_garment_image/` (DELETE)
- `supabase/config.toml`
- `src/lib/garmentIntelligence.ts`
- `src/pages/GarmentDetail.tsx`
- `supabase/functions/process_job_queue/index.ts`

**Acceptance**
- Garment save flow still works; no HTTP call to `process_garment_image`
- `GarmentDetail` polling terminates correctly based on `render_status` alone
- `process_job_queue` still handles `garment_enrichment` and `batch_analysis`
- Old DB columns remain (unused)

**Deploy** `npx supabase functions deploy process_job_queue --project-ref khvkwojtlkcvxjxztduj --no-verify-jwt`

---

### P16 — Category-aware render prompts

**Problem**
`supabase/functions/render_garment_image/index.ts` uses ONE prompt template ("ghost mannequin") for every category. Shoes, bags, jewelry don't belong on a torso — current output is inconsistent.

**Fix**
In `render_garment_image/index.ts`, branch prompt by `garment.category` BEFORE calling Gemini:

```typescript
function buildPromptByCategory(garment: Garment, presentation: MannequinPresentation): string {
  const base = `Premium e-commerce product photography. Pure white background. Studio lighting. No text or watermarks.`;
  switch (garment.category) {
    case 'top':
    case 'bottom':
    case 'dress':
    case 'outerwear':
      return `${base} ${mannequinPresentationInstruction(presentation)} Garment shown as if worn by an invisible body — hollow, with natural drape and shape. Show the full front of the garment. No visible mannequin parts (no face, hands, feet).`;
    case 'shoes':
      return `${base} Single shoe or pair photographed at a 3/4 angle, side view preferred. No person, no mannequin, no feet. Clean product-catalog styling.`;
    case 'accessory':
      const sub = garment.subcategory || '';
      if (['bag', 'handbag', 'backpack'].some(s => sub.toLowerCase().includes(s))) {
        return `${base} Bag photographed front-on, strap/handle naturally positioned. No person, no mannequin.`;
      }
      if (['scarf', 'hat', 'beanie', 'gloves'].some(s => sub.toLowerCase().includes(s))) {
        return `${base} Styled flat lay, garment arranged aesthetically against white.`;
      }
      if (['jewelry', 'watch', 'ring', 'necklace', 'bracelet'].some(s => sub.toLowerCase().includes(s))) {
        return `${base} Close-up product shot. No body parts visible. Clean white background, soft studio lighting.`;
      }
      return `${base} Styled product shot of the accessory against pure white.`;
    default:
      return `${base} Product photography of this garment against pure white background.`;
  }
}
```

Use this in place of the existing prompt construction. Keep `mannequinPresentationInstruction` for categories that use ghost mannequin.

**Files**
- `supabase/functions/render_garment_image/index.ts`
- `supabase/functions/_shared/mannequin-presentation.ts` (keep existing, extend if needed)

**Acceptance**
- Ghost mannequin categories (top/bottom/dress/outerwear) produce the same output as before
- Shoes produce clean product-angle shots, no mannequin
- Bags produce product shots with handles
- Accessories get context-appropriate rendering
- Spot-check 3 renders per category after deploy

**Deploy** `npx supabase functions deploy render_garment_image --project-ref khvkwojtlkcvxjxztduj --no-verify-jwt`

---

### P17 — Multi-prompt retry chain

**Problem**
`render_garment_image` makes 1 attempt. On failure, marks `render_status='failed'` and the user sees nothing changed. No retry with different prompt strategy.

**Fix**
Wrap the Gemini call in a retry loop with 3 distinct prompt variants:

```typescript
const promptVariants = [
  buildPromptByCategory(garment, presentation),                    // primary
  buildPromptByCategory(garment, presentation) + ' Emphasize clean product-catalog framing.',  // tightened
  `Premium product photography against pure white. Single ${garment.category}. No person. Clean studio light. Subject: ${garment.title}.`,  // fallback
];

let result: GenerateGeminiImageResult | null = null;
let lastError: Error | null = null;

for (let attempt = 0; attempt < promptVariants.length; attempt++) {
  try {
    result = await generateGeminiImage({
      apiKey: GEMINI_API_KEY,
      prompt: promptVariants[attempt],
      dataUrl: sourceDataUrl,
      garmentId: garment.id,
    });

    // Validate output
    const validation = await validateRenderedGarmentOutputWithGemini({
      apiKey: GEMINI_API_KEY, garmentId: garment.id,
      mimeType: result.mimeType, imageBase64: base64(result.outputBytes),
    });

    if (validation.decision === 'accept') break;
    // rejected — fall through to next attempt
    lastError = new Error(`Validation rejected on attempt ${attempt + 1}: ${validation.reason}`);
    result = null;
  } catch (err) {
    lastError = err instanceof Error ? err : new Error(String(err));
    result = null;
  }
}

if (!result) {
  // Final fallback: mark render_status='fallback', keep original image
  await supabase.from('garments').update({
    render_status: 'fallback',
    render_error: lastError?.message || 'All retries exhausted',
  }).eq('id', garment.id);
  return { ok: false, fallback: true };
}
```

**Files**
- `supabase/functions/render_garment_image/index.ts`

**Acceptance**
- Transient Gemini failures recover on retry 2 or 3
- Persistent failures produce `render_status='fallback'`, user sees original photo
- No silent user-facing failures

**Deploy** `render_garment_image`

---

### P18 — Tighten validateRenderedGarmentOutputWithGemini

**Problem**
`supabase/functions/_shared/render-eligibility.ts` `validateRenderedGarmentOutputWithGemini` uses the SAME reject-list for every category. Can't reject "shoe on mannequin" specifically because mannequin-visible is expected to fail for shoes (they should never involve a mannequin).

**Fix**
Make validation category-aware:
```typescript
export async function validateRenderedGarmentOutputWithGemini(opts: {
  apiKey: string; garmentId: string; mimeType: string; imageBase64: string;
  category?: string;    // NEW
}): Promise<RenderOutputValidationAssessment | null> {
  const isGhostMannequinCategory = ['top', 'bottom', 'dress', 'outerwear'].includes(opts.category || '');

  const promptText = isGhostMannequinCategory
    ? [/* existing ghost-mannequin validation prompt */]
    : [
        'Validate whether this rendered product image is acceptable for BURS wardrobe display.',
        'Return JSON only.',
        'Category:', opts.category,
        'Accept only: single garment or accessory on pure white background, clean product framing, no visible person/body/mannequin.',
        'Reject if: person visible, body parts visible, messy background, multiple garments, text/watermarks.',
        'Required schema: same as before.',
      ];
  // ... rest unchanged, use promptText
}
```

Caller (`render_garment_image`) passes `category: garment.category`.

**Files**
- `supabase/functions/_shared/render-eligibility.ts`
- `supabase/functions/render_garment_image/index.ts` (pass category)

**Acceptance**
- Shoe renders that show a mannequin get rejected
- Ghost mannequin renders that show a body get rejected
- Valid renders pass

**Deploy** `render_garment_image`

---

### P19 — Add timeouts to gemini-image-client.ts + render-eligibility.ts

**Problem**
Both files use `fetch()` with NO timeout. A hung Gemini request can tie up an edge function isolate indefinitely.

**Fix**
Wrap fetches with AbortController:
```typescript
async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error(`Fetch timeout after ${timeoutMs}ms`)), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
```
Use `fetchWithTimeout` everywhere `fetch` is called in these two files. Suggested timeouts:
- `gemini-image-client.ts` image gen: 60000ms (image gen is slow)
- `render-eligibility.ts` assessment/validation: 25000ms (text-based, should be fast)

**Files**
- `supabase/functions/_shared/gemini-image-client.ts`
- `supabase/functions/_shared/render-eligibility.ts`

**Acceptance**
- Slow Gemini responses get cancelled at the timeout, don't leak memory
- Normal responses (< timeout) unaffected

**Deploy** `render_garment_image`, and any other function importing these modules (grep to find all).

---

## Wave 4 — AI Retrieval Quality

### P20 — Semantic pre-filter for mood_outfit

**Problem**
`mood_outfit/index.ts` sends ALL non-laundry garments to Gemini. Large wardrobes (>200 items) overwhelm the AI and hit token limits. Mood-irrelevant garments (formal suit for "cozy" mood) waste tokens.

**Fix**
Add a `scoreMoodFit(garment, mood)` function that returns 0-10 based on:
- Formality match (MOOD_MAP[mood].formality implies a range)
- Color match (MOOD_MAP[mood].colors string → check garment.color_primary)
- Material match (MOOD_MAP[mood].materials)
- Category appropriateness (dress→romantic, blazer→sharp, etc.)

Sort garments by score, take top 40 → send to Gemini. If fewer than 40 match, pad with next best.

```typescript
function scoreMoodFit(g: Garment, mood: string): number {
  const params = MOOD_MAP[mood];
  let score = 0;
  if (params.colors.toLowerCase().includes(g.color_primary?.toLowerCase() || '')) score += 4;
  if (params.materials && g.material && params.materials.includes(g.material.toLowerCase())) score += 3;
  if (params.formality === 'casual' && (g.formality || 3) <= 2) score += 2;
  if (params.formality === 'formal' && (g.formality || 3) >= 4) score += 2;
  return Math.min(10, score);
}

const scored = garments.map(g => ({ g, score: scoreMoodFit(g, mood) }))
  .sort((a, b) => b.score - a.score);
const topForAI = scored.slice(0, 40).map(x => x.g);
```

Send `topForAI` instead of full `garments` to the AI. Keep full list for post-validation.

**Files**
- `supabase/functions/mood_outfit/index.ts`

**Acceptance**
- Large wardrobes (>100 items) complete within token budget
- Top-40 contains mood-relevant items
- Output outfit still uses only IDs from the sent list

**Deploy** `mood_outfit`

---

### P21 — Gap-aware pre-filter for wardrobe_gap_analysis

**Problem**
`wardrobe_gap_analysis` sends full wardrobe to Gemini. It's asked to find GAPS (what's missing) but gets flooded with what exists — inverts the task.

**Fix**
Compute category coverage server-side first:
```typescript
const coverage = {
  top: garments.filter(g => g.category === 'top').length,
  bottom: garments.filter(g => g.category === 'bottom').length,
  shoes: garments.filter(g => g.category === 'shoes').length,
  outerwear: garments.filter(g => g.category === 'outerwear').length,
  dress: garments.filter(g => g.category === 'dress').length,
  accessory: garments.filter(g => g.category === 'accessory').length,
};
const colorCoverage = groupBy(garments, g => g.color_primary);
const formalityCoverage = { casual: ..., smart: ..., formal: ... };

const prompt = `User's wardrobe coverage (sparse view):
${JSON.stringify({ coverage, colorCoverage, formalityCoverage }, null, 2)}

Identify the top 5 gaps that would unlock the most new outfit combinations. Frame each as a specific piece (color + category + formality).`;
```

Send coverage summary + user's `styleProfile` (from preferences). Do NOT send full garment list.

**Files**
- `supabase/functions/wardrobe_gap_analysis/index.ts`

**Acceptance**
- AI returns gap recommendations as specific category+color+formality suggestions
- No need to send hundreds of garment rows to AI

**Deploy** `wardrobe_gap_analysis`

---

### P22 — Shopping-intent pre-filter for smart_shopping_list

**Problem**
Same pattern as P21 — sends entire wardrobe when the task is to recommend what to BUY.

**Fix**
Send compressed wardrobe signature + user's shopping preferences (budget tier, frequency, style goals from Q10 + Q11 onboarding). Not full inventory.

```typescript
const signature = {
  total: garments.length,
  byCategory: coverage,
  byColor: colorCoverage,
  gaps: detectWardrobeGapForRequest(garments),  // reuse burs_style_engine helper
  styleProfile: profile.preferences.styleProfile,
};

// Send signature + user intent, NOT full wardrobe
```

**Files**
- `supabase/functions/smart_shopping_list/index.ts`

**Acceptance**
- Token usage drops substantially on large wardrobes
- Suggestions still specific (category + color + formality)

**Deploy** `smart_shopping_list`

---

### P23 — Fix ID truncation

**Problem**
- `suggest_outfit_combinations/index.ts` line ~111: `unusedIds = unusedGarments.map(g => g.id.slice(0, 8))` — 8-char UUID prefix, collision risk.
- `wardrobe_aging/index.ts` line ~55-57: same `.slice(0, 8)` pattern on garment IDs in the prompt.

**Fix**
Use full UUIDs in prompts. If prompt length is a concern, use a numeric index instead:
```typescript
const idMap = new Map<number, string>();
const compactList = garments.map((g, i) => {
  idMap.set(i, g.id);
  return `${i}|${g.title}|${g.category}|${g.color_primary}`;
}).join('\n');

// Ask AI to return indices, then map back to full IDs in response validation
```
This keeps prompts compact AND avoids UUID collisions.

**Files**
- `supabase/functions/suggest_outfit_combinations/index.ts`
- `supabase/functions/wardrobe_aging/index.ts`

**Acceptance**
- No 8-char UUID slicing remains
- AI responses map back to correct full UUIDs
- Validate with a user who has 1000+ garments

**Deploy** Both functions.

---

### P24 — Enrichment guarantee

**Problem**
Every AI function can degrade quality if `ai_raw` enrichment fields are missing on garments. Currently no guarantee — if `garment_enrichment` jobs fail or lag, functions operate blind.

**Fix**
Add a helper in `_shared/burs-ai.ts`:
```typescript
export async function ensureEnriched(
  supabaseAdmin: any,
  garments: Array<{ id: string; enrichment_status?: string | null; ai_raw?: any }>,
): Promise<void> {
  const unenriched = garments.filter(g => !g.ai_raw || g.enrichment_status !== 'completed');
  if (unenriched.length === 0) return;

  // Queue enrichment jobs (fire-and-forget), don't block the AI call
  for (const g of unenriched) {
    await supabaseAdmin.rpc('submit_job_if_missing', {
      p_job_type: 'garment_enrichment',
      p_user_id: /* owner user_id */,
      p_payload: { garment_id: g.id },
    }).catch(() => {});
  }
  // Note: we don't wait. Next call will have richer data.
}
```

Call `ensureEnriched` at the start of every AI function that uses garments.

**Files**
- `supabase/functions/_shared/burs-ai.ts` (add helper)
- All AI function consumers (add 1-line call)
- New migration for `submit_job_if_missing` RPC (prevents double-queuing)

**Acceptance**
- First call with un-enriched garments queues enrichment jobs, still returns response (using basic fields)
- Second call has richer data

**Deploy** All AI functions importing burs-ai.

---

### P25 — Style DNA context injection

**Problem**
Every AI function writes its own system prompt. None consistently include the user's Style DNA (the 12-question onboarding answers). Without that context, Gemini can't tailor recommendations.

**Fix**
Depends on Wave 7 (P45) schema landing. Once `profiles.preferences.styleProfile` has v4 shape with Q1-Q12 answers, add to `_shared/burs-ai.ts`:
```typescript
export function buildStyleDNAContext(styleProfile: any): string {
  if (!styleProfile) return '';
  const parts: string[] = [];
  if (styleProfile.gender) parts.push(`Gender expression: ${styleProfile.gender}`);
  if (styleProfile.height) parts.push(`Height: ${styleProfile.height} cm`);
  if (styleProfile.build) parts.push(`Build: ${styleProfile.build}`);
  if (styleProfile.climate) parts.push(`Climate: ${styleProfile.climate}`);
  if (styleProfile.archetypes?.length) parts.push(`Style archetypes: ${styleProfile.archetypes.join(', ')}`);
  if (styleProfile.colorDNA?.favorites) parts.push(`Favorite colors: ${styleProfile.colorDNA.favorites.join(', ')}`);
  if (styleProfile.fit?.overall) parts.push(`Overall fit preference: ${styleProfile.fit.overall}`);
  if (styleProfile.formalityFloor && styleProfile.formalityCeiling) parts.push(`Formality range: ${styleProfile.formalityFloor}-${styleProfile.formalityCeiling}`);
  if (styleProfile.primaryGoal) parts.push(`Primary goal: ${styleProfile.primaryGoal}`);
  // ... etc
  return parts.join('. ');
}
```

In every AI function's system prompt, prepend `USER PROFILE: ${buildStyleDNAContext(profile.preferences.styleProfile)}`.

**Files**
- `supabase/functions/_shared/burs-ai.ts`
- All AI function consumers (~12 functions)

**Acceptance**
- Recommendations vary by user's Style DNA (test with two distinct profiles)
- Prompt length stays manageable (compressed signature, not verbose)

**Deploy** All AI functions.

---

### P26 — Remove slot: "unknown" hardcodes

**Problem**
- `supabase/functions/generate_outfit/index.ts` line 62: `slot: "unknown"` hardcoded for every returned item. Downstream code that relies on `slot` (OutfitDetail layer ordering, refine flow) breaks.
- `supabase/functions/_shared/unified_stylist_engine.ts` line 90: same pattern for `other_items`.

**Fix**
Use `classifySlot` from `_shared/burs-slots.ts` to infer the real slot from each garment's category/subcategory:
```typescript
import { classifySlot } from "../_shared/burs-slots.ts";

// generate_outfit:
items: selected.garment_ids.map((garment_id) => {
  const g = garmentMap.get(garment_id);
  return { slot: g ? classifySlot(g.category, g.subcategory) || 'unknown' : 'unknown', garment_id };
}),

// unified_stylist_engine:
other_items: activeLookIds.filter(id => id !== currentGarmentId).map(garmentId => {
  const g = garmentMap.get(garmentId);
  return { slot: g ? classifySlot(g.category, g.subcategory) || 'unknown' : 'unknown', garment_id: garmentId };
}),
```

Requires passing garment metadata to both functions. In `generate_outfit`, the burs_style_engine already returns garments — just enrich them in the shim. In `unified_stylist_engine`, fetch the garments first.

**Files**
- `supabase/functions/generate_outfit/index.ts`
- `supabase/functions/_shared/unified_stylist_engine.ts`

**Acceptance**
- `items[].slot` reflects real slot (top/bottom/shoes/etc.), not "unknown"
- Refine flow receives correct slot info

**Deploy** `generate_outfit` + every function importing `unified_stylist_engine` (e.g., `style_chat`).

---

### P27 — Full audit and fix of clone_outfit_dna retrieval

**Problem**
`supabase/functions/clone_outfit_dna/index.ts` was not deeply audited. Cache namespace issue fixed in P13 but retrieval strategy unverified.

**Fix**
1. Read the full file. Document in PR body:
   - What input does it take? (inspiration image? style description? both?)
   - What garments does it fetch and send to Gemini?
   - What does it return?
2. Apply the same patterns as other AI functions:
   - Pre-filter wardrobe by relevance to the inspiration (color, formality, category match)
   - Send top N, not all
   - Use full UUIDs
   - Include Style DNA context (P25)
   - Guarantee enrichment (P24)
3. If it's fundamentally a "copy this outfit style" function, ensure it returns full outfits (top+bottom+shoes or dress+shoes), not single garments.

**Files**
- `supabase/functions/clone_outfit_dna/index.ts`

**Acceptance**
- Function returns complete outfits
- Relevant pre-filter reduces AI token usage
- Documented in PR body

**Deploy** `clone_outfit_dna`

---

## Wave 5 — Refine Button + AI Chat Fixes

### P28 — Refine anchors garment instead of full outfit (user's repro)

**Problem**
User's repro: "pressing refine button in an outfit card it just anchors a garment instead of whole outfit and gemini do not gets the full context."

Root cause (verified in code): the refine flow eventually calls `invokeUnifiedStylistEngine({mode: "swap", ...})` with a single `anchor_garment_id`. `unified_stylist_engine.ts` line 82-91 treats swap mode as a single-garment operation — the other outfit garments are passed as `other_items` with `slot: "unknown"`. Gemini receives fragmented context.

**Fix**
Change the refine flow to pass the FULL outfit as locked context, not a single anchor:

In `src/hooks/useSwapGarment.ts` (or wherever refine is triggered):
```typescript
// OLD (likely):
await invokeRefine({ anchor_garment_id: currentGarmentId, ... });

// NEW:
await invokeRefine({
  mode: "refine",
  active_look_garment_ids: outfit.items.map(i => i.garment_id),        // all current garments
  locked_garment_ids: outfit.items.filter(i => i.id !== outfitItemId).map(i => i.garment_id),  // everything except the one being swapped
  requested_edit_slots: [slot],        // the slot being swapped
  occasion: outfit.occasion,
  weather: outfit.weather,
});
```

In `supabase/functions/_shared/unified_stylist_engine.ts`:
- Add `mode: "refine"` path that passes the full active_look + locked set to `burs_style_engine`.
- `burs_style_engine` already handles `active_look_garment_ids` + `locked_garment_ids` — verify it uses them correctly in refinement mode.

In `supabase/functions/style_chat/index.ts`:
- Refinement path should also pass the full active look, not just the anchor. Verify `StructuredRefinementPlan.lockedGarmentIds` includes all non-edited garments.

**Files**
- `src/hooks/useSwapGarment.ts`
- `supabase/functions/_shared/unified_stylist_engine.ts`
- `supabase/functions/style_chat/index.ts` (refinement path)
- `supabase/functions/burs_style_engine/index.ts` (verify active_look handling)
- `src/components/chat/RefineChips.tsx` / `RefineBanner.tsx` (fix payload)

**Acceptance**
- User hits refine → Gemini receives full outfit context (5 garments + which slot to swap)
- Swap result preserves 4 non-edited garments
- Tested with: refine-shoes, refine-top, refine-outerwear on a 5-piece outfit

**Deploy** `style_chat`, `burs_style_engine` (if changed), `generate_outfit` (if changed)

---

### P29 — AI chat activeLook persistence

**Problem**
Across AI chat messages, `activeLook` state sometimes drops. Next refine loses context.

**Fix**
1. In `supabase/functions/style_chat/index.ts`, verify every response includes `active_look` in `StyleChatResponseEnvelope`.
2. In `src/pages/AIChat.tsx`, verify `stylistMeta.active_look.garment_ids` is serialized to `chat_messages.content` and restored on load.
3. Add a smoke test: 3 messages in a thread, verify activeLook persists across all.

**Files**
- `supabase/functions/style_chat/index.ts`
- `supabase/functions/_shared/style-chat-contract.ts`
- `src/pages/AIChat.tsx`
- `src/lib/styleChatContract.ts` (frontend serialization)

**Acceptance**
- activeLook.garment_ids survives across message turns in the UI
- Refresh page → thread reloaded → activeLook still present on last assistant message

**Deploy** `style_chat`

---

### P30 — style_chat classifier fallback

**Problem**
When user has an active look and says "make it warmer", classifier sometimes returns `intent: "conversation"` instead of `intent: "refine_outfit"`. Refine UI doesn't fire.

**Fix**
In `supabase/functions/_shared/style-chat-classifier.ts`, add a post-classification override:
```typescript
// After parseClassifierResponse returns the ClassifierResult:
if (input.hasActiveLook && result.intent === 'conversation') {
  // Check for refinement hint words
  const refinementWords = /\b(warmer|cooler|formal|casual|swap|change|different|elevated|softer|sharper)\b/i;
  if (refinementWords.test(input.userMessage)) {
    return { ...result, intent: 'refine_outfit', refinement_hint: /* infer from word */ };
  }
}
```

**Files**
- `supabase/functions/_shared/style-chat-classifier.ts`

**Acceptance**
- "make it warmer" with active look → `refine_outfit` intent, not conversation
- "tell me a joke" with active look → `conversation` intent (unchanged)

**Deploy** `style_chat`

---

### P31 — RefineChips/RefineBanner payload fix

**Problem**
UI components send anchor-only payload. Linked to P28.

**Fix**
Verify `RefineChips.tsx` + `RefineBanner.tsx` call `useSwapGarment` (or equivalent hook) with the full outfit context. If they send just `{anchor_garment_id}`, refactor to send `{active_look_garment_ids, locked_garment_ids, requested_edit_slots}`.

**Files**
- `src/components/chat/RefineChips.tsx`
- `src/components/chat/RefineBanner.tsx`
- `src/hooks/useRefineMode.ts`

**Acceptance**
- Refine chips/banner trigger full-outfit refine (covered by P28's integration test)

**Deploy** None.

---

## Wave 6 — Localization (14 locales)

### P32 — Extend langName maps to 14 locales

**Problem**
Several AI functions only support sv/en. Other 12 locales fall back to English: `mood_outfit`, `smart_shopping_list`, `wardrobe_aging`, `clone_outfit_dna`, `travel_capsule`.

**Fix**
Canonical lang name map (use consistently):
```typescript
const LANG_NAMES: Record<string, string> = {
  sv: "svenska", en: "English", no: "norsk", da: "dansk", fi: "suomi",
  de: "Deutsch", fr: "français", es: "español", it: "italiano",
  pt: "português", nl: "Nederlands", pl: "polski", ar: "العربية", fa: "فارسی",
};
const langName = LANG_NAMES[locale] || "English";
```
Copy this to each of the 5 functions (or export from a shared `_shared/lang-names.ts`).

**Files**
- `supabase/functions/mood_outfit/index.ts`
- `supabase/functions/smart_shopping_list/index.ts`
- `supabase/functions/wardrobe_aging/index.ts`
- `supabase/functions/clone_outfit_dna/index.ts`
- `supabase/functions/travel_capsule/index.ts`
- `supabase/functions/_shared/lang-names.ts` (new, optional)

**Acceptance**
- Requesting locale=`de` returns German output (spot check)

**Deploy** 5 functions.

---

### P33 — Localize NotFound + Auth + ResetPassword

**Problem**
- `src/pages/NotFound.tsx` — entirely English ("404", "Page not found", "Return to Home")
- `src/pages/Auth.tsx` — hardcoded "you@email.com" placeholder
- `src/pages/ResetPassword.tsx` — hardcoded "••••••••" placeholder

**Fix**
1. Add keys to `src/i18n/locales/en.ts` and `sv.ts` (append-only rule — add new keys at END):
```typescript
// en.ts
'errors.404.title': '404',
'errors.404.body': 'Page not found',
'errors.404.cta': 'Return to Home',
'auth.email_placeholder': 'you@email.com',
'auth.password_placeholder': '••••••••',

// sv.ts — Swedish equivalents
'errors.404.title': '404',
'errors.404.body': 'Sidan hittades inte',
'errors.404.cta': 'Tillbaka till hem',
'auth.email_placeholder': 'du@email.com',
'auth.password_placeholder': '••••••••',
```
2. Replace hardcoded strings with `t('errors.404.title')` etc.
3. Apply to other 12 locales following the same pattern.

**Files**
- `src/pages/NotFound.tsx`
- `src/pages/Auth.tsx`
- `src/pages/ResetPassword.tsx`
- `src/i18n/locales/*.ts` (14 files)

**Acceptance**
- 404 page renders in user's locale
- Auth/ResetPassword placeholders match locale

**Deploy** None.

---

### P34 — Localize ShareOutfit + PublicProfile meta tags

**Problem**
og:title/description + meta description are hardcoded English in both pages.

**Fix**
Use i18n keys + template interpolation:
```typescript
// ShareOutfit.tsx
<meta property="og:title" content={t('share.og_title', { occasion: outfit.occasion })} />
<meta property="og:description" content={outfit.explanation || t('share.og_fallback')} />
```
Add keys to 14 locale files.

**Files**
- `src/pages/ShareOutfit.tsx`
- `src/pages/PublicProfile.tsx`
- `src/i18n/locales/*.ts`

**Acceptance**
- OG tags render in locale at page load time (note: bots may see default locale — that's OK)

**Deploy** None.

---

### P35 — Localize AddGarment + LiveScan + OutfitDetail + Onboarding fallbacks

**Problem**
Multiple hardcoded English/Swedish fallback strings across these pages.

**Fix**
Grep each file for string literals, add i18n keys for every one, replace with `t(...)` calls.

Specific strings to localize:
- `AddGarment.tsx`: `processingLabel="Reviewing garment details"`, `'Old garment replaced'`
- `LiveScan.tsx`: `'Locking on…'`, `'Reading garment…'`, `'Extracting details…'`, `'Focus on one garment'`
- `OutfitDetail.tsx`: Swedish `'vardag'` fallback → i18n key
- `Onboarding.tsx`: `'Step 01 of 04'` format, `'smart-casual'` fallback

**Files**
- 4 page files
- 14 locale files

**Acceptance**
- No hardcoded English or Swedish strings remain in those 4 files (grep verify)

**Deploy** None.

---

### P36 — Localize Insights.tsx

**Problem**
- Weekday labels `['M', 'T', 'W', 'T', 'F', 'S', 'S']` hardcoded English
- Radar axis labels hardcoded English: 'Variety', 'Color', 'Usage', 'Season', 'Value', 'Fit'
- `eyebrow="INSIGHTS"` hardcoded
- Fallback title 'Your Style Story' hardcoded

**Fix**
1. Weekday labels via date-fns locale:
```typescript
import { getDay, format, startOfWeek, addDays } from 'date-fns';
import { sv, enGB, de, fr, es, it, pt, nl, da, fi, nb, ar, fa, pl } from 'date-fns/locale';
const localeMap = { sv, en: enGB, de, fr, es, it, pt, nl, da, fi, no: nb, ar, fa, pl };
const dfnsLocale = localeMap[locale] || enGB;
const weekStart = startOfWeek(new Date(), { locale: dfnsLocale });
const days = Array.from({ length: 7 }, (_, i) => format(addDays(weekStart, i), 'EEEEEE', { locale: dfnsLocale }));
```
2. Axis labels → i18n keys.
3. Eyebrow → i18n key.
4. Fallback title → i18n key.

**Files**
- `src/pages/Insights.tsx`
- `src/i18n/locales/*.ts`

**Acceptance**
- Weekday abbrevs render per locale (e.g. German "Mo Di Mi Do Fr Sa So")
- Axis labels localized

**Deploy** None.

---

### P37 — Localize MoodOutfit MOODS + MOOD_MAP

**Problem**
- `src/pages/MoodOutfit.tsx` MOODS array has English `hint` strings ("Sharp. Owned.", etc.)
- `supabase/functions/mood_outfit/index.ts` MOOD_MAP has English keys

**Fix**
1. Frontend: replace `hint: 'Sharp. Owned.'` with `hintKey: 'mood.confident.hint'`. Use `t(hintKey)` in render.
2. Add `mood.<key>.hint` keys to 14 locale files.
3. Edge function MOOD_MAP keys (`cozy`, `confident`, etc.) stay English (they're internal IDs). But the mood NAMES sent to Gemini in prompts should use the user's locale + system prompt tells Gemini to respond in that locale.

**Files**
- `src/pages/MoodOutfit.tsx`
- `supabase/functions/mood_outfit/index.ts` (prompt phrasing)
- `src/i18n/locales/*.ts`

**Acceptance**
- Each mood tile shows locale-specific hint
- AI response text in user's locale

**Deploy** `mood_outfit`

---

### P38 — Extend token lists to all 14 locales

**Problem**
`_shared/outfit-rules.ts`, `_shared/burs-slots.ts`, `_shared/travel-capsule-planner.ts` have classification token lists that only include English + Swedish. Other locales' category keywords never match, causing misclassification.

**Fix**
For each module's token arrays, add equivalents in 12 more locales. Example for `SHOES_TOKENS`:
```typescript
const SHOES_TOKENS: readonly string[] = [
  // English
  'shoes', 'shoe', 'sneakers', 'boots', 'loafers', 'sandals', 'heels', 'footwear',
  // Swedish
  'skor', 'stövlar',
  // Norwegian
  'sko', 'støvler',
  // Danish
  'sko', 'støvler',
  // Finnish
  'kengät', 'saappaat',
  // German
  'schuhe', 'stiefel',
  // French
  'chaussures', 'bottes',
  // Spanish
  'zapatos', 'botas',
  // Italian
  'scarpe', 'stivali',
  // Portuguese
  'sapatos', 'botas',
  // Dutch
  'schoenen', 'laarzen',
  // Polish
  'buty', 'kozaki',
  // Arabic
  'أحذية',
  // Persian
  'کفش',
];
```
Repeat for top/bottom/outerwear/dress/accessory tokens across all 3 files.

**Files**
- `supabase/functions/_shared/outfit-rules.ts`
- `supabase/functions/_shared/burs-slots.ts`
- `supabase/functions/_shared/travel-capsule-planner.ts`

**Acceptance**
- Garments with non-English category names classify correctly
- Classify test: feed 10 German/French/Japanese category strings, all return correct slot

**Deploy** Every AI function importing these modules (shared file deploy map in CLAUDE.md — ~20 functions). Batch across sessions.

---

### P39 — Localize day-intelligence.ts OCCASION_RULES

**Problem**
`_shared/day-intelligence.ts` OCCASION_RULES tag arrays are English-only. Non-English calendar events never match, always fallback to `remote` occasion.

**Fix**
Extend each rule's `tags` array with translations:
```typescript
{ occasion: 'work', formality: 4, confidence: 0.9, tags: [
  // English
  'boardroom', 'client', 'presentation', 'interview', 'pitch', 'office', 'meeting',
  // Swedish
  'kontor', 'möte', 'presentation',
  // German
  'büro', 'besprechung', 'präsentation',
  // French
  'bureau', 'réunion', 'présentation',
  // ... etc for all 14 locales
]},
```

Alternative: externalize tags to a JSON file per locale, load based on user.preferences.locale.

**Files**
- `supabase/functions/_shared/day-intelligence.ts`

**Acceptance**
- Calendar event "Möte med klient" (Swedish) classifies as `work`, not `remote`
- Test across 5+ locales

**Deploy** Every function importing day-intelligence.

---

### P40 — Multi-locale regexes

**Problem**
- `src/pages/OutfitGenerate.tsx` `FORMAL_KEYWORDS` regex is English-only
- `supabase/functions/shopping_chat/index.ts` `CHAT_SHORT_RE` regex matches only English greetings

**Fix**
Combine patterns across locales:
```typescript
// OutfitGenerate.tsx
const FORMAL_KEYWORDS = /\b(meeting|presentation|conference|interview|client|dinner|lunch|board|pitch|wedding|formal|work|office|möte|präsentation|réunion|besprechung|entrevista|colloquio|reünie|spotkanie)\b/i;

// shopping_chat/index.ts
const CHAT_SHORT_RE = /^(hi|hello|hey|thanks|thank you|bye|hej|tack|hallo|danke|bonjour|merci|hola|gracias|ciao|grazie|oi|obrigado|dzień dobry|dziękuję|مرحبا|شكرا|سلام|ممنون)\s*[!.?]*$/i;
```

**Files**
- `src/pages/OutfitGenerate.tsx`
- `supabase/functions/shopping_chat/index.ts`

**Acceptance**
- Formal detection works in all supported locales
- Short greeting fast-path fires for all locales

**Deploy** `shopping_chat`

---

### P41 — Fix UnusedOutfits Swedish/English mixing

**Problem**
`src/pages/UnusedOutfits.tsx` `OCCASIONS = ['vardag', 'jobb', 'dejt', 'fest', 'casual', 'smart_casual']` — mixes Swedish ('vardag', 'jobb') and English ('casual').

**Fix**
Decide canonical: either ALL i18n keys (e.g. `'occasion.daily'`) resolved via `t()`, OR ALL canonical English keys with UI translation. Align with rest of codebase (check how `getOccasionLabel` normalizes).

**Files**
- `src/pages/UnusedOutfits.tsx`

**Acceptance**
- No language mixing
- UI shows occasion in user's locale

**Deploy** None.

---

## Wave 7 — Onboarding Rebuild

### P42 — Migration: 4 new profiles columns

**Problem**
Per spec, onboarding needs persistent state tracking columns that don't exist yet.

**Fix**
Create migration `<ts>_onboarding_state.sql`:
```sql
ALTER TABLE profiles ADD COLUMN onboarding_step TEXT DEFAULT 'not_started'
  CHECK (onboarding_step IN (
    'not_started', 'style_questions', 'photo_tutorial', 'batch_capture',
    'achievement', 'studio_selection', 'coach_tour', 'completed'
  ));
ALTER TABLE profiles ADD COLUMN onboarding_garment_count INT DEFAULT 0;
ALTER TABLE profiles ADD COLUMN onboarding_started_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN onboarding_completed_at TIMESTAMPTZ;

-- Backfill existing users to 'completed' so they don't get forced back into onboarding
UPDATE profiles SET onboarding_step = 'completed',
  onboarding_completed_at = COALESCE(created_at, NOW())
WHERE onboarding_step = 'not_started';

CREATE INDEX ON profiles (onboarding_step) WHERE onboarding_step != 'completed';
```

Commit the file with a timestamp matching what MCP `apply_migration` returns.

**Files**
- new migration file

**Acceptance**
- Migration applies cleanly
- Existing users unaffected (backfilled to `completed`)
- New signups default to `not_started`

**Deploy** `npx supabase db push --linked --yes` (post-merge)

---

### P43 — Onboarding rate-limit boost

**Problem**
Rate limits are tight (e.g., analyze_garment 30/min). During batch capture (20+ garments), user would hit limit mid-session.

**Fix**
In `supabase/functions/_shared/scale-guard.ts` `enforceRateLimit`:
```typescript
// After resolving plan:
const onboardingBoost = await checkOnboardingBoost(supabaseAdmin, userId);
if (onboardingBoost) {
  tier = { maxPerHour: 2000, maxPerMinute: 100 };  // boosted for first 24h
}
```

Add helper:
```typescript
async function checkOnboardingBoost(supabaseAdmin: any, userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('onboarding_started_at, onboarding_step')
    .eq('id', userId)
    .single();
  if (!data || data.onboarding_step === 'completed') return false;
  if (!data.onboarding_started_at) return false;
  const started = new Date(data.onboarding_started_at).getTime();
  return Date.now() - started < 24 * 60 * 60 * 1000;  // 24h window
}
```

Cache the boost decision per-isolate for 1 minute to avoid repeated DB calls.

**Files**
- `supabase/functions/_shared/scale-guard.ts`

**Acceptance**
- User in first 24h of onboarding can scan 20+ garments without hitting limit
- Post-24h or post-completion: normal limits apply

**Deploy** Every AI function using scale-guard (batch across sessions).

---

### P44 — Route gate

**Problem**
No enforcement of onboarding completion. User can skip via direct URL.

**Fix**
Modify `src/components/auth/ProtectedRoute.tsx`:
```typescript
export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { data: profile } = useProfile();
  const location = useLocation();

  if (loading) return <PageSkeleton />;
  if (!user) return <Navigate to="/auth" replace />;

  const EXEMPT_PATHS = ['/paywall', '/billing/success', '/billing/cancel', '/auth', '/login', '/signup'];
  const isExempt = EXEMPT_PATHS.some(p => location.pathname.startsWith(p));

  if (profile && profile.onboarding_step !== 'completed' && !location.pathname.startsWith('/onboarding')) {
    return <Navigate to={`/onboarding?step=${profile.onboarding_step}`} replace />;
  }

  if (isExempt) return <>{children}</>;
  return <>{children}</>;
}
```

Block browser back navigation during onboarding:
```typescript
// src/pages/Onboarding.tsx
useEffect(() => {
  const handler = (e: PopStateEvent) => {
    if (profile?.onboarding_step !== 'completed') {
      e.preventDefault();
      window.history.pushState(null, '', window.location.href);
    }
  };
  window.addEventListener('popstate', handler);
  return () => window.removeEventListener('popstate', handler);
}, [profile]);
```

**Files**
- `src/components/auth/ProtectedRoute.tsx`
- `src/pages/Onboarding.tsx`

**Acceptance**
- User with onboarding_step != 'completed' can't navigate to `/home`, `/wardrobe`, etc.
- Back button during onboarding doesn't escape the flow
- Paywall + billing pages accessible

**Deploy** None.

---

### P45 — Style DNA Quiz (12-question rebuild)

**Problem**
Current `QuickStyleQuiz` captures ~6 fields. Spec requires 12-question comprehensive quiz.

**Fix**
Create new component `src/components/onboarding/StyleQuizV4.tsx`. Implement Q1-Q12 per spec in CLAUDE.md Launch Plan discussion:

1. Identity & body (gender, height, build, age)
2. Lifestyle mix (5 sliders summing 100%)
3. Climate & location (home city + secondary + climate type)
4. Style identity (3-5 archetypes from 12 + optional free-text icons)
5. Color DNA (3 favorites + 3 avoid + palette vibe + pattern comfort)
6. Fit & silhouette (overall + top vs bottom + layering + body focus)
7. Formality (ceiling + floor sliders)
8. Fabric & feel (preferred 3 + sensitivities + care preference)
9. Occasions (multi-select)
10. Shopping habits (frequency + budget + style)
11. Primary style goal (single select from 7)
12. Cultural/accessibility (optional free-text)

Save to `profiles.preferences.styleProfile` with new `version: 4` field for migration safety:
```typescript
{
  version: 4,
  gender: 'feminine',
  height: 170,
  build: 'athletic',
  // ... all 12 fields
}
```

**Files**
- `src/components/onboarding/StyleQuizV4.tsx` (new)
- `src/pages/Onboarding.tsx` (route to new quiz)
- `src/types/styleProfile.ts` (new — type definition)

**Acceptance**
- Completing quiz saves all 12 fields to profiles.preferences.styleProfile
- On reload, answers persist
- `onboarding_step` advances to `photo_tutorial`

**Deploy** None.

---

### P46 — PhotoTutorial screen

**Problem**
No screen teaching users how to photograph garments. Results in bad photos → bad enrichment → bad AI recommendations.

**Fix**
Create `src/components/onboarding/PhotoTutorialStep.tsx`:
- Hero illustration (4 good/bad photo examples)
- 5 bullet points: lighting, surface, full garment in frame, no people, one garment per photo
- "I'm ready" primary button → advances `onboarding_step` to `batch_capture`

**Files**
- `src/components/onboarding/PhotoTutorialStep.tsx` (new)
- `src/pages/Onboarding.tsx`
- `src/i18n/locales/*.ts` (new keys)
- `public/photo-tutorial-*.svg` or image assets

**Acceptance**
- Screen renders with visual guide
- "I'm ready" advances to next step
- Step persisted in DB

**Deploy** None.

---

### P47 — BatchCapture screen

**Problem**
Current add-garment UX captures one at a time with form filling. Onboarding needs rapid batch capture with minimal friction.

**Fix**
Create `src/components/onboarding/BatchCaptureStep.tsx`:
- Full-screen camera with AUTO-capture when garment in frame
- Each capture triggers: upload → `analyze_garment` (fast mode) → save to DB → increment `onboarding_garment_count`
- Progress bar: "X of 20 minimum"
- "Continue" button disabled until count >= 20
- "Done" button appears at count >= 30

Implementation:
- Reuse `useLiveScan` hook (update for batch mode)
- After each capture, call `enqueue_render_job` in background (fire-and-forget)
- No form — batch saves with AI-inferred fields, user can edit later

State persists via `profiles.onboarding_garment_count`. User closes app at 14 → resumes at 15.

**Files**
- `src/components/onboarding/BatchCaptureStep.tsx` (new)
- `src/hooks/useLiveScan.ts` (extend)
- `src/pages/Onboarding.tsx`

**Acceptance**
- Can capture 20+ garments in one session
- Count persists across app close/reopen
- "Continue" locks at < 20, unlocks at 20+
- Each garment saves immediately with `render_status='none'`, enrichment runs in background

**Deploy** None (uses existing edge functions).

---

### P48 — Achievement screen + grantTrialGift

**Problem**
Spec requires celebratory screen that grants 3 trial_gift render credits.

**Fix**
Create `src/components/onboarding/AchievementStep.tsx`:
- Playfair italic celebratory title
- Warm Gold accent
- Subtext mentions 3 free studio renders
- Primary button advances to `studio_selection`

On screen mount, call edge function that invokes `grantTrialGift(userId, 3, idempotencyKey)`:
```typescript
const idempotencyKey = `onboarding_gift_${userId}`;
await invokeEdgeFunction('grant_trial_gift', { body: { user_id: userId, amount: 3, idempotency_key: idempotencyKey } });
```

New edge function `grant_trial_gift` wraps the RPC:
```typescript
// supabase/functions/grant_trial_gift/index.ts
serve(async (req) => {
  const { user_id, amount, idempotency_key } = await req.json();
  // auth check user matches user_id
  const result = await grantTrialGift(serviceClient, user_id, amount, idempotency_key);
  return new Response(JSON.stringify(result), { headers });
});
```

**Files**
- `src/components/onboarding/AchievementStep.tsx` (new)
- `supabase/functions/grant_trial_gift/index.ts` (new — requires user approval since new edge function)
- `src/pages/Onboarding.tsx`

**Acceptance**
- Screen grants exactly 3 trial_gift credits (verify in render_credits table)
- Idempotent — reload doesn't grant more
- Advances to studio_selection

**Deploy** `grant_trial_gift` (new function deploy)

---

### P49 — StudioSelection screen

**Problem**
User picks 3 garments to see rendered during onboarding. Spec: cannot skip, must select exactly 3.

**Fix**
Create `src/components/onboarding/StudioSelectionStep.tsx`:
- Grid of all captured garments
- Multi-select with hard limit of 3 (disable further selection, allow deselect)
- "Generate" button disabled until exactly 3 selected
- On confirm: call `enqueue_render_job` 3 times (parallel) with `source: 'trial_gift'`
- Screen closes immediately; renders process in background
- Advances `onboarding_step` to `coach_tour`

Render job enqueue:
```typescript
await Promise.all(selectedIds.map(garmentId =>
  invokeEdgeFunction('enqueue_render_job', {
    body: {
      garmentId,
      source: 'trial_gift',
      clientNonce: crypto.randomUUID(),
    },
  })
));
```

**Files**
- `src/components/onboarding/StudioSelectionStep.tsx` (new)
- `src/pages/Onboarding.tsx`

**Acceptance**
- Exactly 3 garments selectable
- Cannot skip/close
- 3 render_jobs rows created with `source='trial_gift'`
- Trial credits consumed (reserved) from the 3 granted in P48

**Deploy** None.

---

### P50 — Coach Tour

**Problem**
New users don't know where things are. Spec: linear tour ending on a rendered garment.

**Fix**
Create `src/components/onboarding/CoachTour.tsx`:
- Full-screen overlay with callouts pointing to Home tiles, Wardrobe tabs, Outfits card, AI Chat button, Garment Detail sections
- Linear — "Next" advances to next stop
- Final stop: navigates to one of the 3 selected garments' detail page
- Subscribes to `render_status` via Supabase realtime; when render completes, fires the reveal
- Advances `onboarding_step` to `completed` AFTER reveal screen closes

Realtime subscription:
```typescript
const selectedId = selectedGarmentIds[0];  // first of the 3
useEffect(() => {
  const sub = supabase.channel(`garment:${selectedId}`)
    .on('postgres_changes', {
      event: 'UPDATE', schema: 'public', table: 'garments',
      filter: `id=eq.${selectedId}`,
    }, (payload) => {
      if (payload.new.render_status === 'ready') setRevealReady(true);
    })
    .subscribe();
  return () => { sub.unsubscribe(); };
}, [selectedId]);
```

**Files**
- `src/components/onboarding/CoachTour.tsx` (new)
- `src/pages/Onboarding.tsx`

**Acceptance**
- Tour steps linearly
- Lands on a garment detail
- Realtime reveals studio render when ready

**Deploy** None.

---

### P51 — Reveal screen

**Problem**
Final "wow moment" — user sees their garment as a studio render.

**Fix**
Create `src/components/onboarding/RevealStep.tsx`:
- Two-panel side-by-side: original photo ←→ studio render
- "Look what BURS did with your photo" copy
- If render ready → show render immediately
- If render still pending → show original + shimmer loader; subscribe to update (handled in P50)
- If render failed → show original + "still processing — we'll retry"; trigger auto-retry via `enqueue_render_job` with `force: true`
- "Continue" button sets `onboarding_step = 'completed'` + `onboarding_completed_at = NOW()`, navigates to `/home`

**Files**
- `src/components/onboarding/RevealStep.tsx` (new)
- `src/pages/Onboarding.tsx`

**Acceptance**
- Reveal shows studio render side-by-side
- Failure auto-retry doesn't block user
- Completion unlocks the app (route gate now allows all paths)

**Deploy** None.

---

## Wave 8 — Subscription Model Enforcement

### P52 — Auto-start trial on signup

**Problem**
Currently signup doesn't auto-create a Stripe customer or trial subscription. User can use the app as "free tier" indefinitely.

**Fix**
New edge function `start_trial` (or extend `create_checkout_session`):
1. Called on signup completion (from Auth.tsx after successful sign-up)
2. Creates Stripe customer with metadata.supabase_user_id
3. Creates Stripe subscription in trial mode with 3-day trial_end
4. Updates `profiles.stripe_customer_id` and inserts `subscriptions` row with `status='trialing'`, `plan='premium'`
5. Sets `profiles.onboarding_started_at = NOW()`

```typescript
// supabase/functions/start_trial/index.ts
serve(async (req) => {
  const { user_id } = await req.json();
  // auth check: caller's JWT user.id === user_id
  const stripe = new Stripe(...);
  const customer = await stripe.customers.create({ metadata: { supabase_user_id: user_id } });
  const subscription = await stripe.subscriptions.create({
    customer: customer.id,
    items: [{ price: priceIdMonthly }],
    trial_period_days: 3,
    payment_behavior: 'default_incomplete',
  });
  // Store state...
});
```

In `src/pages/Auth.tsx` signup flow, call this after successful signup.

**Files**
- `supabase/functions/start_trial/index.ts` (new)
- `src/pages/Auth.tsx`

**Acceptance**
- New signup has Stripe customer + trialing subscription + onboarding_started_at set
- 3-day trial end date correct
- Idempotent — re-signup doesn't create duplicate customers

**Deploy** `start_trial` (new function)

---

### P53 — Remove free tier

**Problem**
Currently `useSubscription` has a 'free' state path. Per spec: no free tier, only trial/premium/locked.

**Fix**
Refactor `src/hooks/useSubscription.ts`:
```typescript
type SubscriptionState = 'trialing' | 'premium' | 'locked';

export function useSubscription() {
  // ... existing query
  const state: SubscriptionState = useMemo(() => {
    if (!subscription) return 'locked';
    if (subscription.status === 'trialing') return 'trialing';
    if (subscription.status === 'active' && subscription.plan === 'premium') return 'premium';
    return 'locked';
  }, [subscription]);

  return { state, isPremium: state !== 'locked', ... };
}
```

Update all consumers:
- `PaywallModal` — show for `locked` state
- `PLAN_LIMITS` — only `premium` values, no `free`

**Files**
- `src/hooks/useSubscription.ts`
- Every consumer of `useSubscription` (grep `useSubscription`)

**Acceptance**
- No `free` plan state anywhere
- `locked` triggers paywall
- Existing premium users unaffected

**Deploy** None.

---

### P54 — Day-4 lockout enforcement

**Problem**
Trial users after day 3 should be locked out. Currently no enforcement.

**Fix**
Add `enforceSubscription` helper to `_shared/scale-guard.ts`:
```typescript
export async function enforceSubscription(
  supabaseAdmin: any, userId: string,
): Promise<{ allowed: true } | { allowed: false; reason: 'locked' | 'expired' }> {
  const { data } = await supabaseAdmin
    .from('subscriptions')
    .select('status, plan, trial_end')
    .eq('user_id', userId)
    .single();
  if (!data) return { allowed: false, reason: 'locked' };
  if (data.status === 'trialing') {
    if (data.trial_end && new Date(data.trial_end) < new Date()) {
      return { allowed: false, reason: 'expired' };
    }
    return { allowed: true };
  }
  if (data.status === 'active' && data.plan === 'premium') return { allowed: true };
  return { allowed: false, reason: 'locked' };
}

export function subscriptionLockedResponse(reason: string, cors: Record<string, string>): Response {
  return new Response(JSON.stringify({ error: 'subscription_required', reason }), {
    status: 402, headers: { ...cors, 'Content-Type': 'application/json' },
  });
}
```

Every AI function calls this after rate-limit, before expensive work:
```typescript
const sub = await enforceSubscription(serviceClient, userId);
if (!sub.allowed) return subscriptionLockedResponse(sub.reason, CORS_HEADERS);
```

**Files**
- `supabase/functions/_shared/scale-guard.ts`
- All AI functions (~20 consumers)

**Acceptance**
- Trial day-4 users get 402 responses
- Active premium users unaffected
- Locked users directed to paywall

**Deploy** All AI functions (batch across sessions).

---

### P55 — Paywall page with Restore Purchase

**Problem**
Spec: paywall must have visible "Restore Purchase" button (App Store requirement).

**Fix**
Update `src/components/PaywallModal.tsx` (or new page `src/pages/Paywall.tsx`):
- Hero copy: trial ended / subscribe to continue
- Two plan cards (monthly 119 SEK / yearly 899 SEK)
- Primary CTA: "Start subscription" → Stripe checkout
- Secondary CTA: "Restore Purchase" → calls `restore_subscription` edge function
- Required by Apple for iOS App Store approval

**Files**
- `src/components/PaywallModal.tsx`
- `src/pages/marketing/Paywall.tsx` (if separate page)

**Acceptance**
- Paywall displays both CTAs
- Restore flow calls `restore_subscription`, updates subscription state, redirects to home if active found

**Deploy** None.

---

### P56 — SEK pricing in Stripe

**Problem**
Current Stripe setup may have USD prices. Spec: 119 SEK/month, 899 SEK/year.

**Fix**
1. In Stripe Dashboard: create two new SEK prices on existing Product
2. Update env vars:
   - `STRIPE_PRICE_ID_MONTHLY_LIVE` / `_TEST` → SEK price IDs
   - Same for YEARLY
3. Deploy `create_checkout_session` + `stripe_webhook` to pick up new env

**Files**
- `.env.example` (document)
- No code changes if env vars already used (verify)

**Acceptance**
- Checkout shows SEK amounts (119 / 899)
- Webhook processes SEK subscriptions correctly

**Deploy** `create_checkout_session`, `stripe_webhook`

---

### P57 — Credit priority verification

**Problem**
Spec: credit consume priority is trial_gift → monthly → topup. Need to verify `reserve_credit_atomic` RPC implements this.

**Fix**
1. Inspect the RPC in DB: `SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname = 'reserve_credit_atomic'`
2. Verify priority order in the function body
3. If incorrect: migration to update the RPC

Likely already correct per `render-credits.ts` comments. Verify only.

**Files**
- Possibly new migration if RPC needs correction

**Acceptance**
- Test: user with 3 trial_gift + 20 monthly + 5 topup → first 3 reserves consume trial_gift, next 20 consume monthly, last 5 consume topup
- All balances end at 0

**Deploy** None (if RPC already correct)

---

## Wave 9 — Capacitor Migration

Note: Details for Wave 9 are scoped at execution time. The specs below are structural — the actual work depends on Capacitor's current version and plugin availability at session time. Each prompt requires reading Capacitor docs first.

### P58 — Capacitor scaffold

**Problem**
App currently wrapped via Median.co. Capacitor migration needed for proper IAP, native features, App Store submission.

**Fix**
1. `npm install @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android`
2. `npx cap init BURS me.burs.app --web-dir=dist`
3. `npx cap add ios`
4. `npx cap add android`
5. Configure `capacitor.config.ts`:
   - `appId: 'me.burs.app'`
   - `appName: 'BURS'`
   - `webDir: 'dist'`
   - `server.androidScheme: 'https'`
   - Icon/splash settings

**Files**
- `capacitor.config.ts` (new)
- `ios/` (generated)
- `android/` (generated)
- `package.json` (new deps)

**Acceptance**
- `npx cap sync` works
- `npx cap run ios` launches in simulator
- `npx cap run android` launches in emulator

**Deploy** None.

---

### P59 — Camera: Median → @capacitor/camera

**Problem**
`src/hooks/useMedianCamera.ts` uses Median bridge. Replace with Capacitor.

**Fix**
1. `npm install @capacitor/camera`
2. Create `src/hooks/useCamera.ts`:
```typescript
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

export function useCamera() {
  const takePhoto = async () => {
    const photo = await Camera.getPhoto({
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Camera,
      quality: 85,
      width: 1024,
    });
    return photo.dataUrl;
  };
  // ... pickFromGallery similar
  return { takePhoto, pickFromGallery };
}
```
3. Update all consumers (`AddGarment.tsx`, `LiveScan.tsx`, `useAddGarment.ts`) to use new hook.
4. Delete `src/hooks/useMedianCamera.ts`.

**Files**
- `src/hooks/useCamera.ts` (new)
- `src/hooks/useMedianCamera.ts` (delete)
- All consumers

**Acceptance**
- Camera opens on iOS and Android
- Photo quality settings preserved
- Gallery picker works

**Deploy** None.

---

### P60 — Status bar: Median → @capacitor/status-bar

Similar pattern to P59. Install `@capacitor/status-bar`, replace `useMedianStatusBar.ts`.

**Files**
- `src/hooks/useStatusBar.ts` (new)
- `src/hooks/useMedianStatusBar.ts` (delete)
- Consumers

---

### P61 — Haptics: Median bridge → @capacitor/haptics

Replace `src/lib/haptics.ts` with `@capacitor/haptics`.

---

### P62 — Deep links via @capacitor/app

Install, configure, handle app-level URL opens.

---

### P63 — Push notifications via @capacitor/push-notifications

Replace web push with native where beneficial.

---

### P64 — Splash screen + app icon

Asset generation via `@capacitor/assets` plugin.

---

### P65 — iOS Info.plist permissions

Add usage descriptions for camera, photo library.

---

### P66 — Android manifest permissions

Same as P65 for Android.

---

### P67 — Safe-area handling

Replace Median approach with Capacitor's `@capacitor/status-bar` + CSS safe-area-inset.

---

### P68 — Share API via @capacitor/share

Replace `src/lib/nativeShare.ts` Median bridge.

---

### P69 — Remove all Median files

After Waves 58-68 validated:
- Delete `src/hooks/useMedianCamera.ts`
- Delete `src/hooks/useMedianStatusBar.ts`
- Delete `src/lib/median.ts`
- Remove any remaining Median references

---

## Wave 10 — RevenueCat + StoreKit IAP

Note: RevenueCat specifics decided at execution time based on current API.

### P70 — RevenueCat account + SDK install

- Create RevenueCat account
- `npm install @revenuecat/purchases-capacitor`
- Initialize SDK on app launch

---

### P71 — RevenueCat webhook → Supabase mirror

- New edge function `revenuecat_webhook` that receives RC events
- Mirrors subscription state to `subscriptions` table (same shape as Stripe webhook)

---

### P72 — Configure products in App Store Connect + RevenueCat

- Create monthly + yearly subscriptions in ASC
- Link in RevenueCat dashboard
- Match SKU names to Stripe product IDs for cross-platform consistency

---

### P73 — Client-side purchase flow

- `useRevenueCat` hook for Offerings, Purchase, CustomerInfo
- Integrate into PaywallModal

---

### P74 — Restore purchases flow

- Call `Purchases.restorePurchases()` on "Restore" button
- Update subscription state

---

### P75 — Dual-path billing resolver

- `useSubscription` detects platform (iOS vs other)
- iOS → RevenueCat
- Web/Android → Stripe (both write to same `subscriptions` table)

---

### P76 — iOS introductory offer

- Configure 3-day free trial as introductory offer in ASC
- Verify first-purchase triggers it
- Align with Stripe trial for parity

---

### P77 — Receipt validation defense endpoint

- New edge function `verify_iap_receipt` as defense-in-depth
- RevenueCat handles most, but endpoint allows independent verification

---

## Wave 11 — Launch Prep

### P78 — App Store Connect listing

- Screenshots (5 required per device size)
- App description
- Privacy policy URL (must exist before submission)
- Support URL
- Marketing URL
- Categories, age rating

---

### P79 — App Privacy labels

- Fill out App Privacy questionnaire
- Declare data collection (email, usage, purchases)
- ATT if analytics SDKs require it

---

### P80 — TestFlight beta

- Internal testers first (team + self)
- External beta (friends, small group) — up to 10k testers
- Collect crash reports via Sentry

---

### P81 — Play Store listing + monitoring + launch checklist

**Play Store:**
- Screenshots, description
- Content rating
- Data safety section

**Monitoring:**
- Sentry alerts for high error rates
- Supabase log retention set
- Render queue depth dashboard (Grafana / Supabase + queries)

**Launch checklist (one-shot):**
- All env vars set in production Supabase
- Migration freeze audit (no pending local migrations)
- Webhook endpoints verified (Stripe + RevenueCat both hit production)
- Resend DNS records verified
- App Store + Play Store both approved
- Marketing plan greenlit

---

# End of Detailed Launch Plan

Status tracking lives in CLAUDE.md's Launch Plan section. This file holds scope only.
