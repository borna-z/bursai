

## Speed Up Outfit Generation

### Problem
Both the outfit generator (`generate_outfit`) and the suggestions engine (`suggest_outfit_combinations`) use `google/gemini-2.5-pro` -- the most powerful but **slowest** AI model available. This is the primary cause of the long wait times. Additionally, the outfit generator has a retry mechanism that can double the total time.

### Solution
Switch to a much faster model and streamline the logic to eliminate unnecessary delays.

### Changes

**1. `supabase/functions/generate_outfit/index.ts` -- Switch to fast model**
- Change model from `google/gemini-2.5-pro` to `google/gemini-3-flash-preview` (3-5x faster, still excellent quality for outfit selection)
- Remove the retry mechanism (lines 350-379) that calls the AI a second time when slots are missing -- instead, handle missing slots with the existing fallback logic (lines 382-393) which fills them instantly from available garments
- Trim the system prompt: remove redundant weather dressing rules and verbose instructions to reduce token processing time

**2. `supabase/functions/suggest_outfit_combinations/index.ts` -- Switch to fast model**
- Change model from `google/gemini-2.5-pro` to `google/gemini-3-flash-preview`

**3. `src/pages/OutfitGenerate.tsx` -- Shorten loading animation**
- Reduce phase durations from 1200ms + 2000ms to 600ms + 1000ms so the UI feels snappier

### Expected Result
- Outfit generation drops from ~8-15 seconds to ~2-5 seconds
- AI suggestions load ~3x faster
- No quality loss for outfit selection tasks (Flash models handle structured selection very well)

### Technical Details
- `gemini-3-flash-preview` is optimized for speed while maintaining strong reasoning for structured tool-calling tasks like garment selection
- The retry mechanism is the biggest time sink -- removing it saves an entire round-trip to the AI (another 5-10 seconds when triggered)
- The existing fallback logic (manually filling missing slots from available garments) runs instantly and produces acceptable results

