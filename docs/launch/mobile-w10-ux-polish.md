# Mobile Launch — M10 — UX polish: weather + photo replace + locale parser + StyleMe persist + day summary + photo feedback + sweep

**Goal:** Bundle the high-quality UX polish items: real weather on StyleMe, garment photo replacement, locale-aware decimal parser (Sweden), StyleMe outfit persistence, day-summary on Home, photo feedback signals, and the Coming-soon row sweep (delete dead avatar row, hide rows that don't have an implementation behind them).

**Status:** 🔜 TODO
**Branch:** `mobile-w10-ux-polish`
**PR count:** 1 (large but tightly themed)
**Depends on:** M0; M3 if Travel weather is also touched
**Complexity:** M

---

## Files touched

**New:**
- `mobile/src/hooks/useWeather.ts` (port from `src/hooks/useWeather.ts`; uses `expo-location` for device coords)
- `mobile/src/hooks/useReplaceGarmentImage.ts` (new — image picker + upload + update + delete prior storage object)
- `mobile/src/hooks/useDaySummary.ts` (port from `src/hooks/useDaySummary.ts`)
- `mobile/src/hooks/usePhotoFeedback.ts` + `useFeedbackSignals.ts` (ports from web)
- `mobile/src/lib/parsePrice.ts` (new — locale-aware decimal helper)
- `mobile/src/lib/__tests__/parsePrice.test.ts` (when jest-expo lands)

**Modified:**
- `mobile/src/screens/StyleMeScreen.tsx` — L179 (real weather), L184 ("Adjust" hidden — moved to v1.0.1), L253/261 (real Save → outfits row insert)
- `mobile/src/screens/EditGarmentScreen.tsx` — L166 (locale-aware decimal parser), L331 (real photo replacement)
- `mobile/src/screens/HomeScreen.tsx` — wire useDaySummary section
- `mobile/src/screens/OutfitDetailScreen.tsx` — wire usePhotoFeedback (reaction buttons)
- `mobile/src/screens/MonthCalendarScreen.tsx` — delete L1-6 stale "Mock-data only" comment
- `mobile/src/screens/SettingsAccountScreen.tsx` — DELETE the L77 avatar-upload row entirely (bucket dropped 2026-04-21), L125 hide Google sign-in row
- `mobile/src/screens/SettingsStyleScreen.tsx` — L112 hide style-words edit, L120 hide color-prefs edit
- `mobile/src/screens/StyleChatScreen.tsx` — L205 (now wired via M9 — but also hide the "Coming soon" path for the legacy row if any)
- `mobile/src/screens/StyleMeScreen.tsx` — L184 hide "Adjust" weather customisation
- `mobile/src/screens/TravelPackingListScreen.tsx` — L94 hide Share button until v1.0.1
- `mobile/src/screens/ProfileScreen.tsx` — replace useMockRefresh with real refetch (covered in M4 but verify)
- `mobile/src/screens/WardrobeScreen.tsx` — real avatar initial from useAuth profile, hide Wishlist tile

**Tracker (same PR):** standard.

---

## Code skeletons

**Full verbatim:** see `docs/launch/mobile-launch-fix-plan-2026-05-31.md` § P2.2, P2.3, P2.4, P2.5, P2.6, P2.7, P2.9 for the polish items, and § P3.6, P3.7 for the quality additions.

Locale-aware decimal parser (small enough to inline here):
```ts
// mobile/src/lib/parsePrice.ts
export function parsePrice(raw: string): number | null {
  const normalized = raw.trim().replace(/\s/g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const n = parseFloat(normalized);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
```

`EditGarmentScreen` L166-170 swaps `parseFloat(price)` for `parsePrice(price)` and surfaces the null case as a validation message.

---

## Acceptance gates

```bash
cd mobile && npx tsc --noEmit
```
0 errors.

**Grep verification — no Coming-soon stubs remain:**
```bash
grep -nE "Coming soon|Coming Soon" mobile/src/screens/
```
Zero matches (except deliberate v1.0.1 markers — see PR body).

**Manual smoke test:**
1. StyleMe shows local weather (real coords, tap permission grant).
2. Tap a garment → Edit → Change photo → pick from library → save → photo updates everywhere; storage prior object gone.
3. EditGarment price input: type "12,50" → accepted as 12.5; type "abc" → rejected with validation message.
4. Home shows day summary section with real data.
5. OutfitDetail reactions persist to `feedback_signals`.
6. Wardrobe avatar shows real initial (not "B"). Wishlist tile gone.
7. SettingsAccount has no avatar row.

**Code-reviewer subagent:** mandatory.

---

## PR template

**Title:** `feat(mobile): M10 — UX polish: weather + photo replace + locale parser + day summary + sweep`

**Body:** Problem (multiple polish items: hardcoded weather, no photo replace, NaN on Swedish prices, mock refresh, dead avatar row, Coming-soon traps, missing day summary). Fix (named hooks + screen wiring + sweep). Verification above. Out of scope: GarmentDetail tabs (M9), StyleMe Adjust weather customisation (v1.0.1), TravelPackingList Share (v1.0.1).

---

## Tracker updates: M10 → DONE, pointer → M11.
