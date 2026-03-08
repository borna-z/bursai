

## Plan: Create 200 Unique Test Garments with Unique AI Images

### Root Cause of Duplicates
The previous approach sent batches of 4 garments to the edge function, which generated images sequentially but with similar generic prompts. The AI model produced visually similar images because prompts lacked enough unique detail (e.g., specific angles, styling details, background variations).

### New Approach: One-at-a-Time with Hyper-Specific Prompts

**Key changes to prevent duplicates:**

1. **Update `seedGarments.ts`** — Add a unique `image_prompt_hint` field to each garment with specific visual details (e.g., "folded neatly with visible collar", "hanging on wooden hanger at 45° angle", "rolled up showing cuff detail"). This makes every AI prompt truly unique even for similar items.

2. **Update `seed_wardrobe` edge function** — Process garments **one at a time** (batch size = 1). Use the `image_prompt_hint` in the prompt. Add a unique seed/variation identifier (the garment index number) to further differentiate prompts. Use `google/gemini-3-pro-image-preview` for higher quality, more varied output.

3. **Update `SeedWardrobe.tsx` page** — Change `BATCH_SIZE` from 4 to 1. Increase delay between requests to 5 seconds to avoid rate limiting. Show estimated time remaining.

### Technical Details

**seedGarments.ts changes:**
- Add `image_prompt_hint: string` to the `SeedGarment` interface
- Each of the 200 items gets a unique hint describing presentation style:
  - Varied compositions: "flat lay", "hanging on hanger", "folded on marble surface", "draped over chair arm", "on mannequin torso"
  - Varied angles: "top-down view", "3/4 angle", "side profile", "close-up texture shot"
  - Varied backgrounds: "white marble", "light grey linen", "cream paper", "soft shadow"

**Edge function prompt template:**
```
"High-end fashion catalog photograph #[INDEX]: a single [color] [material] [title], 
[image_prompt_hint], [background detail], studio lighting, 8K detail, 
no person, no text, no watermark"
```

The index number and hint together ensure the AI model never receives the same prompt twice.

**Frontend changes:**
- Batch size = 1 (one garment per edge function call)
- 5-second delay between calls
- Estimated time: ~17 minutes for 200 items
- Show time remaining counter

### Files to Change
1. `src/data/seedGarments.ts` — Add unique `image_prompt_hint` to all 200 items
2. `supabase/functions/seed_wardrobe/index.ts` — Use hint in prompt, switch to pro image model
3. `src/pages/settings/SeedWardrobe.tsx` — Batch size 1, longer delay, time estimate display

