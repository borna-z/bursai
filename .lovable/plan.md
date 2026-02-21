

## Fix Swedish Texts in Plan Page -- Locale-Aware AI + Translated Labels

### Problem
Three sources of hardcoded Swedish text on the Plan page:

1. **Outfit explanations** are always in Swedish because `generate_outfit` edge function doesn't receive the user's locale and instructs AI to always write in Swedish
2. **Day summaries** from `summarize_day` -- receives locale but its prompt template still has Swedish-only format examples
3. **Occasion badges** ("jobb", "vardag", etc.) shown raw without going through the translation system

### Changes

#### 1. `src/hooks/useOutfitGenerator.ts`
- Accept `locale` parameter in the `OutfitRequest` interface
- Pass `locale` in the body when invoking `generate_outfit`

#### 2. `supabase/functions/generate_outfit/index.ts`
- Read `locale` from the request body (default: `"sv"`)
- Update the system prompt: replace "Ge en personlig forklaring... pa svenska" with a dynamic language instruction based on locale
- Update fallback explanation text from hardcoded Swedish to locale-aware

#### 3. `supabase/functions/summarize_day/index.ts`
- Translate the JSON format example labels and weather terms dynamically based on locale so the AI returns content in the correct language

#### 4. `src/pages/Plan.tsx`
- Line 302: Translate `outfit.occasion` using the `OCCASION_I18N` map (same pattern already used in `StylistSummary.tsx`)
- Pass the user's locale when calling `generateOutfit` (via the request object)

#### 5. `src/components/plan/DayCard.tsx`
- Line 100: Same fix -- translate `outfit.occasion` using `OCCASION_I18N` map instead of showing raw value

#### 6. Caller sites that invoke `generateOutfit`
- `src/pages/Plan.tsx` (handleGenerateForDate, handleAutoGenerateWeek) -- add locale from `useLanguage()`
- `src/pages/Home.tsx` or wherever else `generateOutfit` is called -- add locale
- `src/components/insights/AISuggestions.tsx` -- if it generates outfits, add locale

### Technical details

**Edge function prompt change (generate_outfit):**
```
// Before:
"Ge en personlig forklaring (2-3 meningar) pa svenska"

// After (dynamic):
"Ge en personlig forklaring (2-3 meningar) pa ${localeName}"
// where localeName maps: sv->svenska, en->English, no->norsk, etc.
```

**Occasion translation in Plan.tsx and DayCard.tsx:**
```typescript
const OCCASION_I18N: Record<string, string> = {
  jobb: 'occasion.jobb',
  vardag: 'occasion.vardag',
  fest: 'occasion.fest',
  resa: 'occasion.resa',
  traning: 'occasion.traning',
  dejt: 'occasion.dejt',
};

// Usage:
const occasionKey = OCCASION_I18N[outfit.occasion?.toLowerCase()] || `occasion.${outfit.occasion}`;
const occasionLabel = t(occasionKey);
```

### Files summary
1. `src/hooks/useOutfitGenerator.ts` -- add locale to request interface and API call
2. `supabase/functions/generate_outfit/index.ts` -- dynamic locale in AI prompt
3. `supabase/functions/summarize_day/index.ts` -- improve locale handling in prompt
4. `src/pages/Plan.tsx` -- translate occasion labels, pass locale to generator
5. `src/components/plan/DayCard.tsx` -- translate occasion labels
