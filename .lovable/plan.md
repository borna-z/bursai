

## Translate Garment Title Based on User Language

The AI garment analysis always returns Swedish titles because the edge function prompt is hardcoded to request Swedish output. When the user switches language, the title stays in Swedish.

### What changes

1. **Pass the user's locale to the edge function** so the AI prompt generates titles in the correct language.

2. **Update the edge function prompt** to use the locale parameter for the title language, while keeping all structured data values (category IDs, color IDs, season tags) in Swedish since those are database keys.

### Files to modify

#### 1. `src/hooks/useAnalyzeGarment.ts`
- Accept an optional `locale` parameter in `analyzeGarment` or read it from `useLanguage()` (already imported).
- Pass `locale` in the request body alongside `storagePath`.

#### 2. `src/pages/AddGarment.tsx`
- Pass the current `locale` when calling `analyzeGarment` (from `useLanguage()`), or no change needed if the hook reads it internally.

#### 3. `supabase/functions/analyze_garment/index.ts`
- Read `locale` from the request body (default to `'sv'`).
- Build the AI prompt dynamically:
  - Title instruction changes from `"kort beskrivande titel på svenska"` to the equivalent in the user's language (e.g., `"short descriptive title in English"` for `en`).
  - All other fields (category, color, pattern, season_tags) remain in Swedish since they are database keys.
- A small locale-to-language map handles the prompt text:
  ```
  sv -> "kort beskrivande titel på svenska"
  en -> "short descriptive title in English"
  no -> "kort beskrivende tittel på norsk"
  ```

### Technical details

- Only the `title` field in the AI response changes language. All other values (categories, colors, patterns, seasons, materials, fits) stay in Swedish because they are used as database keys and matched via `*_I18N` translation maps.
- The system prompt for the AI is adjusted to specify the title language while keeping the rest of the instructions consistent.
- The `user` message text ("Analysera detta klädesplagg...") can also be translated, but since the AI model understands the task from the system prompt, this is optional.
- Edge function error messages in Swedish remain as-is since they are returned as error codes and handled client-side via `t()`.

### Files modified (3 total)
1. `src/hooks/useAnalyzeGarment.ts` -- pass locale to edge function
2. `src/pages/AddGarment.tsx` -- pass locale when calling analyze (if needed)
3. `supabase/functions/analyze_garment/index.ts` -- dynamic prompt based on locale
