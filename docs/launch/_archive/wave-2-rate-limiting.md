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

