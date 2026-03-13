

# Smart Wardrobe Gap Analysis on Discover Page

## What it does
A new section on the Discover page that analyzes the user's wardrobe and suggests **exact, searchable garments** they're missing — with specific brand, model, color, and size descriptors so the user can copy-paste the name into Google and find the exact item.

## Changes

### 1. Upgrade edge function `supabase/functions/wardrobe_gap_analysis/index.ts`
- Enhance the AI prompt to return **specific, Google-searchable product names** instead of generic descriptions (e.g., "Nike Air Force 1 '07 White Low" instead of "White sneakers")
- Add new fields to the tool schema: `search_query` (the exact Google search string), `color`, `price_range`, `brand`
- Include the user's locale so suggestions match their market
- Feed more garment detail (subcategory, fit, formality distribution) into the wardrobe profile for smarter detection

### 2. Create `src/components/discover/WardrobeGapSection.tsx`
- A new section component for the Discover page
- Shows a "Scan my wardrobe" button that triggers the analysis
- Displays results as cards with: product name, category badge, reason, estimated new outfits count
- Each card has a **"Search on Google"** button that opens `https://www.google.com/search?q={search_query}` in a new tab
- Loading state with skeleton shimmer
- Empty state if < 5 garments ("Add more garments first")
- Staggered entrance animations matching Discover page style

### 3. Update `src/pages/Discover.tsx`
- Import and render `WardrobeGapSection` between Challenges and Style Tools sections

### 4. Add i18n keys to `src/i18n/translations.ts`
- Keys for: section heading, scan button, searching state, search on Google CTA, empty state, error state (sv + en minimum, other locales get English fallback)

