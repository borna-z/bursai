

# Show Day Summary Instead of Raw Calendar Blocks

## Problem
The Plan page currently shows **both** raw calendar event badges (individual blocks) **and** the AI summary card below them. The user wants the summary to be the primary view — a cohesive AI-generated overview of the day — not a list of raw calendar entries.

## Solution
Remove the standalone `CalendarEventsList` rendering. The `DaySummaryCard` already consumes calendar events via `useDaySummary` and presents them as a cohesive summary with transition timeline. Only show individual event badges as a fallback when no AI summary is available (e.g., loading failed or events haven't been summarized yet).

## Changes

### `src/pages/Plan.tsx`
- **Lines 316-319**: Move the `CalendarEventsList` to only render as a fallback — when there are calendar events but no day summary and summary is not loading
- Change from:
  ```tsx
  {calendarEvents.length > 0 && (
    <CalendarEventsList events={calendarEvents} maxDisplay={4} />
  )}
  <DaySummaryCard ... />
  ```
- To:
  ```tsx
  <DaySummaryCard ... />
  {/* Fallback: show raw events only when no AI summary available */}
  {calendarEvents.length > 0 && !daySummary && !isSummaryLoading && (
    <CalendarEventsList events={calendarEvents} maxDisplay={4} />
  )}
  ```

This puts the AI summary first (the cohesive day overview) and only shows raw calendar blocks if the summary isn't available.

