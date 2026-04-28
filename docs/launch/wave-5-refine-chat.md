## Wave 5 — Refine Button + AI Chat Fixes

### P28 — Refine anchors garment instead of full outfit (user's repro)

**Problem**
User's repro: "pressing refine button in an outfit card it just anchors a garment instead of whole outfit and gemini do not gets the full context."

Root cause (verified in code): the refine flow eventually calls `invokeUnifiedStylistEngine({mode: "swap", ...})` with a single `anchor_garment_id`. `unified_stylist_engine.ts` line 82-91 treats swap mode as a single-garment operation — the other outfit garments are passed as `other_items` with `slot: "unknown"`. Gemini receives fragmented context.

**Fix**
Change the refine flow to pass the FULL outfit as locked context, not a single anchor:

In `src/hooks/useSwapGarment.ts` (or wherever refine is triggered):
```typescript
// OLD (likely):
await invokeRefine({ anchor_garment_id: currentGarmentId, ... });

// NEW:
await invokeRefine({
  mode: "refine",
  active_look_garment_ids: outfit.items.map(i => i.garment_id),        // all current garments
  locked_garment_ids: outfit.items.filter(i => i.id !== outfitItemId).map(i => i.garment_id),  // everything except the one being swapped
  requested_edit_slots: [slot],        // the slot being swapped
  occasion: outfit.occasion,
  weather: outfit.weather,
});
```

In `supabase/functions/_shared/unified_stylist_engine.ts`:
- Add `mode: "refine"` path that passes the full active_look + locked set to `burs_style_engine`.
- `burs_style_engine` already handles `active_look_garment_ids` + `locked_garment_ids` — verify it uses them correctly in refinement mode.

In `supabase/functions/style_chat/index.ts`:
- Refinement path should also pass the full active look, not just the anchor. Verify `StructuredRefinementPlan.lockedGarmentIds` includes all non-edited garments.

**Files**
- `src/hooks/useSwapGarment.ts`
- `supabase/functions/_shared/unified_stylist_engine.ts`
- `supabase/functions/style_chat/index.ts` (refinement path)
- `supabase/functions/burs_style_engine/index.ts` (verify active_look handling)
- `src/components/chat/RefineChips.tsx` / `RefineBanner.tsx` (fix payload)

**Acceptance**
- User hits refine → Gemini receives full outfit context (5 garments + which slot to swap)
- Swap result preserves 4 non-edited garments
- Tested with: refine-shoes, refine-top, refine-outerwear on a 5-piece outfit

**Deploy** `style_chat`, `burs_style_engine` (if changed), `generate_outfit` (if changed)

---

### P29 — AI chat activeLook persistence

**Problem**
Across AI chat messages, `activeLook` state sometimes drops. Next refine loses context.

**Fix**
1. In `supabase/functions/style_chat/index.ts`, verify every response includes `active_look` in `StyleChatResponseEnvelope`.
2. In `src/pages/AIChat.tsx`, verify `stylistMeta.active_look.garment_ids` is serialized to `chat_messages.content` and restored on load.
3. Add a smoke test: 3 messages in a thread, verify activeLook persists across all.

**Files**
- `supabase/functions/style_chat/index.ts`
- `supabase/functions/_shared/style-chat-contract.ts`
- `src/pages/AIChat.tsx`
- `src/lib/styleChatContract.ts` (frontend serialization)

**Acceptance**
- activeLook.garment_ids survives across message turns in the UI
- Refresh page → thread reloaded → activeLook still present on last assistant message

**Deploy** `style_chat`

---

### P30 — style_chat classifier fallback

**Problem**
When user has an active look and says "make it warmer", classifier sometimes returns `intent: "conversation"` instead of `intent: "refine_outfit"`. Refine UI doesn't fire.

**Fix**
In `supabase/functions/_shared/style-chat-classifier.ts`, add a post-classification override:
```typescript
// After parseClassifierResponse returns the ClassifierResult:
if (input.hasActiveLook && result.intent === 'conversation') {
  // Check for refinement hint words
  const refinementWords = /\b(warmer|cooler|formal|casual|swap|change|different|elevated|softer|sharper)\b/i;
  if (refinementWords.test(input.userMessage)) {
    return { ...result, intent: 'refine_outfit', refinement_hint: /* infer from word */ };
  }
}
```

**Files**
- `supabase/functions/_shared/style-chat-classifier.ts`

**Acceptance**
- "make it warmer" with active look → `refine_outfit` intent, not conversation
- "tell me a joke" with active look → `conversation` intent (unchanged)

**Deploy** `style_chat`

---

### P31 — RefineChips/RefineBanner payload fix

**Problem**
UI components send anchor-only payload. Linked to P28.

**Fix**
Verify `RefineChips.tsx` + `RefineBanner.tsx` call `useSwapGarment` (or equivalent hook) with the full outfit context. If they send just `{anchor_garment_id}`, refactor to send `{active_look_garment_ids, locked_garment_ids, requested_edit_slots}`.

**Files**
- `src/components/chat/RefineChips.tsx`
- `src/components/chat/RefineBanner.tsx`
- `src/hooks/useRefineMode.ts`

**Acceptance**
- Refine chips/banner trigger full-outfit refine (covered by P28's integration test)

**Deploy** None.

---

