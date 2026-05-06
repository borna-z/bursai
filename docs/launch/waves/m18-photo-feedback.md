# M18 — Photo feedback / selfie comparison

| Field | Value |
|---|---|
| Goal | Wire `outfit_photo_feedback` so users can take a "what am I wearing right now" selfie, compare to a planned outfit, and capture the styling notes the AI returns. |
| Status | TODO |
| Branch | `mobile-m18-photo-feedback` |
| PR count | 1 |
| Depends on | V0, M10 |
| Complexity | M |

## Background

Edge function deployed (`outfit_photo_feedback`). Web has `usePhotoFeedback`. Inputs: planned outfit garment IDs + user selfie. Output: structured feedback (fit notes, color call-outs, swap suggestions). Mobile has no entry surface.

## Files touched

### New
- `mobile/src/hooks/usePhotoFeedback.ts` — POST `{ outfit_id, selfie_image_path }`. Uploads selfie to `selfie-feedback/<userId>/<timestamp>.jpg` first.
- `mobile/src/screens/PhotoFeedbackScreen.tsx` — camera-first capture; shows feedback card on response. Stays in Outfits hierarchy (not a tab).

### Modified
- `mobile/src/screens/OutfitDetailScreen.tsx` — "Try it on" CTA → PhotoFeedbackScreen (route param: outfit ID).
- `mobile/src/screens/PlanScreen.tsx` — same CTA from a planned-outfit row.
- `mobile/src/lib/memoryEvents.ts` — emit `try_on_outfit` event so memory captures the comparison signal.

## Pattern reference

Use the AddPiece upload helper for the selfie path, then call edge function via M9's wrapper.

## Acceptance gates

- TypeScript: 0 errors
- V0 CI gates: all green
- Manual: open outfit → "Try it on" → take selfie → feedback card renders within ~12s; confirm a `try_on_outfit` row in feedback_signals
- Code-reviewer: approved

## Deploy

None.

## PR template

Title: `feat(mobile): M18 — photo feedback / selfie comparison`
