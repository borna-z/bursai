

# Fix: Show Calendar Summary on Plan Page

## Problem
The Plan page uses `useDaySummary` which only returns data when calendar events exist AND the AI `summarize_day` function succeeds. If either fails, nothing calendar-related is shown. The `CalendarEventsList` component already exists but isn't used on this page.

## Solution
Add the `CalendarEventsList` component directly to the Plan page so calendar events are always visible for the selected date — both as standalone context and as a complement to the AI summary.

## Changes

### `src/pages/Plan.tsx`
- Import `useCalendarEvents` from `@/hooks/useCalendarSync`
- Import `CalendarEventsList` from `@/components/plan/CalendarEventBadge`
- Fetch events for `selectedDateStr` using `useCalendarEvents(selectedDateStr)`
- Render `CalendarEventsList` just above the `DaySummaryCard` (between weather line and AI summary), showing event badges with time, title, occasion icons, and provider indicator
- This ensures events are always visible even when the AI summary is loading or fails

