

## Current Layering Logic Weaknesses

1. **Slot = presentation role**: The engine has `layering_role` per garment (`base`, `mid`, `outer`, `standalone`) but the result screen only shows flat slot labels (`Top`, `Outerwear`, `Bottom`, `Shoes`). A cardigan categorized as `top` slot but with `layering_role: mid` shows as "Top" — confusing when paired with a jacket as "Outerwear."

2. **No base-layer validation**: `isCompleteOutfit()` checks for `top + bottom + shoes` but doesn't verify whether a `top`-slotted garment with `layering_role: mid` (e.g., cardigan) needs a supporting base layer underneath. The outfit can appear complete while structurally missing a base layer.

3. **Confidence ignores gaps**: `computeConfidence()` doesn't factor in detected wardrobe gaps. It can return `high` confidence even when `detectWardrobeGapForRequest()` finds "weak formal top options" — because gap detection runs separately and only feeds into `limitation_note`, not the score itself.

4. **Occasion is one broad bucket**: The `formalOccasions` check treats "work" uniformly. No sub-modes (relaxed office vs. formal office) exist to guide formality targets.

5. **Explanation doesn't mention layering structure**: The AI prompt for `aiRefine()` describes combos as `slot: title (color, material)` but never mentions the garment's `layering_role`, so the AI can't explain *why* the layering works.

---

## Implementation Plan

### Files to Change

| File | Change |
|---|---|
| `supabase/functions/burs_style_engine/index.ts` | Add layering validation, gap-aware confidence, occasion sub-modes, richer AI prompt |
| `src/pages/OutfitDetail.tsx` | Show layering roles in garment list, reorder items by layer, improve explanation display |

### 1. Style Engine — Layering Validation (`burs_style_engine`)

**Add `validateLayeringCompleteness()`** after `isCompleteOutfit()`:
- For each combo, check if a garment in the `top` slot has `layering_role === 'mid'` (cardigan, sweater, hoodie).
- If so, check whether another item with `layering_role === 'base'` exists in the combo.
- If no base layer: set a `needs_base_layer` flag on the combo result. This doesn't reject the outfit (it may be intentionally standalone) but signals it to the confidence system and explanation.

**Enhance `inferLayeringRole()`**:
- Add "shacket", "overshirt", "utility shirt", "shirt jacket" → `mid` (currently these fall through to `standalone` via the generic `top` catch-all).

### 2. Style Engine — Gap-Aware Confidence

**Update `computeConfidence()`** to accept `gaps: string[]` parameter:
- Deduct from score based on gap count and severity:
  - Each formality gap: `-0.8`
  - Each weather gap: `-0.6`
  - `needs_base_layer` flag: `-0.5`
- This prevents `high` confidence when the system simultaneously detects wardrobe limitations.

### 3. Style Engine — Occasion Sub-Modes

**Add occasion refinement** in the scoring path:
- Map `work`/`jobb` to formality sub-bands:
  - `formality >= 7` → formal office
  - `formality 5-6` → business casual
  - `formality 3-4` → relaxed/creative office
- Use the user's `styleProfile.primaryGoal` or `formalityCenter` from their style vector to pick the sub-band.
- Pass the resolved sub-mode label into the AI prompt so the explanation can reference "business casual" vs "creative office."

### 4. Style Engine — Richer AI Prompt

**Enhance combo descriptions** in `aiRefine()`:
- Include `layering_role` per item: `top (mid-layer): Knit Cardigan (beige, wool)` instead of `top: Knit Cardigan (beige, wool)`.
- Add a `LAYERING CONTEXT` section noting if a base layer is assumed or missing.
- Add the resolved occasion sub-mode.
- Instruct the AI to explain layering structure, weather handling, and occasion fit in the explanation.

### 5. Engine Response — Add Layering Metadata

**Add to the JSON response** (alongside existing `items`, `explanation`, etc.):
- `layer_order`: array of `{ slot, garment_id, layer_role }` sorted from innermost to outermost (base → mid → outer, then bottom, shoes, accessory).
- `needs_base_layer`: boolean flag when a mid-layer top lacks an explicit base.
- `occasion_submode`: string like "business casual" or "relaxed office".

### 6. OutfitDetail.tsx — Layered Presentation

**Sort garment list by layer order** instead of arbitrary DB order:
- Use `layer_order` from generation state if available, otherwise infer from slot names.
- Display order: Base → Mid → Outer → Bottom → Shoes → Accessory.

**Show layering role labels** in `SlotRow`:
- Replace the generic `t('outfit.slot.top')` label with the layering role when available (e.g., "Base Layer", "Mid Layer", "Outer Layer").
- Keep `Bottom`, `Shoes`, `Accessory` as-is.

**Show `needs_base_layer` note** when flagged:
- A subtle inline note under the explanation: "This look assumes a simple base layer underneath" — styled as an editorial aside.

**Show occasion sub-mode** in the headline area:
- Replace generic "Work" with "Business Casual" or "Creative Office" when `occasion_submode` is provided.

### 7. useOutfitGenerator.ts — Pass New Fields

Pass `layer_order`, `needs_base_layer`, and `occasion_submode` from the edge function response through to the navigation state, so `OutfitDetail.tsx` can read them on the freshly-generated view.

---

### What Does NOT Change
- Routing, auth, subscriptions, wardrobe, planner, batch upload
- `backgroundGarmentSave.ts`, `useAnalyzeGarment.ts`
- Outfit saving schema (new fields are transient/display-only)
- Existing `isCompleteOutfit()` rejection logic (layering validation is additive, not blocking)

