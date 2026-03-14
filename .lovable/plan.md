

# Fixing Incomplete Steps in the 25-Step Roadmap

## Audit Findings

After reviewing every file, I found that **many steps created utilities but never integrated them** into the actual codebase. The utilities exist as dead code. Here's exactly what's missing:

---

## Gap 1: `invokeEdgeFunction` Never Used (Steps 15/18)
**Problem:** Created `edgeFunctionClient.ts` with retry + timeout, but all 26+ edge function calls still use raw `supabase.functions.invoke()` directly.

**Fix:** Replace the most critical edge function calls (outfit generation, garment analysis, style engine, travel capsule) with `invokeEdgeFunction`. These are the long-running AI calls that actually need timeout + retry. Keep lightweight calls (e.g. checkout) as-is.

**Files:** `useOutfitGenerator.ts`, `useAnalyzeGarment.ts`, `useAISuggestions.ts`, `useDaySummary.ts`, `TravelCapsule.tsx`, `useAdvancedFeatures.ts`, `useFlatlay.ts`

---

## Gap 2: `useSupabaseQuery` Never Adopted (Step 20)
**Problem:** Created a generic hook but no data hooks use it.

**Fix:** Migrate 2-3 simple query hooks to use it as proof of pattern: `useInsights`, `usePlannedOutfits`, `useCalendarSync`. Leave complex hooks (useGarments with infinite query) unchanged since they don't fit the abstraction.

---

## Gap 3: `StaleIndicator` Never Rendered (Step 17)
**Problem:** Component exists but is never mounted anywhere.

**Fix:** Add it to the AI-generated sections that benefit from freshness awareness: the Insights page (AI suggestions section), the Day Summary card, and the Style Report card.

---

## Gap 4: Type Helpers Never Used (Step 23)
**Problem:** `asPreferences()`, `asStyleScore()`, `asWeather()` exist in `types/preferences.ts` but all 16+ files still cast with `Record<string, any>`.

**Fix:** Replace `preferences as Record<string, any>` with `asPreferences(preferences)` across client-side files: `Index.tsx`, `Onboarding.tsx`, `ProtectedRoute.tsx`, `useOnboarding.ts`, `LanguageContext.tsx`, `ThemeContext.tsx`, `SettingsPrivacy.tsx`, `useDaySummary.ts`.

---

## Gap 5: Zod Schema Validation Never Applied to Data Hooks (Step 16)
**Problem:** `safeParse` and schemas exist but no query hooks validate fetched data.

**Fix:** Add schema validation to `useProfile` (using `profileSchema`) and `useOutfit` (using `outfitSchema`) — the two most critical data paths.

---

## Gap 6: Offline Queue Not Integrated with Mutations (Step 19)
**Problem:** `enqueue()` and `enqueueUpload()` exist but no mutation hooks call them when offline.

**Fix:** Add offline-aware wrappers to `useCreateGarment` and `useUpdateGarment` — when `!navigator.onLine`, enqueue the mutation instead of calling Supabase directly. This makes the offline queue actually functional.

---

## Implementation Order

1. **Type helpers adoption** (Step 23) — safest, pure refactor across ~10 files
2. **`invokeEdgeFunction` adoption** (Steps 15/18) — wire into ~7 AI-heavy hooks
3. **`StaleIndicator` integration** (Step 17) — add to 3 components
4. **Zod validation in hooks** (Step 16) — add to `useProfile` and `useOutfit`
5. **`useSupabaseQuery` adoption** (Step 20) — migrate 2-3 simple hooks
6. **Offline queue integration** (Step 19) — wrap create/update garment mutations

**Estimated scope:** ~15-20 files modified, no new files needed. All changes are integration work connecting existing utilities to the live code paths.

