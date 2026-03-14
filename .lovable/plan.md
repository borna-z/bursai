

# Make Insights Stat Pills Clickable

## What Changes

The three stat pills on the Insights page (Total, Used 30d, Unused) become tappable buttons that navigate to relevant pages:

1. **Total garments** → `/wardrobe`
2. **Used (30d)** → `/wardrobe/used` (new page showing garments worn in last 30 days, with outfit generation)
3. **Unused** → `/outfits/unused` (existing page)

## Implementation

### 1. Make `StatPill` clickable
Update the `StatPill` component in `Insights.tsx` to accept an optional `onClick` prop. Apply cursor-pointer, active scale, and haptic feedback.

### 2. Create `/wardrobe/used` page
New file `src/pages/UsedGarments.tsx`:
- Reuse `useInsights` to get the list of garments worn in the last 30 days (the `topFiveWorn` data already has wear counts, but we need ALL used garments — we'll derive from insights data or query directly)
- Display garments in a grid (reuse `LazyImageSimple` + card pattern from Wardrobe)
- Add a "Generate outfit from these" button that navigates to `/outfits/generate` with the used garment IDs passed via route state
- Include `AppLayout`, `PageHeader` with back button, and `AnimatedPage`

### 3. Expand `useInsights` to expose used garments list
Currently `useInsights` only returns `garmentsUsedLast30Days` (a count) and `topFiveWorn` (top 5). We need to also return `usedGarments: Garment[]` — the full list of garments worn in the last 30 days.

### 4. Register route
Add `/wardrobe/used` route in `AnimatedRoutes.tsx` with lazy import and `ProtectedRoute`.

### 5. Wire navigation in Insights
Pass `onClick` handlers to each `StatPill`:
- Total → `navigate('/wardrobe')`
- Used → `navigate('/wardrobe/used')`  
- Unused → `navigate('/outfits/unused')`

### 6. Add translations
Add `insights.used_garments_title`, `insights.generate_from_used` keys for sv + en (and other locales).

### Files to modify
- `src/pages/Insights.tsx` — clickable StatPills
- `src/hooks/useInsights.ts` — add `usedGarments` to return data
- `src/pages/UsedGarments.tsx` — new page
- `src/components/layout/AnimatedRoutes.tsx` — add route
- `src/i18n/translations.ts` — new keys

