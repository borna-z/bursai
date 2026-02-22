
# Keep Weather Pill collapsed by default

## Problem
The weather pill auto-expands every time the page loads if a manual city is set, breaking the minimalist layout. Users should tap to expand it themselves.

## Fix

### `src/components/weather/WeatherPill.tsx`
- **Remove** the `useEffect` on lines 50-53 that auto-expands when `locationSource === 'manual'`
- The `isOpen` state already defaults to `false`, so removing that effect is the only change needed
- The pill will stay collapsed on load; users tap to expand and see the forecast/location editor
- The "Change" button in the location toast will still correctly open the pill via `setIsOpen(true)`

One small, targeted change -- nothing else affected.
