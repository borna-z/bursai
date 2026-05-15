# Phase 0 — Style engine variety

**Roadmap:** [Modularization roadmap](./2026-05-16-burs-modularization-roadmap.md)
**Next phase:** [Phase 1 — State foundations](./2026-05-16-burs-modularization-phase-1-state-foundations-design.md)
**Suggested branch:** `feat/style-engine-variety`

## Problem

Generating an outfit for the same occasion twice in a row returns the same outfit. Users perceive the style engine as broken even though the wardrobe could support dozens of distinct combinations.

## Root cause (from audit)

`supabase/functions/burs_style_engine/index.ts` is a hybrid pipeline:

1. Score every garment per slot via `scoreGarment()` (line ~1453).
2. Build combinations via `buildCombos()` (line ~1458) — already passes the user's **last 10 saved outfits** as `recentOutfitSets` to dedup against worn looks.
3. Send the top 10 scored combos to `aiRefine()` (line ~1541) which is gated by the AI response cache (`cacheNamespace: "style_engine"`, line ~1538).
4. An "active look guard" (line ~1599) swaps the result if it exactly matches the outfit the user is currently wearing.

Two problems compound:

- **Cache determinism.** `aiRefine()` keys the cache on the prompt content (occasion, style, weather, candidate combos). Repeated identical inputs return the cached LLM choice → identical outfit forever.
- **Shown-vs-worn confusion.** The recency dedup uses *saved* outfits (`outfit_items`). When a user generates ten times without saving, the dedup history stays empty. The engine has no memory that it already showed them a look.

## Goal

A user tapping "Generate" repeatedly on the same occasion/weather/style should see meaningfully different outfits until the wardrobe is exhausted, without disabling caching for cost-sensitive distinct (user, occasion) pairs.

## Approach

Three orthogonal levers, applied together:

1. **Track shown outfits, not just saved ones.** Log every outfit the engine returns (item-set hash + timestamp + occasion) in a new `style_engine_suggestion_log` table. Read the last ~30 entries on subsequent calls.
2. **Recency penalty in scoring.** In `outfit-scoring.ts`, add a soft penalty for garments that appear in any of the last N (default 20) shown outfit hashes. Penalty decays with recency rank. Garments missing from all recent logs get a small "freshness bonus" so under-used pieces surface.
3. **Cache key variation on user-initiated regenerate.** Add a `regenerate_token` parameter (UUID minted on the mobile side) to the request body. The token is mixed into the AI cache key, so a deliberate "Try again" tap always misses cache, while ambient calls (initial load, background prefetch) keep their cache hits.

The active-look guard stays as a hard backstop.

## Scope

### In scope

- New table + migration for shown-outfit log.
- Read/write helpers in `burs_style_engine/index.ts`.
- New `recentSuggestionPenalty()` in `_shared/outfit-scoring.ts`, wired into the per-slot score.
- New `regenerate_token` request param in the edge function schema; passed through to AI cache key.
- Mobile hook change in `useGenerateOutfit.ts` to mint a new UUID when the user explicitly taps regenerate.
- Unit tests for the scoring penalty (Deno test in `_shared/__tests__/outfit-scoring.test.ts`).
- Integration test that 20 sequential Generates against a seeded wardrobe return ≥10 distinct item-sets.

### Out of scope

- Restructuring `burs_style_engine/index.ts` into sub-modules (that's Phase 5).
- Changing the AI provider or prompt schema beyond the new cache key field.
- Surfacing variety controls in the UI ("show me bolder", etc.).
- Removing the active-look guard.

## Files touched

| Path | Change |
|---|---|
| `supabase/migrations/<timestamp>_style_engine_suggestion_log.sql` | New table: `style_engine_suggestion_log(user_id uuid, outfit_hash text, occasion text, generated_at timestamptz default now())`. RLS: user can only read/write own rows. Index on `(user_id, generated_at desc)`. |
| `supabase/functions/burs_style_engine/index.ts` | After `aiRefine` resolves, `INSERT` the chosen outfit's item-set hash. Before scoring, `SELECT` the user's last 30 hashes and decompose to a per-garment recency rank map. Pass map into `scoreGarment`. Accept `regenerate_token` field and forward to AI call so it joins the cache key. |
| `supabase/functions/_shared/outfit-scoring.ts` | New `recentSuggestionPenalty(garmentId, recencyMap)` returning a `[-maxPenalty, +freshnessBonus]` adjustment. Add to total slot score. Keep existing feedback penalties untouched. |
| `supabase/functions/_shared/outfit-scoring.test.ts` *(new)* | Cases: garment in rank 1 → max penalty; garment in rank 20 → near-zero; garment in no recent set → small bonus; deterministic given same inputs. |
| `mobile/src/hooks/useGenerateOutfit.ts` | When the call is triggered by an explicit user action (regenerate / try-again), mint `regenerate_token = uuid()` and include in the body. Initial load + prefetch omit the field to preserve cache hits. |

## Acceptance criteria

- **Variety** — In a Deno integration test seeded with a 12-piece wardrobe and one occasion, 20 sequential `mode: 'generate'` calls return ≥ 10 distinct outfit hashes.
- **Cache health** — Calls without `regenerate_token` against identical inputs still hit cache (verified by counter in Supabase logs OR by mocking the AI client in a unit test).
- **Wardrobe-too-small fallback** — When the recency-penalty filter would eliminate all candidates, the engine returns its best-scored combo anyway and includes `low_variety: true` in the response so the mobile side can surface a hint (UI surface deferred — backend flag only).
- **No public API break** — Existing callers without `regenerate_token` continue to work; the field is optional.
- **Migration discipline** — Migration file committed in same PR as the function change; idempotent (`IF NOT EXISTS`); RLS verified.
- **Tests green** — `npx supabase functions test burs_style_engine` (if present) passes; new `outfit-scoring.test.ts` passes; mobile unit tests untouched.

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Logging every shown outfit balloons table size | Cap retention: a follow-up cron deletes rows older than 30 days. Add to spec for future cron pass — not implemented in this phase but noted in the migration's comment. |
| Recency penalty over-rotates and surfaces low-quality looks | Penalty magnitude is conservative (max 15% of total score). Tune by examining test outputs. |
| Mobile sends `regenerate_token` on every call by accident | Test: assert initial-mount fetch has no token; explicit user tap has one. |

## Verification before completion

```bash
# Lint
npx eslint "mobile/src/**/*.{ts,tsx}" --max-warnings 0

# Mobile tests
npm test --prefix mobile

# Edge function tests (from supabase/functions dir)
deno test --allow-all _shared/outfit-scoring.test.ts

# Local edge function smoke
npx supabase functions serve burs_style_engine
# then curl with two identical bodies, then one with regenerate_token, observe responses
```

After merge: `npx supabase functions deploy burs_style_engine --project-ref khvkwojtlkcvxjxztduj --no-verify-jwt` and `npx supabase db push --linked --yes` from `main`.

## When picking this up cold

1. Read `mobile/src/hooks/useGenerateOutfit.ts` end-to-end.
2. Read `supabase/functions/burs_style_engine/index.ts` lines 1200–1650 (the scoring → buildCombos → aiRefine → activeLook block).
3. Read `supabase/functions/_shared/outfit-scoring.ts` end-to-end.
4. Read `supabase/functions/_shared/burs-ai.ts` to understand how `cacheNamespace` and the prompt hash combine to form the cache key — this dictates exactly where `regenerate_token` must be injected.
