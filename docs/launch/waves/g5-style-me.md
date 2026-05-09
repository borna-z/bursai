# G5 — Style Me: auto-weather + adjust + occasion/formality parity + anchor + restyle + save state

| Field | Value |
|---|---|
| Goal | Auto-detect weather via `expo-location`; let user adjust it; expand occasion/formality to web parity + custom-occasion chip; add anchor garment picker; "Restyle" navigates to StyleChat with anchors; save transitions out of preview state. |
| Status | TODO |
| Branch | `fix/mobile-g5-style-me` |
| PR count | 1 |
| Depends on | G1 (restyle nav contract), G6 (real garment thumbs in result) |
| Complexity | L |
| Spec | [`docs/launch/g-campaign.md`](../g-campaign.md) |

## Background

Audit findings:
1. **No auto-weather.** `mobile/src/hooks/useWeather.ts:44` hardcodes `DEFAULT_COORDS = Stockholm`. Web (`src/hooks/useWeather.ts:61–79`) calls `navigator.geolocation.getCurrentPosition()`.
2. **No adjust.** `mobile/src/screens/StyleMeScreen.tsx:181–192` "Adjust" button only fires `Alert.alert(...)` — no input.
3. **Limited formality.** Mobile line 58: `['Casual', 'Smart casual', 'Business', 'Formal']`. Engine (`supabase/functions/_shared/outfit-scoring.ts:1123–1127`) actually supports: Formal Office, Business Casual, Relaxed Office, Baseline.
4. **Limited occasions.** Mobile lines 47–56 list 8 mismatched values. Web source-of-truth (`src/components/outfit/OutfitGeneratePicker.tsx:29–36`) is 6: casual, work, evening, date, workout, travel. User wants `+ Custom…` chip with text input.
5. **Color cards not photos** — fixed by G6.
6. **Save → preview stuck.** Lines 252–267 only `Alert.alert("Saved")`; no DB persist, no UI state transition.
7. **Restyle redirects to start.** Lines 98–100 call `reset()` instead of navigating to StyleChat with anchors.
8. **No anchor picker before generating.** Web has it at `OutfitGeneratePicker.tsx:117–137`; mobile doesn't.

## Files touched

### Modified
- `mobile/src/hooks/useWeather.ts` — request `expo-location` permission; on grant, `Location.getCurrentPositionAsync()` + reverse-geocode for label; on deny/error, fall back to existing Stockholm coords. Expose `setManual({ tempC, condition })` for the adjust UI to call.
- `mobile/src/screens/StyleMeScreen.tsx` —
  (a) Replace the Alert "Adjust" handler with a bottom-sheet that has a temperature stepper + condition picker (sun/cloud/rain/snow chips) and pipes to `useWeather.setManual()`.
  (b) Replace the `OCCASIONS` array (lines 47–56) with the 6 web-parity values + a `Custom…` entry. When user taps `Custom…`, render an inline `TextInput`; the typed string becomes the occasion sent to the engine.
  (c) Replace `FORMALITY` (line 58) with the 4 engine submodes.
  (d) Add an "Anchor a piece" bottom sheet (garment picker filtered by closet); selected garment IDs flow into `useGenerateOutfit({ anchor_garment_ids })`.
  (e) `onRestyle` (lines 98–100): replace `reset()` with `nav.navigate('StyleChat', { mode: 'stylist', anchorGarmentIds: result.outfit_items.map(i=>i.garment_id), sourceOutfitId: savedOutfitId ?? undefined })`.
  (f) Save handler (lines 252–267): call new `useSaveOutfit` mutation (or extend existing `useUpdateOutfit`); on success, set local `savedOutfitId` state and switch the result row from "Preview" badge to "Saved ✓" + show "Open in detail" link.
- `mobile/src/hooks/useGenerateOutfit.ts` — accept optional `anchor_garment_ids: string[]`; thread through to the `generate_outfit` edge function payload (parameter exists in the function contract per M13).
- `mobile/src/i18n/locales/en.ts` + `sv.ts` — append-only: `styleMe.weather.adjustTitle`, `styleMe.weather.tempLabel`, `styleMe.weather.conditionLabel`, `styleMe.occasion.custom`, `styleMe.formality.formalOffice`, `.businessCasual`, `.relaxedOffice`, `.baseline`, `styleMe.anchor.title`, `styleMe.anchor.cta`, `styleMe.saved.badge`, `styleMe.saved.openDetail`.

### Verified
- `mobile/src/hooks/useSaveOutfit.ts` — does it exist already from prior wave? If not, write a small mutation that inserts into `outfits` + `outfit_items` matching the existing schema. Mirror the shape returned by `useGenerateOutfit`.

### New (only if `useSaveOutfit` doesn't exist)
- `mobile/src/hooks/useSaveOutfit.ts` — `useMutation` per the `useAddGarment.ts` pattern in `mobile/CLAUDE.md`. Insert outfit + items, invalidate `['outfits', user.id]`, return new outfit ID.

## Pattern reference

- `mobile/CLAUDE.md` mutation hook shape (`useAddGarment.ts`).
- `expo-location` already a dep — verify in `mobile/package.json`. If not, add via `npx expo install expo-location`.
- M13 anchor lock contract: `mobile/src/lib/outfitAnchoring.ts` — already provides `applyAnchor()`. Reuse.

## Acceptance gates

- `tsc --noEmit` → 0 errors
- `eslint "src/**/*.{ts,tsx}" --max-warnings 0` → clean
- `expo-doctor` → passes
- `expo export -p ios` → bundle delta ≤ +20 KB
- Manual: open StyleMe in a fresh sim with location services granted → weather row shows actual current city + temp.
- Manual: deny location → falls back to Stockholm without crash.
- Manual: tap Adjust → bottom sheet opens; change temp; row updates.
- Manual: tap Custom… occasion → text input; type "graduation"; generate; result reflects custom occasion in the title.
- Manual: pick anchor garment → generate → anchor garment present in result outfit_items.
- Manual: tap Restyle → opens StyleChat with anchored garments.
- Manual: tap Save → row transitions to "Saved ✓"; new row appears in Outfits list.
- i18n: en/sv updated.
- Code-reviewer: approved.
- Codex: 👍 / "no bugs found" + quiet window.
- Mandatory 2nd self-review: clean.

## Deploy

None.

## PR template

Title: `fix(mobile): G5 — Style Me weather/adjust/occasion/formality/anchor/restyle/save`

Body:
- expo-location auto-weather + bottom-sheet adjust
- 6 web-parity occasions + Custom… text input
- 4 engine-aligned formality submodes
- Anchor garment picker before generate
- Restyle navigates to StyleChat with anchors (uses G1 contract)
- Save transitions out of preview state via `useSaveOutfit`
- Result thumbs use G6 OutfitCard
- Plan: `docs/launch/waves/g5-style-me.md`
