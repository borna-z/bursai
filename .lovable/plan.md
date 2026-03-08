

## Bring Back Insights — Contextual Entry Points

The Insights page (`/insights`) exists and is fully built, but there's no way to reach it — it's not in the bottom nav and no page links to it. Rather than adding a 6th nav tab, we'll surface insights creatively across the app.

### Approach: Contextual Insight Widgets + Entry Points

#### 1. Home Page — Mini Insights Card (`src/pages/Home.tsx`)
Add a new `InsightsBanner` component between SwipeSuggestions and AdjustDaySection. It shows:
- A small usage ring (48px) with the wardrobe utilization percentage
- Two compact stats: garments used / total, and unused count
- Tapping the card navigates to `/insights`
- Apple-style: `rounded-2xl bg-card/50 backdrop-blur` with subtle arrow

#### 2. New Component: `src/components/home/InsightsBanner.tsx`
- Uses `useInsights()` hook (already exists)
- Renders a compact horizontal card: mini UsageRing on the left, two stat lines on the right, ChevronRight icon
- Skeleton loading state
- Returns null if no garments

#### 3. Wardrobe Page — Insights Link (`src/pages/Wardrobe.tsx`)
Add a small `BarChart3` icon button in the Wardrobe header row (next to the add button area) that navigates to `/insights`. Subtle, discoverable.

#### 4. Settings Page — Insights Row (`src/pages/Settings.tsx`)
Add a "Wardrobe Insights" row in the settings group with a `TrendingUp` icon that navigates to `/insights`.

### Files to Edit
1. **`src/components/home/InsightsBanner.tsx`** — New component (mini usage ring card)
2. **`src/pages/Home.tsx`** — Add InsightsBanner
3. **`src/pages/Wardrobe.tsx`** — Add insights icon button in header
4. **`src/pages/Settings.tsx`** — Add insights row

