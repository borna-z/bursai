

# Progressive AI Unlock System + Replace Discover with Insights Tab

## Overview
Replace the gamified challenges system with a wardrobe-size-based feature unlock system, then swap the 5th bottom nav tab from Discover to Insights.

## New Files

### 1. `src/hooks/useWardrobeUnlocks.ts`
- Pure client-side hook reading from `useGarmentCount()`
- Defines the 6 tiers as specified (wardrobe/0, outfit_gen/5, gap_analysis/10, travel_capsule/10, insights/20, style_report/20)
- Returns: `{ currentCount, currentTierIndex, nextUnlock, garmentsNeeded, isUnlocked(feature) }`

### 2. `src/components/discover/WardrobeProgress.tsx` (replaces DiscoverChallenges)
- Progress bar showing count toward next milestone
- Lists locked features with lock icon + "Add X more garments to unlock"
- Shows unlocked features with accent checkmark
- Editorial tone, no gamification language
- Single "Add to wardrobe" CTA → `/wardrobe/add`
- Uses `border-border/15 bg-card/60` card style

## Modified Files

### 3. `src/pages/Discover.tsx`
- Remove all challenge/participation state, Supabase queries, `joinChallenge`
- Remove `DiscoverChallenges` import
- Import and render `WardrobeProgress` instead
- Remove `UNLOCK_THRESHOLDS` constant

### 4. `src/pages/OutfitGenerate.tsx`
- At top of component: call `useWardrobeUnlocks()`
- If `!isUnlocked('outfit_gen')`, render `WardrobeProgress` with explanation message instead of the generate flow

### 5. `src/components/discover/WardrobeGapSection.tsx`
- Gate the scan behind `isUnlocked('gap_analysis')`
- If locked, show progress toward 10 garments using `WardrobeProgress`

### 6. `src/pages/TravelCapsule.tsx`
- Gate behind `isUnlocked('travel_capsule')`
- If locked, show `WardrobeProgress` with message

### 7. `src/components/layout/BottomNav.tsx`
- Change 5th tab from `{ path: '/discover', labelKey: 'nav.discover', icon: Compass }` to `{ path: '/insights', labelKey: 'nav.insights', icon: BarChart3 }`
- Update icon import: replace `Compass` with `BarChart3` from lucide-react

### 8. `src/pages/Insights.tsx`
- Remove `showBack` from `PageHeader` (it's now a primary tab, not a sub-page)

### 9. `src/components/layout/AnimatedRoutes.tsx`
- Keep `/discover` route (still accessible via direct links)
- Keep `/insights` route as-is

### 10. Cleanup
- Delete `DiscoverChallenges.tsx` contents (or repurpose file as WardrobeProgress)
- Remove `useTrendingUnlocked` import from BottomNav (no more "NEW" badge on Discover)

## What stays unchanged
- PaywallModal, useSubscription, premium gates — completely separate system
- All existing routes remain accessible
- Discover page still exists at `/discover` but no longer in nav

