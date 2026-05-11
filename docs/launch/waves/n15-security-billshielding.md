# N15 — Pre-launch security + bill-shielding

| Field | Value |
|---|---|
| Goal | Close the two P0 security issues and the four compounding bill-shielding bugs surfaced by the 2026-05-11 multi-agent audit. Pre-launch blocker — must land before Sweden Day-1. |
| Status | TODO |
| Branch | `mobile-n15-security-billshielding` |
| PR count | 1 |
| Depends on | N14 (clean main) |
| Complexity | L (4 migrations + 5 edge-function code changes) |

## Background

The 2026-05-11 multi-agent audit found two cross-user data leaks and four compounding bill-shielding gaps that together make a free user's Gemini bill effectively unbounded. None of the failure modes are theoretical; every one is reachable today by an authenticated client. This wave closes the most exploitable subset in one PR.

Findings IDs reference the consolidated audit report.

## Items

### Migrations (require `npx supabase db push --linked --yes` after merge)

| ID | Description |
|---|---|
| **B1** | `user_style_profiles` RLS: the existing `USING (true) WITH CHECK (true)` policy is missing a `TO service_role` clause, so under Postgres permissive RLS it applies to **PUBLIC**. Any authenticated user can read/write every other user's style profile via PostgREST. Drop the policy and recreate it with `TO service_role`. |
| **B3** | `cleanup_old_rate_limits()` SQL function plus an hourly `pg_cron` schedule, mirroring `request_idempotency_cleanup`. `scale-guard.ts` already calls `supabase.rpc("cleanup_old_rate_limits")` at line 313 on a 1% probabilistic basis, but the function does not exist in any migration — `ai_rate_limits` has been growing unbounded with no pruning. |
| **B4** | `handle_new_user` trigger CREATE OR REPLACE — set `subscriptions.monthly_token_quota_micros = 2_000_000` on the new free-tier row (`burs-ai.ts:227` falls through to "no enforcement" when the column is NULL) AND pin `SET search_path = public, auth` so the function doesn't break if Supabase changes role defaults. |
| **BE P0-B2** | `sum_ai_token_usage_for_month(p_user_id uuid, p_month_start timestamptz) returns bigint` RPC — server-side `SUM(cost_micros)` so the per-call usage budget check stops shipping every row of monthly history to the edge function and iterating in JS. |

### Code-only (no migration)

| ID | Description |
|---|---|
| **B2** | `outfit_photo_feedback/index.ts` — verify `outfit_id` belongs to `user.id` AND verify `selfie_path` starts with `${user.id}/` before any service-role storage/DB query. The function currently trusts both fields from the request body, then uses a service-role client to fetch outfit_items + sign storage URLs for arbitrary paths — Gemini's response references the victim's wardrobe metadata. |
| **B9** | `_shared/scale-guard.ts:276-279` — change the DB-error branch of `enforceRateLimit` from `return { allowed: true }` to throw `RateLimitError`. The current fail-OPEN means any transient `ai_rate_limits` query failure unlocks unlimited expensive AI calls. |
| **BE P0-B5** | `_shared/scale-guard.ts:302-306` — await the post-check INSERT into `ai_rate_limits` instead of fire-and-forget. Concurrent isolates currently each pass the count check before the row is committed, letting a hot user briefly exceed the configured burst. |
| **BE P0-B4** | `_shared/burs-ai.ts` `checkCache` — accept an optional `userId` and apply `.eq("user_id", userId)` to the cache lookup when present. Today the cache is honor-system per-user via the namespace string; a single dev typo on a `cacheNamespace` becomes a cross-user response leak. Combined with `storeCache` (which already records `user_id`), the column-level filter is correct defense-in-depth. |
| **burs-ai.ts** | Rewrite `readUsageBudget` to call the new `sum_ai_token_usage_for_month` RPC (paired with the BE P0-B2 migration). |

## Files touched

### New
- `supabase/migrations/<ts>_n15_user_style_profiles_rls_fix.sql` — B1
- `supabase/migrations/<ts>_n15_cleanup_old_rate_limits.sql` — B3 (RPC + cron)
- `supabase/migrations/<ts>_n15_handle_new_user_quota.sql` — B4
- `supabase/migrations/<ts>_n15_sum_ai_token_usage.sql` — BE P0-B2

### Modified
- `supabase/functions/outfit_photo_feedback/index.ts` — B2
- `supabase/functions/_shared/scale-guard.ts` — B9 + BE P0-B5
- `supabase/functions/_shared/burs-ai.ts` — BE P0-B4 + readUsageBudget rewrite

## Method

For each finding, smallest viable diff. Migration timestamps land sequentially in the order above. No `apply_migration` via MCP from this branch — CLAUDE.md hard rule says migrations are applied post-merge via `npx supabase db push --linked --yes` from main.

### B1 detail
```sql
DROP POLICY "Service role full access to style profiles" ON public.user_style_profiles;
CREATE POLICY "Service role full access to style profiles"
  ON public.user_style_profiles
  AS PERMISSIVE
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
```
The owner-scoped SELECT/INSERT/UPDATE policies already exist (lines 1994, 2076, 2084 of the initial schema) and continue to protect authenticated-role reads/writes after the bad policy is removed.

