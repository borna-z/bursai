# BURS Frontend Rebuild Audit

## Scope

This audit covers the five primary app tabs:

- Home (`/`)
- Wardrobe (`/wardrobe`)
- Add (`/wardrobe/add` and launch points from the bottom nav)
- Plan (`/plan`)
- Insights (`/insights`)

The goal is a premium frontend rebuild that preserves the current Supabase contracts, auth, billing, garment ingestion, outfit generation, planning, and insights logic.

## Current Architecture Snapshot

### App shell

- Routing lives in [`src/components/layout/AnimatedRoutes.tsx`](C:/Users/borna/Downloads/bursai-main%20(13)/bursai-main/src/components/layout/AnimatedRoutes.tsx).
- Shared mobile shell lives in [`src/components/layout/AppLayout.tsx`](C:/Users/borna/Downloads/bursai-main%20(13)/bursai-main/src/components/layout/AppLayout.tsx).
- Persistent bottom navigation lives in [`src/components/layout/BottomNav.tsx`](C:/Users/borna/Downloads/bursai-main%20(13)/bursai-main/src/components/layout/BottomNav.tsx).
- Theme and accent handling live in [`src/contexts/ThemeContext.tsx`](C:/Users/borna/Downloads/bursai-main%20(13)/bursai-main/src/contexts/ThemeContext.tsx).
- Shared visual tokens and utility surfaces live in [`src/index.css`](C:/Users/borna/Downloads/bursai-main%20(13)/bursai-main/src/index.css) and [`src/components/ui/button.tsx`](C:/Users/borna/Downloads/bursai-main%20(13)/bursai-main/src/components/ui/button.tsx).

### Backend integration pattern

- Most product data is already isolated behind React Query hooks and Supabase helpers.
- Edge functions are centralized via [`src/lib/edgeFunctionClient.ts`](C:/Users/borna/Downloads/bursai-main%20(13)/bursai-main/src/lib/edgeFunctionClient.ts).
- The main regression risk is not API contracts, it is frontend orchestration leaking into page components and feature hooks.

## Tab Audit

### Home

Primary files:

- [`src/pages/Home.tsx`](C:/Users/borna/Downloads/bursai-main%20(13)/bursai-main/src/pages/Home.tsx)
- [`src/components/home/HomeTodayLookCard.tsx`](C:/Users/borna/Downloads/bursai-main%20(13)/bursai-main/src/components/home/HomeTodayLookCard.tsx)
- [`src/components/home/HomeStatsStrip.tsx`](C:/Users/borna/Downloads/bursai-main%20(13)/bursai-main/src/components/home/HomeStatsStrip.tsx)

Data dependencies:

- `useProfile`
- `useGarmentCount`
- `useOutfits`
- `usePlannedOutfitsForDate`
- `useWeather`
- `useLocation`

Must keep:

- Greeting and contextual date
- Today outfit recommendation state logic
- Weather dependency
- Pull-to-refresh invalidation
- Direct paths to wardrobe, styling, plan, settings

Should improve:

- One clearer focal point for the main recommendation
- Better explanation of why the look is recommended
- Less “shortcut board” feel
- Stronger premium editorial hierarchy

Should redesign:

- Hero composition and action structure
- Supporting stats and low-noise secondary actions

Risk of regression:

- Breaking the state switch between empty wardrobe, planned outfit, open day, and weather alert
- Losing the direct route to AI generation and the planned outfit detail path

### Wardrobe

Primary files:

- [`src/pages/Wardrobe.tsx`](C:/Users/borna/Downloads/bursai-main%20(13)/bursai-main/src/pages/Wardrobe.tsx)
- [`src/hooks/useWardrobeView.ts`](C:/Users/borna/Downloads/bursai-main%20(13)/bursai-main/src/hooks/useWardrobeView.ts)
- [`src/components/wardrobe/WardrobeToolbar.tsx`](C:/Users/borna/Downloads/bursai-main%20(13)/bursai-main/src/components/wardrobe/WardrobeToolbar.tsx)
- [`src/components/wardrobe/GarmentGrid.tsx`](C:/Users/borna/Downloads/bursai-main%20(13)/bursai-main/src/components/wardrobe/GarmentGrid.tsx)
- [`src/components/wardrobe/WardrobeSmartAccess.tsx`](C:/Users/borna/Downloads/bursai-main%20(13)/bursai-main/src/components/wardrobe/WardrobeSmartAccess.tsx)

