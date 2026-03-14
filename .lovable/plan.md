

# Plan: Replace All Hardcoded Swedish with English

## Overview
Swedish strings are scattered across ~20 files in both frontend and edge functions. This plan covers every instance, organized into 20 concrete steps.

---

## Steps

### Frontend — Form/Data IDs (stored values & display)

**1. `src/pages/AddGarment.tsx` — Pattern, Material, Season, Color IDs + Subcategories**
- Change `PATTERN_IDS` from Swedish (`enfärgad`, `randig`, `rutig`…) to English (`solid`, `striped`, `checked`, `dotted`, `floral`, `patterned`, `camo`)
- Change `MATERIAL_IDS` from Swedish (`bomull`, `polyester`, `lin`…) to English (`cotton`, `polyester`, `linen`, `denim`, `leather`, `wool`, `silk`, `synthetic`)
- Change `SEASON_IDS` from Swedish (`vår`, `sommar`, `höst`, `vinter`) to English (`spring`, `summer`, `autumn`, `winter`)
- Change `colors` array IDs from Swedish (`svart`, `vit`, `grå`…) to English (`black`, `white`, `grey`, `navy`, `blue`, `red`, `green`, `beige`, `brown`, `pink`, `yellow`, `orange`, `purple`)
- Update all `*_I18N` maps to use the new English keys
- Change `subcategories` map values from Swedish to English (`T-shirt`, `Shirt`, `Blouse`, `Sweater`, etc.)
- Update `SUBCATEGORY_I18N` keys to match English IDs

**2. `src/pages/EditGarment.tsx` — Same pattern/material/season/color/subcategory changes**
- Mirror all the same ID changes as AddGarment

**3. `src/components/wardrobe/FilterSheet.tsx` — Filter IDs**
- Change `colorFilters` from Swedish to English IDs
- Change `seasonFilters` from Swedish to English IDs

**4. `src/components/wardrobe/QuickEditPanel.tsx` — Color option IDs**
- Change `colorOptionIds` from Swedish to English

**5. `src/pages/Insights.tsx` — COLOR_MAP and COLOR_I18N**
- Change all Swedish color keys to English in both maps

**6. `src/components/insights/AdvancedInsights.tsx` — COLOR_CSS map**
- Remove Swedish keys, keep only English

**7. `src/data/seedGarments.ts` — Seed data color values**
- Replace Swedish `color_primary` values: `marinblå`→`navy`, `grön`→`green`, `lavendel`→`lavender`, `korall`→`coral`, `vit`→`white`, `blå`→`blue`, `lila`→`purple`, `olivgrön`→`olive`, `svart`→`black`, `brun`→`brown`, `röd`→`rust`, `terrakotta`→`terracotta`

### Frontend — Hardcoded Swedish Error/UI Strings

**8. `src/hooks/useOutfitGenerator.ts` — Error messages**
- Change `INSUFFICIENT_GARMENTS_MESSAGE` to English
- Change `isInsufficientGarmentsError` to check English string
- Change `'AI returnerade inga plagg'` → `'AI returned no garments'`
- Change `'Inte tillräckligt med matchande plagg'` → `'Not enough matching garments'`
- Change `'Kunde inte generera outfit'` → `'Could not generate outfit'`
- Change `locale: request.locale || 'sv'` → `locale: request.locale || 'en'`

**9. `src/hooks/useAISuggestions.ts` — Error check**
- Update `isInsufficientGarmentsError` to match English string instead of Swedish

**10. `src/components/chat/ChatWelcome.tsx` — Swedish suggestion fallbacks**
- Remove all `locale === 'sv'` branches; use English as default for all non-translated locales

**11. `src/contexts/ThemeContext.tsx` — Storage keys**
- Change `garderob-theme` → `burs-theme` and `garderob-accent` → `burs-accent` (cosmetic, but removes Swedish naming)

### Edge Functions — Swedish strings

**12. `supabase/functions/generate_outfit/index.ts` — Error message**
- Change `"Du behöver minst 3 plagg…"` → `"You need at least 3 garments (top, bottom, shoes) to generate an outfit"`

**13. `supabase/functions/burs_style_engine/index.ts` — Error messages + category aliases**
- Change `"Du behöver minst 3 plagg…"` → English
- Change `"Inte tillräckligt med matchande plagg"` → English
- Keep Swedish aliases in category arrays (these are for backward compat matching existing DB data) but add a comment explaining why

**14. `supabase/functions/travel_capsule/index.ts` — Fallback text**
- Change all `isSv` fallback strings (packing tips, reasoning, occasion, note) to English-only

**15. `supabase/functions/summarize_day/index.ts` — Swedish prompts**
- Change `i