### B3 detail
```sql
CREATE OR REPLACE FUNCTION public.cleanup_old_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.ai_rate_limits WHERE called_at < NOW() - INTERVAL '7 days';
END;
$$;
REVOKE EXECUTE ON FUNCTION public.cleanup_old_rate_limits() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_old_rate_limits() TO service_role;

SELECT cron.schedule(
  'cleanup_old_rate_limits_hourly',
  '13 * * * *',
  $$SELECT public.cleanup_old_rate_limits();$$
);
```

### B4 detail
Read the existing `handle_new_user` body verbatim, change only the `subscriptions` INSERT to include `monthly_token_quota_micros = 2000000`, add the `SET search_path = public, auth` function-level attribute. No other behaviour change.

### BE P0-B2 detail
```sql
CREATE OR REPLACE FUNCTION public.sum_ai_token_usage_for_month(p_user_id uuid, p_month_start timestamptz)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(cost_micros), 0)::bigint
  FROM public.ai_token_usage
  WHERE user_id = p_user_id AND occurred_at >= p_month_start;
$$;
REVOKE EXECUTE ON FUNCTION public.sum_ai_token_usage_for_month(uuid, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sum_ai_token_usage_for_month(uuid, timestamptz) TO service_role;
```
`burs-ai.ts` `readUsageBudget` rewrites the SUM via `supabase.rpc("sum_ai_token_usage_for_month", { p_user_id, p_month_start }).single()`. Falls back to the old code path if RPC errors (graceful degrade during migration window).

### B2 detail
After `const { outfit_id, selfie_path } = await req.json();`, before the `outfit_items` query:
```ts
const { data: outfitOwner } = await supabase.from("outfits").select("user_id").eq("id", outfit_id).maybeSingle();
if (!outfitOwner || outfitOwner.user_id !== user.id) {
  return new Response(JSON.stringify({ error: "Outfit not found" }), { status: 404, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
}
if (!selfie_path.startsWith(`${user.id}/`)) {
  return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
}
```
404 (not 403) on the outfit-ownership branch avoids leaking outfit-existence to enumerators.

### B9 detail
```ts
if (hourResult.error || minuteResult.error) {
  console.warn("Rate limit check failed:", hourResult.error || minuteResult.error);
  throw new RateLimitError(...);  // fail closed
}
```

### BE P0-B5 detail
```ts
const { error: insertErr } = await supabase.from("ai_rate_limits").insert({ user_id: userId, function_name: functionName });
if (insertErr) {
  console.warn("Rate limit record failed:", insertErr);  // log but don't fail the call
}
```
Awaiting closes the burst-slip window; logging the error preserves call success when the recording is the only thing that fails.

### BE P0-B4 detail
Extend `checkCache(supabase, cacheKey, userId?)` — when `userId` is supplied, `.eq("user_id", userId)` is appended. Audit callers and add `userId` to every site that's already inside a user-scoped function.

## Acceptance gates

- `deno check supabase/functions/outfit_photo_feedback/index.ts` — clean
- `deno check supabase/functions/_shared/scale-guard.ts` — clean
- `deno check supabase/functions/_shared/burs-ai.ts` — clean
- Mobile gates unchanged (only backend touched): `npx tsc --noEmit`, `npx eslint "src/**/*.{ts,tsx}" --max-warnings 0`, `npx jest`, `npx expo-doctor`
- Migration drift check: `npx supabase migration list --linked` shows the four new files only after explicit push

## Anti-patterns

- Don't `apply_migration` via MCP from this branch — migration application is post-merge per CLAUDE.md.
- Don't expand the rate-limit insert into a wrapping RPC in this wave; the `await` alone closes the burst-slip window. Atomic count+insert is post-launch optimisation.
- Don't change the existing `resolveUserPlan` 5-min isolate cache — the audit already noted that's been fixed.
- Don't refactor `checkCache` signature beyond adding the optional `userId`. Existing callers must keep working.

## Out of scope (deferred to later N-waves per audit roadmap)

- **N16** — i18n closeout (summarize_day locale, mobile hardcoded English strings, import_garments_from_links auto-classify). NOTE: `generate_flatlay` model bug is **dropped from N16 scope per 2026-05-11 user direction** ("flat lay generation we do not need").
- **N17** — GarmentDetail completeness (Outfits tab, Similar tab, multi-image, AI enrichment panel).
- **N18** — AI smartness (feedback loops, StyleProfile in mood/photo, prompt-injection sanitization).
- **N19** — Mobile a11y + Dynamic Type + perf.
- **N20** — Schema integrity sweep (search_path on ledger RPCs, outfit_items UNIQUE, analytics indexes, cross-FK ownership).
- **N21** — Wardrobe bulk ops + chat refine + image-share.
- **N22** — Post-launch hardening (SecureStore, pgsodium, user_subscriptions strangle).
