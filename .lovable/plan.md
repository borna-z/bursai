

# Fix Chat Layout — Pin Header & Input, Scroll Only Messages

## Problem
The chat page's `h-full` inside `AppLayout`'s `<main class="flex-1 overflow-y-auto pb-[88px]">` creates a conflict. The `pb-[88px]` padding is meant for normal scrolling pages, but the chat page needs a fixed layout where only the message area scrolls. The `h-full` doesn't account for the 88px padding, so the input gets pushed behind the bottom nav.

## Solution
Two changes:

### 1. `src/pages/AIChat.tsx` — Use `AppLayout` with `hideNav` disabled but override the main scroll
The root div should not rely on `h-full` which fights with the padding. Instead, make it absolutely fill the available space:

```tsx
// Line 253 — change:
<div className="flex flex-col overflow-hidden h-full">
// to:
<div className="absolute inset-0 flex flex-col overflow-hidden">
```

This makes the chat container fill the entire `<main>` element exactly, ignoring the `pb-[88px]` padding (which is irrelevant for a fixed-layout page). The header (`shrink-0`), messages (`flex-1 overflow-y-auto`), and input (`shrink-0`) will distribute correctly.

Also need to make `<main>` a positioning context by adding `relative` — but actually `<main>` with `overflow-y-auto` already establishes a containing block for `absolute` children.

### 2. Ensure `<main>` is `relative`
Add `relative` to main in `AppLayout.tsx` so the absolute positioning works:

```tsx
// Line 15:
<main className={`flex-1 overflow-y-auto scrollbar-hide relative ${hideNav ? '' : 'pb-[88px]'}`}>
```

### Result
- Header: fixed at top
- Messages: scrollable middle area
- Input: fixed at bottom, above the bottom nav
- No double-scroll

