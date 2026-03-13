

# Fix Travel Capsule Generation

## Root Causes

1. **`max_tokens: 800` is far too low** — generating outfits for a multi-day trip with full garment UUIDs, packing tips, and reasoning easily requires 2000-4000 tokens. The AI output gets truncated mid-JSON, causing `No JSON in AI response` parse failures.

2. **Truncated IDs in prompt** — the prompt sends `g.id.slice(0, 8)` (8-char prefix) but asks AI to return those as IDs. The `resolveId` fallback tries prefix matching, but AI often mangles these short strings, leading to zero resolved items.

3. **Static outfit count** — the prompt doesn't scale the number of requested outfits based on how many occasions are selected or trip length. More occasions should yield more diverse outfits.

4. **Wrong slot mapping in TravelCapsule.tsx** — `slotMap` uses `tops`, `bottoms` but the DB stores `top`, `bottom`, `shoes`, `outerwear`, `accessories`, `dress`, `activewear`. This causes all items to fall through to `'other'` slot.

## Plan

### 1. Fix edge function `supabase/functions/travel_capsule/index.ts`

- **Increase `max_tokens`** from 800 to `Math.min(1200 + duration_days * 200, 4096)` — scales with trip length
- **Use full UUIDs** in the wardrobe description instead of `g.id.slice(0, 8)` — eliminates ID resolution failures
- **Scale outfit count in prompt** — explicitly request `1 outfit per day × number of occasions` (capped), e.g. "Generate at least {N} outfits covering all occasions across {days} days"
- **Upgrade complexity** to `"complex"` for longer trips (>5 days) to use a stronger model
- **Add JSON retry** — if JSON parsing fails, retry once with a simpler prompt asking AI to fix its output

### 2. Fix slot mapping in `src/pages/TravelCapsule.tsx`

Update `slotMap` to use correct DB category values:
```
top → top, bottom → bottom, shoes → shoes, outerwear → outerwear,
accessories → accessory, dress → dress, activewear → top
```
(Remove the plural `s` from keys)

### Files to edit
- `supabase/functions/travel_capsule/index.ts` — token limit, full IDs, scaled prompts, complexity routing
- `src/pages/TravelCapsule.tsx` — fix slotMap category keys

