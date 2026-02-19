
# Fix Global Horizontal Scrollbar on All Pages

## Problem

A horizontal scrollbar is visible at the bottom of multiple pages (Insights, AI Stylist, and potentially others) on mobile. This happens because no `overflow-x: hidden` is set on the body or root layout, so any element that overflows even slightly causes the browser to show a horizontal scrollbar.

## Solution

Add `overflow-x: hidden` to the `body` element in `src/index.css`. This is a single-line fix that eliminates horizontal scrollbars globally across all pages.

## Technical Details

| File | Change |
|------|--------|
| `src/index.css` | Add `overflow-x: hidden` to the `body` rule (line ~148) |

This is a one-line CSS change. No component changes needed.
