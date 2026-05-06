# M13 — Outfit anchor locking + rules engine

| Field | Value |
|---|---|
| Goal | Port the client-side outfit rules engine + anchor-locking so generation honors slot validity and the "anchor garment" stays locked across regeneration. |
| Status | DONE (PR #737) |
| Branch | `mobile-m13-outfit-rules-anchor` |
| PR count | 1 |
| Depends on | V0, M9 |
| Complexity | L |

## Background

Web `outfitRules.ts` (slot mapping + layering rules), `outfitValidation.ts` (slot inference per garment), `outfitAnchoring.ts` (lock a garment as the anchor → rules constrain generation around it). Mobile currently sends raw garment IDs to `generate_outfit` and accepts whatever returns. Anchor lock + client-side validation raises generation quality and lets the UI show pre-flight slot warnings.

## Files touched

### New
- `mobile/src/lib/outfitRules.ts` — port from web (slot mapping + layering rules table)
- `mobile/src/lib/outfitValidation.ts` — port; `inferSlot(garment) → 'TOP' | 'BOTTOM' | 'LAYER' | 'SHOES' | 'OUTERWEAR' | 'ACCESSORY'`
- `mobile/src/lib/outfitAnchoring.ts` — port; `applyAnchor(garmentIds, anchorId, rules)` returns the locked-slot constraints

### Modified
- `mobile/src/hooks/useGenerateOutfit.ts` — accept `{ anchorGarmentId?, lockedSlots? }`; thread through to `generate_outfit` body
- `mobile/src/screens/OutfitGenerateScreen.tsx` — anchor-lock pill on the chosen anchor garment; "Anchor locked: X" status row; regenerate respects anchor
- `mobile/src/screens/OutfitDetailScreen.tsx` — long-press a garment → "Make this the anchor" action

## Pattern reference

Web modules port directly — pure functions, no DOM. Some import paths need to switch from `@/...` to relative `../`.

## Acceptance gates

- TypeScript: 0 errors
- V0 CI gates: all green
- Manual: pick an anchor garment, regenerate 3x — confirm anchor stays in every result; tap "remove anchor" — confirm re-generation drops the constraint
- Code-reviewer: approved

## Deploy

None.

## PR template

Title: `feat(mobile): M13 — outfit rules engine + anchor locking`