Data dependencies:

- `useGarments`
- `useGarmentSearch`
- `useGarmentCount`
- `useUpdateGarment`
- `useDeleteGarment`
- `useProfile` / `useUpdateProfile`
- `invokeEdgeFunction('compute_wardrobe_dna')`

Must keep:

- Search, filtering, category browsing, sort, laundry mode
- Grid/list browsing
- Selection mode and bulk actions
- Pagination/infinite loading
- Outfit tab inside wardrobe
- Smart grouping and smart access entry points

Should improve:

- Premium overview framing
- Filter and collection discoverability
- Stronger distinction between browsing and selecting
- Cleaner separation between data orchestration and toolbar presentation

Should redesign:

- Top toolbar stack
- Collection overview and active-filter summary
- Category chip language and hierarchy

Risk of regression:

- Category filter behavior
- Search debounce
- Selection mode actions
- Infinite loading behavior

Observed issue:

- Category chips in [`src/components/wardrobe/WardrobeToolbar.tsx`](C:/Users/borna/Downloads/bursai-main%20(13)/bursai-main/src/components/wardrobe/WardrobeToolbar.tsx) use plural values (`tops`, `bottoms`, `accessories`) while `useWardrobeView` filters use singular values (`top`, `bottom`, `accessory`). This is a real behavior bug and should be corrected during the rebuild.

### Add

Primary files:

- [`src/pages/AddGarment.tsx`](C:/Users/borna/Downloads/bursai-main%20(13)/bursai-main/src/pages/AddGarment.tsx)
- [`src/hooks/useAddGarment.ts`](C:/Users/borna/Downloads/bursai-main%20(13)/bursai-main/src/hooks/useAddGarment.ts)
- [`src/components/add-garment/UploadStep.tsx`](C:/Users/borna/Downloads/bursai-main%20(13)/bursai-main/src/components/add-garment/UploadStep.tsx)
- [`src/pages/LiveScan.tsx`](C:/Users/borna/Downloads/bursai-main%20(13)/bursai-main/src/pages/LiveScan.tsx)

Data dependencies:

- `useCreateGarment`
- `useGarmentCount`
- `useStorage`
- `useAnalyzeGarment`
- `useSubscription`
- `useDuplicateDetection`
- `useMedianCamera`
- garment post-save intelligence helpers

Must keep:

- Upload photo flow
- Batch upload flow
- AI analysis and retry flow
- Duplicate detection
- Paywall handling
- Confirm sheet
- Post-save intelligence trigger

Should improve:

- Prioritization of add methods
- Trust, progress, and success language
- Separation between capture choice and detailed form editing

Should redesign:

- First screen entry hierarchy
- Visual relationship between upload, live scan, and bulk add

Risk of regression:

- Upload and camera handlers
- Storage path persistence
- AI analysis sequencing
- Duplicate replacement behavior

Testing gap:

- The page-level Add contract is currently under-tested compared with Home, Wardrobe, Plan, and Insights.

### Plan

Primary files:

- [`src/pages/Plan.tsx`](C:/Users/borna/Downloads/bursai-main%20(13)/bursai-main/src/pages/Plan.tsx)
- [`src/components/plan/WeekOverview.tsx`](C:/Users/borna/Downloads/bursai-main%20(13)/bursai-main/src/components/plan/WeekOverview.tsx)
- Sheets in `src/components/plan/`

Data dependencies:

- `usePlannedOutfits`
- `usePlannedOutfitsForDate`
- `useUpsertPlannedOutfit`
- `useDeletePlannedOutfit`
- `useUpdatePlannedOutfitStatus`
- `useOutfitGenerator`
- `useWeekGenerator`
- `useDaySummary`
- `useForecast`
- `useCalendarEvents`
- `useMarkOutfitWorn`

Must keep:

- Week/day planning
- Single-day generation
- Week generation
- Calendar/event context
- Weather context
- Worn/undo behavior
- Swap and preselect sheets

Should improve:

- Calmness and day-level clarity
- Stronger relationship between context and recommendation
- Visual hierarchy between week strip, selected day, and upcoming looks

