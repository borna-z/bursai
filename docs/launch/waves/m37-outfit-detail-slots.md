# M37 — Outfit detail slots (full slot composition + anchor UI)

| Field | Value |
|---|---|
| Goal | OutfitDetail shows the full slot composition (TOP / BOTTOM / LAYER / SHOES / OUTERWEAR / ACCESSORY) with per-slot swap + anchor lock UI, matching web's outfit detail panel. |
| Status | TODO |
| Branch | `mobile-m37-outfit-detail-slots` |
| PR count | 1 |
| Depends on | V0, M13 |
| Complexity | M |

## Background

Mobile's current OutfitDetailScreen lists garments as a flat row. Web shows them slotted (TOP/BOTTOM/etc.) with each slot having "Swap this," "Make anchor," "Remove" actions. M13 ships the rules engine; this wave is the UI surface.

## Files touched

### New
- `mobile/src/components/OutfitSlotRow.tsx` — slot label (Eyebrow) + garment thumbnail + actions (Swap / Anchor / Remove).
- `mobile/src/hooks/useSwapGarment.ts` — given a slot + outfit, fetch valid replacement garments from the wardrobe (uses M13 rules + M19 visual search if available); user picks one; persist.

### Modified
- `mobile/src/screens/OutfitDetailScreen.tsx` — replace flat row with slotted layout. Anchor lock indicator on the anchored slot.
- `mobile/src/lib/outfitDisplay.ts` — `groupGarmentsBySlot(garments)` helper; honors M13's `inferSlot`.

## Acceptance gates

- TypeScript: 0 errors
- V0 CI gates: all green
- Manual: open an outfit → confirm slotted layout; tap "Swap" on a top → pick a different top → confirm outfit updates; tap "Anchor" on shoes → reopen → confirm anchor persists
- Code-reviewer: approved

## Deploy

None.

## PR template

Title: `feat(mobile): M37 — outfit detail slot composition`
