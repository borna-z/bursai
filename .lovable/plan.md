

# Reorganize Insights Page

## Changes

1. **Remove `InsightsBanner`** (line 148) — the "Wardrobe usage 25/78 used · 53 unused" card (image 1). Remove its import (line 5).

2. **Move `SmartInsightCard`** (line 149) — the "53 items haven't been worn in 30 days / Use them today" card (image 2) — down to just before the "Get more outfits" CTA button (before line 274).

### File: `src/pages/Insights.tsx`
- Remove line 5 (`InsightsBanner` import)
- Remove line 148 (`<InsightsBanner />`)
- Remove line 149 (`<SmartInsightCard />`)
- Insert `<SmartInsightCard />` between the premium link block and the CTA button (before line 274)