Should redesign:

- Day hero surface
- Empty-day planning CTA hierarchy
- Upcoming section styling

Risk of regression:

- Preselected outfit planning flow
- Day/status mutations
- Week autogeneration
- Calendar-derived context

### Insights

Primary files:

- [`src/pages/Insights.tsx`](C:/Users/borna/Downloads/bursai-main%20(13)/bursai-main/src/pages/Insights.tsx)
- [`src/components/insights/useInsightsDashboardAdapter.ts`](C:/Users/borna/Downloads/bursai-main%20(13)/bursai-main/src/components/insights/useInsightsDashboardAdapter.ts)
- [`src/hooks/useInsightsDashboard.ts`](C:/Users/borna/Downloads/bursai-main%20(13)/bursai-main/src/hooks/useInsightsDashboard.ts)

Data dependencies:

- `useInsightsDashboard`
- subscription state for paywalling premium insight surfaces
- derived dashboard adapter data

Must keep:

- Score/value framing
- Palette balance
- Garment highlights
- Sustainability/value metrics
- Style DNA
- Empty/loading states

Should improve:

- Actionability and retention framing
- Reduced chart noise
- Clearer narrative around value and next steps

Should redesign:

- Top hero and section order
- Recommendation framing
- Premium storytelling tone

Risk of regression:

- Adapter shaping between dashboard response and presentational cards
- Premium blur/lock behavior

## Tight Coupling Findings

### Safe coupling

- `useAddGarment` is intentionally orchestration-heavy, but most backend behavior is already well-contained in the hook.
- `useWardrobeView` centralizes wardrobe orchestration and is a good container-layer candidate.

### Needs separation

- [`src/pages/Plan.tsx`](C:/Users/borna/Downloads/bursai-main%20(13)/bursai-main/src/pages/Plan.tsx) mixes page composition, day-card presentation, and orchestration for generation/mutation flows.
- [`src/pages/Home.tsx`](C:/Users/borna/Downloads/bursai-main%20(13)/bursai-main/src/pages/Home.tsx) still owns too much action-label and state-to-copy mapping.
- [`src/components/insights/useInsightsDashboardAdapter.ts`](C:/Users/borna/Downloads/bursai-main%20(13)/bursai-main/src/components/insights/useInsightsDashboardAdapter.ts) currently converts backend data into view data, but not yet into page-level recommendation models, so pages still need to infer narrative structure themselves.

## Rebuild Strategy

### Frontend architecture

1. Keep existing React Query hooks and Supabase contracts untouched.
2. Strengthen the shared dark premium system first:
   - theme default
   - surfaces
   - buttons
   - chips
   - bottom navigation
   - page headers
3. Move page-specific hierarchy into presentational components instead of expanding page files further.
4. Keep container hooks as the source of truth for mutations, invalidation, and navigation side effects.
5. Add contract-oriented page tests around the required user-visible areas and actions.

### Component strategy

- Keep `AppLayout`, `BottomNav`, `PageHeader`, `EmptyState`, `Button`, `Chip`, `Skeleton`.
- Refine feature components in place where the contract is already good.
- Introduce only a small number of new presentational layers when they improve clarity across multiple tabs.

### Routing and navigation impact

- Keep the current primary tab routes unchanged.
- Preserve all deep links and secondary routes already hanging off the tabs.
- Improve Add discoverability by clarifying the relationship between the bottom-nav add affordance, `/wardrobe/add`, and `/wardrobe/scan`.

### Data contract considerations

- Do not change Supabase schemas.
- Do not change edge function inputs or outputs.
- Do not replace real flows with placeholders.
- Any behavior fix must remain frontend-only unless an integration bug forces a targeted backend patch.

## Execution Plan

1. Refine the dark premium design foundation and app shell.
2. Rebuild Home for a single clear recommendation focus.
3. Rebuild Wardrobe for elegant browsing and faster control.
4. Rebuild Add around three primary entry points: live scan, upload photo, bulk add.
5. Rebuild Plan around a calm day-centric planning surface.
6. Rebuild Insights around value, recommendations, and premium narrative clarity.
7. Expand regression tests, especially the Add contract and updated tab-presence guarantees.
