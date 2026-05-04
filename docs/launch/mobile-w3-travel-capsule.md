# Mobile Launch — M3 — Travel capsule end-to-end

**Goal:** Wire the Travel wizard (TravelCapsule → TravelMustHaves → TravelPackingList) end-to-end against the existing `travel_capsule` edge function, replace `GARMENT_FIXTURES` and `SECTIONS` placeholder data, and persist generated capsules in `travel_capsules` table.

**Status:** 🔜 TODO
**Branch:** `mobile-w3-travel-capsule`
**PR count:** 1
**Depends on:** M0
**Complexity:** L

---

## Background

`supabase/functions/travel_capsule/index.ts` (1235 lines) already exists — pack-worthiness scoring, Gemini tool-use, deterministic fallback. `travel_capsules` table exists. Web `src/hooks/useTravelCapsules.ts` is the reference implementation to port.

---

## Files touched

**New:**
- `mobile/src/hooks/useTravelCapsules.ts` (port from `src/hooks/useTravelCapsules.ts`)
- `mobile/src/hooks/useGenerateTravelCapsule.ts` (calls edge function)

**Modified:**
- `mobile/src/screens/TravelCapsuleScreen.tsx` — L247-248 area (thread route params on Next)
- `mobile/src/screens/TravelMustHavesScreen.tsx` — delete L38-54 GARMENT_FIXTURES, replace with `useFlatGarments({ inLaundry: false })`, accept route params
- `mobile/src/screens/TravelPackingListScreen.tsx` — delete L41-81 SECTIONS, fire `useGenerateTravelCapsule` on mount, render result
- `mobile/src/RootNavigator.tsx` — extend RootStackParamList with TravelMustHaves and TravelPackingList route param shapes

**Tracker (same PR):** mobile-launch-overview.md, completion-log.md, root CLAUDE.md.

---

## Code skeletons

**Full verbatim hook + screen wiring code:** see `docs/launch/mobile-launch-fix-plan-2026-05-31.md` § P1.4 (Travel Capsule End-to-End). Read with `Read offset:600 limit:300` (approximate — locate via `Grep "P1.4 — Travel Capsule" docs/launch/mobile-launch-fix-plan-2026-05-31.md`).

The master plan has:
- `useTravelCapsules` full implementation (CRUD over `travel_capsules` table)
- `useGenerateTravelCapsule` full implementation (POST to `travel_capsule` edge function with subscription_required → 402 handling)
- `TravelMustHavesScreen` diff (route params + `useFlatGarments({ inLaundry: false })`)
- `TravelPackingListScreen` diff (mount-time generation, render packing_list)
- `RootStackParamList` route param extensions

Apply verbatim. The only adaptation: when persisting the generated capsule, call `useTravelCapsules().save.mutate(...)` after `useGenerateTravelCapsule` returns successfully so the result lands in `travel_capsules` table for re-display.

---

## Acceptance gates

```bash
cd mobile && npx tsc --noEmit
```
0 errors.

**Manual smoke test:**
1. Plan → Travel → enter Lisbon, 5 days, beach trip → tap Next.
2. TravelMustHaves shows real wardrobe garments (not the 15 mock fixtures). Select 3.
3. Tap Next.
4. TravelPackingList shows AI-generated capsule (≥1 outfit, ≥3 packing categories, real reasoning text).
5. Free user without trial: Generate hits 402 → screen shows paywall Alert.
6. Verify `travel_capsules` table has a new row with `must_haves`, `packing_list`, `weather_summary` populated.

**Grep verification:**
```bash
grep -n "GARMENT_FIXTURES\|SECTIONS\s*=" mobile/src/screens/Travel*.tsx
```
Zero matches.

**Code-reviewer subagent:** mandatory.

---

## PR template

**Title:** `feat(mobile): M3 — travel capsule end-to-end (hooks + thread wizard state)`

**Body sections:** Problem (Travel wizard renders fixtures, no persistence). Fix (port useTravelCapsules + useGenerateTravelCapsule; thread state across 3 screens; replace fixtures). Files touched (above). Verification (above). Out of scope: outfit-card-style render polish (deferred to M10).

---

## Tracker updates (in this PR)

- mobile-launch-overview.md: M3 → DONE, pointer → M4.
- completion-log.md: append M3 row.
- CLAUDE.md root: CURRENT WAVE → `Mobile Launch M4 — Style DNA + wardrobe stats`.
