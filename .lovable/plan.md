

# Move Insight Cards from Home to Insights Page

## What changes

1. **Remove from Home page** (`src/pages/Home.tsx`):
   - Remove the lazy imports and rendering of `InsightsBanner` and `SmartInsightCard` (lines 18-19, 91-94)

2. **Add to Insights page** (`src/pages/Insights.tsx`):
   - Import `InsightsBanner` and `SmartInsightCard`
   - Place `InsightsBanner` at the top (before the usage ring) — this is the "Wardrobe usage: 25/78 used · 53 unused" card with mini ring and chevron (image 1, top)
   - Place `SmartInsightCard` after the usage ring section — this is the "53 items haven't been worn in 30 days / Use them today" card (image 1, bottom)
   - Both cards currently navigate away from Home to Insights — we'll adjust `InsightsBanner` since it's now already on the Insights page (remove its navigate-to-insights behavior, make it a static display instead)

3. **Remove the "Underused Items" block** (section 4, lines 220-237) from Insights — this is the "53 garments unused 60+ days" card (image 2) which is being replaced by the SmartInsightCard

## Files to modify

- `src/pages/Home.tsx` — remove InsightsBanner + SmartInsightCard imports and rendering
- `src/pages/Insights.tsx` — add both cards, remove old underused block
- `src/components/home/InsightsBanner.tsx` — make the card non-clickable (or just display-only) since it's now on the Insights page itself; alternatively render it inline without the navigate-to-insights behavior

