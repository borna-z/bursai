

## Upgrade Outfit Generator: AI-Powered + Premium Animation

### Problem
1. **Dumb generation**: The current outfit generator uses a basic client-side scoring algorithm (formality points, color clash lists). It doesn't understand style, trends, or nuance — just picks garments with the highest score.
2. **Boring loading animation**: Just a pulsing sparkle icon with a generic spinner. No personality, no progress feedback.

### What changes

#### 1. New edge function: `generate_outfit`
Replace the client-side scoring with a real AI call (Gemini Flash). The edge function will:
- Receive occasion, style, weather from the client
- Fetch the user's wardrobe (excluding laundry items)
- Fetch user profile (style preferences, body measurements)
- Send all context to AI with a structured prompt requesting garment IDs, slots, and an explanation
- Use tool calling to get guaranteed structured JSON output
- Return the selected garment IDs, slots, and explanation
- The client then saves the outfit to the database (keeps existing save logic)

#### 2. Premium loading animation on `OutfitGenerate` page
Replace the basic spinner with a multi-phase animation:
- Phase 1 (0-1s): "Analyserar din garderob..." with a wardrobe scan animation (pulsing grid of small squares)
- Phase 2 (1-3s): "Matchar färger och stil..." with a color palette animation
- Phase 3 (3s+): "Skapar din outfit..." with the sparkles icon scaling in
- Each phase fades in/out smoothly using existing `animate-fade-in` classes
- The whole thing feels like AI is actually working (because it is now)

### Technical details

#### New file: `supabase/functions/generate_outfit/index.ts`
- Auth: validate JWT from authorization header
- Fetch garments from DB (user_id, not in_laundry)
- Fetch profile (preferences, body info)
- AI prompt instructs the model to pick garments by ID for each slot (top, bottom, shoes, optional outerwear/accessory)
- Uses tool calling with a `select_outfit` function schema to guarantee structured output:
  ```
  items: [{ slot: "top", garment_id: "uuid" }, ...]
  explanation: "string"
  ```
- Validates returned IDs exist in the user's wardrobe
- Returns the items array and explanation

#### Modified file: `src/hooks/useOutfitGenerator.ts`
- Remove all client-side scoring logic (200+ lines of formality/color/season scoring)
- Replace with a single `supabase.functions.invoke('generate_outfit', { body: { occasion, style, weather } })` call
- Parse the AI response, save outfit + items to DB (keep existing save logic)
- Return the same `GeneratedOutfit` shape so no downstream changes needed

#### Modified file: `src/pages/OutfitGenerate.tsx`
- Add phased loading states with `useState` cycling through 3 phases on a timer
- Each phase shows different icon, text, and animation
- Phase transitions use `animate-fade-in` with opacity transitions
- Error state stays the same but gets the fade-in treatment too

#### Modified file: `supabase/config.toml`
- Add `[functions.generate_outfit]` with `verify_jwt = false`

### Files summary (3 modified, 1 new)
1. **New**: `supabase/functions/generate_outfit/index.ts` — AI-powered outfit selection
2. `src/hooks/useOutfitGenerator.ts` — replace scoring with edge function call
3. `src/pages/OutfitGenerate.tsx` — premium multi-phase loading animation
4. `supabase/config.toml` — register new function
