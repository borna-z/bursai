

## Smarter, Complete Outfit Generation

### The Problem (confirmed by data)

Looking at the last 10 generated outfits in the database, most have only **1-2 items** (e.g., just "shoes" or "outerwear") instead of full outfits. The AI is not reliably returning complete sets. Specific issues:

1. **Incomplete outfits**: AI returns 1-2 slots instead of minimum 3-4 (top + bottom + shoes + outerwear when cold)
2. **No repetition awareness**: The AI has no knowledge of what outfits were already generated, so it repeats the same combinations
3. **Missing weather logic**: No strong enforcement that cold weather requires outerwear
4. **Weak model for fashion**: Using `gemini-3-flash-preview` which is fast but less reliable for structured reasoning
5. **No validation on completeness**: The code accepts outfits with just 2 items

### Solution

#### 1. Upgrade AI model and rewrite the prompt (`generate_outfit`)

**Model change**: Switch from `google/gemini-3-flash-preview` to `google/gemini-2.5-pro` for outfit generation. This is the strongest reasoning model and will produce much better fashion matches.

**Prompt overhaul** with strict completeness rules:

```text
MANDATORY SLOTS (every outfit MUST include ALL of these):
- top: A shirt, t-shirt, sweater, blouse, etc.
- bottom: Pants, jeans, skirt, shorts, etc.
- shoes: Sneakers, boots, loafers, etc.

CONDITIONAL SLOTS:
- outerwear: REQUIRED if temperature < 15 degrees C or precipitation is not "none"
- accessory: Optional but encouraged for formal occasions

VALIDATION: Do NOT return an outfit with fewer than 3 items.
If the wardrobe lacks a category, skip that slot but NEVER skip top/bottom/shoes.
```

#### 2. Add repetition awareness

Pass the user's **last 5 outfit combinations** (garment IDs) into the prompt so the AI knows what was recently generated and avoids repeating the same selections.

This will be fetched from the `outfits` + `outfit_items` tables before calling the AI.

#### 3. Strict server-side validation

After the AI responds, validate:
- Must have at least `top` + `bottom` + `shoes` (3 slots minimum)
- If weather temperature < 15 degrees C, `outerwear` must be present
- If any mandatory slot is missing but garments exist for that category, retry once with a focused prompt

#### 4. Upgrade `suggest_outfit_combinations` too

Same improvements for the Insights page suggestions:
- Upgrade to `gemini-2.5-pro`
- Use tool calling instead of raw JSON parsing (more reliable)
- Each suggestion must be a complete outfit (top + bottom + shoes minimum)
- Pass recent outfits to avoid repetition

#### 5. Better slot types in the UI

The `OutfitSlotCard` already supports `dress` and `fullbody` slots. Ensure the AI prompt also allows these for dresses/jumpsuits so the AI can suggest a dress instead of top+bottom when appropriate.

### Technical Details

**Files to modify:**

1. **`supabase/functions/generate_outfit/index.ts`** -- Major rewrite:
   - Change model to `google/gemini-2.5-pro`
   - Rewrite system prompt with strict slot rules and weather logic
   - Fetch last 5 outfits for anti-repetition context
   - Add server-side validation with retry logic
   - Add `dress`/`fullbody` slot support

2. **`supabase/functions/suggest_outfit_combinations/index.ts`** -- Major rewrite:
   - Change model to `google/gemini-2.5-pro`
   - Switch from raw JSON parsing to structured tool calling
   - Enforce complete outfits (3+ items per suggestion)
   - Fetch recent outfits for variety
   - Add locale support

3. **`src/hooks/useOutfitGenerator.ts`** -- Minor update:
   - Update minimum item validation from 2 to 3

**Prompt structure (generate_outfit):**

```text
You are a world-class personal stylist. Create ONE complete outfit.

MANDATORY RULES:
1. Every outfit MUST include: top + bottom + shoes (minimum 3 items)
2. If temperature < 15C OR rain/snow: MUST include outerwear (4 items)
3. Exception: if a dress/jumpsuit is chosen, it replaces top+bottom
4. ONLY use garment IDs from the provided wardrobe
5. Prioritize garments not recently worn (check wear_count and last_worn_at)
6. Consider color harmony: complementary colors, tone-on-tone, or neutral base with accent
7. Match formality levels across all items

AVOID THESE RECENT OUTFITS (create something NEW):
[list of recent outfit garment IDs]

WEATHER RULES:
- Below 5C: heavy outerwear mandatory, prefer warm materials
- 5-15C: light outerwear or layering
- 15-25C: no outerwear needed
- Above 25C: light fabrics, short sleeves OK
- Rain: waterproof outerwear
- Snow: warm + waterproof
```

**Anti-repetition query:**

```sql
SELECT array_agg(oi.garment_id) as garment_ids
FROM outfits o
JOIN outfit_items oi ON oi.outfit_id = o.id
WHERE o.user_id = $userId
GROUP BY o.id
ORDER BY o.generated_at DESC
LIMIT 5
```

**Server-side validation logic:**

```text
1. Parse AI response
2. Check: has top/dress? has bottom (unless dress)? has shoes?
3. Check: if cold/rain, has outerwear?
4. If missing mandatory slot AND user has garments in that category:
   -> Retry with focused prompt: "You forgot shoes. Pick one."
5. If still incomplete after retry, return error
```

### What this achieves

- Every generated outfit will be a **complete, wearable look** (3-4+ items)
- Outerwear is automatically included when weather demands it
- The AI uses the **strongest available model** for better color matching and style coherence
- Recent outfits are tracked to ensure **variety and freshness**
- Dresses/jumpsuits are supported as alternatives to top+bottom

