

# Hide Vertical Scrollbars Across All Pages

## Problem
Vertical scrollbars are still visible on mobile in the AI Chat messages area and the command dropdown list.

## Solution
Apply the existing `scrollbar-hide` CSS class to all elements that use `overflow-y-auto` or `overflow-auto`, so scrolling still works but the scrollbar is invisible.

## Changes

| File | Change |
|------|--------|
| `src/pages/AIChat.tsx` | Add `scrollbar-hide` class to the messages container (line 277) |
| `src/components/ui/command.tsx` | Add `scrollbar-hide` class to CommandList (line 63) |
| `src/components/ui/table.tsx` | Add `scrollbar-hide` class to the table wrapper (line 7) |
| `src/components/ui/sidebar.tsx` | Add `scrollbar-hide` class to SidebarContent (line 334) |

Four single-line class additions. No logic changes. Scroll functionality is preserved, only the visible scrollbar is hidden.
