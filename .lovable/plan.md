

# Plan: Fix Travel Capsule State Loss & Planner Integration

## Bug 1: Destination and dates disappear after picking must-haves

**Root cause**: Navigating to `/plan/travel-capsule/pick-must-haves` unmounts `TravelCapsule`, destroying all component state (destination, dates, coords, weather, occasions, etc.). When returning, only `mustHaveItems` is restored via `location.state`.

**Fix**: Round-trip all form state through `location.state`.

### Changes in `src/pages/TravelCapsule.tsx`:
- When navigating to the must-haves picker (line 652), pass the full form state:
  ```
  { mustHaveItems, destination, destCoords, dateRange: { from: dateRange.from?.toISOString(), to: dateRange.to?.toISOString() },
    selectedOccasions, minimizeItems, includeTravelDays, outfitsPerDay, hasManualOccasions }
  ```
- On mount, restore all form fields from `location.state` (expand the existing `useEffect` at line 102 to also restore destination, destCoords, dateRange, selectedOccasions, etc.)
- After restoring coords + dates, re-trigger weather lookup

### Changes in `src/pages/PickMustHaves.tsx`:
- Forward all incoming state (not just `mustHaveItems`) back when navigating to `/plan/travel-capsule` on done — spread `location.state` into the outgoing state so nothing is lost

## Bug 2: Add capsule outfits to the planner calendar

The "Add to Plan" button already exists and works (`handleAddToCalendar`, lines 388–459). It creates outfit records and planned_outfit entries linked to each trip day. However:

1. **One outfit per day conflict**: The upsert uses `onConflict: 'user_id,date'`, so if a user already has a planned outfit for a trip day, it gets overwritten silently. This is acceptable but should show a toast warning.
2. **After adding, navigate to Plan page**: After successfully adding outfits to the calendar, navigate the user to `/plan` so they can see their planned days. Currently it just shows a toast.
3. **Navigate to Plan button**: Add a "View in Planner" button that appears after successful calendar add, navigating to `/plan`.

### Changes in `src/pages/TravelCapsule.tsx`:
- After `handleAddToCalendar` succeeds, set a `addedToCalendar` state flag
- Show a "View in Planner" button alongside the existing bottom bar when `addedToCalendar` is true
- The button navigates to `/plan` with the start date pre-selected

---

## Summary
- **3 files touched**: `TravelCapsule.tsx`, `PickMustHaves.tsx`
- **Bug 1 fix**: Persist and restore full form state across navigation
- **Bug 2 fix**: Post-add navigation to planner + visual confirmation

