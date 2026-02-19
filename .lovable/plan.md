

# Fix Visible Scrollbars Across All Pages

## Problem

The WeekStrip on the Plan page shows a visible scrollbar because it uses `scrollbar-hide` (a class that doesn't exist). The CSS only defines `.hide-scrollbar`. The AISuggestions component also has a horizontal scroll list without hidden scrollbars.

## Changes

### 1. Add `scrollbar-hide` utility to CSS (`src/index.css`)

Add `.scrollbar-hide` as an alias alongside the existing `.hide-scrollbar` class so both names work. This is the simplest fix that prevents future confusion.

### 2. AISuggestions -- Remove horizontal scroll (`src/components/insights/AISuggestions.tsx`)

Replace the `overflow-x-auto` horizontal scroll row of garment thumbnails with a `flex-wrap` layout so thumbnails just wrap to the next line instead of scrolling.

### 3. WeekStrip -- Keep as navigation

The 7-day horizontal strip is navigation, not a list. Keep `overflow-x-auto` but it will now be properly hidden thanks to the CSS fix in step 1.

## Technical Details

| File | Change |
|------|--------|
| `src/index.css` | Add `.scrollbar-hide` utility class (mirrors `.hide-scrollbar`) |
| `src/components/insights/AISuggestions.tsx` | Replace `overflow-x-auto` with `flex-wrap` on garment thumbnails row |

Two small edits. No logic changes.
