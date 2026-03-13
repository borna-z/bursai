

# Remove Brands from Wardrobe Gap Analysis

## Problem
The wardrobe gap analysis AI prompt explicitly asks for brand names and specific product models. The user wants generic garment names only (e.g., "White low-top sneakers" instead of "Nike Air Force 1 '07 Triple White").

## Changes

### `supabase/functions/wardrobe_gap_analysis/index.ts`
- Update the AI prompt (lines 81-93) to instruct NO brands — only generic garment descriptions with color, material, and style
- Remove the `brand` field from the tool schema (line 116)
- Remove `brand` from the `required` array (line 124)
- Update the `item` field description to say generic name, no brands
- Update `search_query` description to use generic terms
- Update the prompt rules to say "Do NOT include brand names"

### `src/hooks/useAdvancedFeatures.ts`
- Remove `brand` from the `useWardrobeGapAnalysis` return type (line 56)

### `src/components/discover/WardrobeGapSection.tsx`
- Remove any rendering of the `brand` field from gap result cards

