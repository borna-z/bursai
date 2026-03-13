

# Plan: Full-Page Garment Picker for Must-Have Items

## Problem
The current must-have garments picker is a small inline row with tiny thumbnails. Users want a dedicated full-screen page to browse their entire wardrobe and select multiple must-have items comfortably.

## Solution
Create a new page `/travel-capsule/pick-must-haves` that shows the full wardrobe in a grid with multi-select. The Travel Capsule form navigates to this page; on confirmation, selected IDs are passed back via URL state.

## Changes

### 1. New Page — `src/pages/PickMustHaves.tsx`
- Full-screen page with search bar, category filter chips, and a 3-column garment grid (matching wardrobe layout)
- Each garment card is tappable to toggle selection (check overlay when selected)
- Header shows count of selected items and a "Done" button
- On "Done", navigate back to `/travel-capsule` passing selected IDs via `location.state`
- Receive previously selected IDs via `location.state` on entry so selections persist

### 2. Update `src/pages/TravelCapsule.tsx`
- Replace the inline "Show all" garment row with a summary row: show first ~5 selected garment thumbnails + a "Browse wardrobe (N selected)" button
- The button navigates to `/travel-capsule/pick-must-haves` with current `mustHaveItems` in state
- On return from picker page, read `location.state.mustHaveItems` and update state
- Remove `showAllMustHaves` state and the inline grid logic

### 3. Add Route — `src/components/layout/AnimatedRoutes.tsx`
- Add lazy import and protected route for `/travel-capsule/pick-must-haves`

### 4. Translations — `src/i18n/translations.ts`
- Add keys: `capsule.browse_wardrobe`, `capsule.n_selected`, `capsule.pick_must_haves`, `capsule.done`

