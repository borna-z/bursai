

# Plan: Add "Show All" Toggle to Must-Have Garments Picker

## Problem
Currently the must-have garments picker only shows the first 30 items (`allGarments?.slice(0, 30)`). Users with larger wardrobes can't access all their garments.

## Solution
Add a "Show all" / "Show less" toggle button at the end of the garment row. When toggled, display all garments instead of just 30.

## Changes

### `src/pages/TravelCapsule.tsx`
- Add a `showAllMustHaves` boolean state (default `false`)
- Replace `allGarments?.slice(0, 30)` with conditional: show all when toggled, otherwise show first 20
- Add a small "Show all (N)" button at the end of the scrollable row that toggles the state
- When expanded, switch from horizontal scroll to a wrapping grid layout so all items are visible without scrolling

### `src/i18n/translations.ts`
- Add keys: `capsule.show_all_garments` / `capsule.show_less`

