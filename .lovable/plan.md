

# Fix Hardcoded Swedish in AI Garment Scan & Edge Functions

## Problem
The `analyze_garment` edge function has its entire AI prompt hardcoded in Swedish, meaning all garment analysis results (categories, colors, patterns, materials, seasons) come back in Swedish regardless of user locale. Error messages in both the edge function and `useLiveScan` hook are also hardcoded Swedish.

## Changes

### 1. `supabase/functions/analyze_garment/index.ts` — Make AI prompt locale-aware
- The function already receives `locale` from the request body but only uses it for the title instruction
- **Rewrite the system prompt** to use English by default, with locale-aware title only (categories, colors, patterns etc. should always use standardized English values for consistent DB storage)
- Replace all Swedish error messages with English equivalents:
  - `"Kunde inte hämta bilden"` → `"Could not fetch image"`
  - `"AI-analysen misslyckades"` → `"AI analysis failed"`
  - `"Kunde inte tolka AI-svaret"` → `"Could not parse AI response"`
  - `"För många förfrågningar..."` → `"Too many requests, try again later"`
  - `"AI-krediter slut..."` → `"AI credits exhausted, contact support"`
  - `"AI-analysen tog för lång tid"` → `"AI analysis timed out"`
  - `"Inget svar från AI"` → `"No response from AI"`
  - `"Ett oväntat fel uppstod"` → `"An unexpected error occurred"`
- Change prompt from Swedish to English: category values (`top, bottom, shoes...` already English), but color values, pattern, material, fit, and season_tags should all use **English standardized values** (black, white, grey, blue, navy, beige, brown, green, red, pink, purple, yellow, orange / solid, striped, checked, dotted, floral, patterned / cotton, polyester, linen, denim, leather, wool, silk, synthetic / slim, regular, loose, oversized / spring, summer, autumn, winter)
- The title remains locale-aware via `TITLE_LANG_MAP`

### 2. `src/hooks/useLiveScan.ts` — English fallback error messages
- Line 79: `'Analysen misslyckades'` → `'Analysis failed'`
- Line 93: `'Kunde inte fånga bilden'` → `'Could not capture image'`

### 3. `supabase/functions/generate_outfit/index.ts` — English error message
- Line 381: `"Kunde inte skapa en komplett outfit..."` → `"Could not create a complete outfit with your wardrobe"`

### 4. `supabase/functions/calendar/index.ts` — English error messages
- `'Kunde inte hämta profil'` → `'Could not fetch profile'`
- `'Ingen kalender-URL konfigurerad'` → `'No calendar URL configured'`
- `'Ingen Google Calendar-koppling hittades'` → `'No Google Calendar connection found'`

### Note on DB data
Switching AI analysis to return English standardized values (colors, patterns, etc.) means new garments will have English values. Existing garments with Swedish values will still work — the normalization functions already map both. No migration needed.

