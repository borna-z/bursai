

# Desktop-Optimized Planner

## Overview
Transform the Plan page into a responsive two-panel layout on desktop (768px+) while keeping the existing mobile experience untouched. The desktop version uses a master-detail pattern: a scrollable week overview on the left, and the selected day's full detail on the right -- with seamless transitions between days.

## Desktop Layout

```text
+----------------------------------------------------------+
|  Header: "Planera din vecka"        [Auto-plan week btn]  |
+----------------------------------------------------------+
|  WEEK OVERVIEW (left, ~380px)  |  SELECTED DAY (right)   |
|                                |                          |
|  [Mon 19 - card summary]      |  "Idag" + Weather        |
|  [Tue 20 - card summary] <--  |  AI Day Summary          |
|  [Wed 21 - card summary]      |  Outfit preview (large)  |
|  [Thu 22 - empty dashed]      |  Tags + Explanation      |
|  [Fri 23 - empty dashed]      |  Actions (Swap/Details)  |
|  [Sat 24 - card summary]      |  Mark worn / Remove      |
|  [Sun 25 - empty dashed]      |                          |
+----------------------------------------------------------+
```

## Changes

### 1. Update Plan page layout (`src/pages/Plan.tsx`)
- Import `useIsMobile` hook
- On desktop: render a two-column grid layout (`grid grid-cols-[380px_1fr]`) instead of the single-column mobile view
- Left panel: scrollable list of 7 compact `DayCard` components showing mini outfit previews
- Right panel: the full selected-day detail (weather, AI summary, outfit grid, actions) -- same content as current mobile view
- Remove `max-w-lg` constraint on desktop; use `max-w-5xl` instead
- Keep entire mobile layout as-is when `isMobile` is true

### 2. Enhance WeekStrip for desktop (`src/components/plan/WeekStrip.tsx`)
- On desktop, hide the horizontal strip (it's replaced by the left-panel day cards)
- Only render on mobile

### 3. Create desktop day list items
- Reuse the existing `DayCard` component in a more compact "mini" variant for the left panel
- Each mini card shows: date label, weather badge, occasion icon, tiny outfit thumbnails (or "empty" state)
- Selected card gets a highlighted border with accent color
- Clicking a card updates `selectedDate` with a smooth crossfade on the right panel

### 4. Add animations
- Right panel content: `animate-fade-in` on date change (keyed by `selectedDateStr`) for a smooth crossfade
- Left panel day cards: staggered `animate-drape-in` on mount
- Selected card: `ring-2 ring-accent` transition with `transition-all duration-200`
- Outfit image grid on desktop: slightly larger aspect ratio for better visual impact
- Hover effects on day cards: subtle `hover:shadow-md hover:border-accent/30` with `transition-all`

### 5. Update AppLayout/header for desktop
- Widen the header's `max-w` to match the new layout (`max-w-5xl`)
- Calendar popover and auto-plan button remain in the header

### 6. Responsive breakpoints
- Mobile (< 768px): Current layout, completely unchanged
- Desktop (>= 768px): Two-panel master-detail layout

## Technical Details

### Files to modify:
| File | Change |
|------|--------|
| `src/pages/Plan.tsx` | Add `useIsMobile`, conditionally render two-panel desktop layout vs current mobile layout. Right panel uses a `key={selectedDateStr}` wrapper with `animate-fade-in` for crossfade. |
| `src/components/plan/WeekStrip.tsx` | No changes needed -- hidden on desktop via parent conditional rendering |
| `src/components/plan/DayCard.tsx` | Add optional `mini` prop for compact left-panel rendering. When `mini=true`: shorter height, no AI summary, inline actions hidden, just date + weather + outfit thumbnails. |

### Animation details:
- Day selection crossfade: wrap right panel in `<div key={selectedDateStr} className="animate-fade-in">` so React re-mounts with fade on each date change
- Left panel cards: `stagger-drape` class on container for staggered entrance
- Card hover: `transition-all duration-200 hover:shadow-md`
- Selected card: `ring-2 ring-accent shadow-md` with smooth `transition-all duration-200`

### No breaking changes:
- Mobile experience is completely unchanged
- All existing sheets (PlanningSheet, QuickGenerateSheet, SwapSheet, etc.) continue to work as bottom sheets on both mobile and desktop
- All hooks and data flow remain identical
