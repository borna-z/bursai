

# Fix Stylist AI header layout and Insights back navigation

## Problem 1: Insights page has no back button
The Insights page (`/insights`) uses `PageHeader` without `showBack`, so users get stuck with no way to navigate back.

**Fix**: Add `showBack` to the `PageHeader` in `src/pages/Insights.tsx` (lines 124, 133, 143).

## Problem 2: Stylist AI header placement
The `PageHeader` + mode switcher take up too much vertical space and the layout feels off. The mode switcher floats separately below the header with extra padding.

**Fix**: Integrate the mode switcher directly into the `PageHeader` as part of the `actions` area (right side), or move it into the header area itself so it feels like one cohesive bar instead of two separate blocks. This saves vertical space and looks cleaner.

## Technical changes

| File | Change |
|------|--------|
| `src/pages/Insights.tsx` | Add `showBack` to all 3 `PageHeader` usages (lines 124, 133, 143) |
| `src/pages/AIChat.tsx` | Move the mode switcher into the PageHeader row (embed it as a child or in the actions area), remove the separate `div` block below the header |

