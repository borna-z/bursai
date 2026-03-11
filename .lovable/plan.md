

# Fix: Chat input hidden behind bottom nav

## Problem
The chat container uses `absolute inset-0` which fills the entire `<main>` area. But `<main>` has `pb-[88px]` as padding (not reducing its content box for absolute children). The `absolute inset-0` child stretches to the full height of `<main>` including behind the bottom nav, so the input bar sits behind it.

## Solution
Change `inset-0` to explicit insets that respect the bottom nav height. Since the bottom nav is 64px tall plus safe-area, use `pb-[88px]` on the chat container's bottom, or more cleanly — just avoid `absolute` and use the parent's padding correctly.

**Simplest fix**: Remove `absolute inset-0` and go back to filling the flex parent naturally. The real issue is that `<main>` with `overflow-y-auto` scrolls, but we need the chat to fill it without scrolling. Since `<main>` has `pb-[88px]`, we need the chat div to fill the remaining space and handle its own layout.

**Best approach**: Use `h-full` plus `overflow-hidden` on the chat container, and change `<main>` to `overflow-hidden` only for this page — but that requires a prop. Instead:

**Cleanest fix**: Keep `absolute inset-0` but add `bottom-0` accounting for the nav. Since `pb-[88px]` is padding on main, absolute children ignore it. So set `bottom: 0` but the chat input needs extra bottom padding to clear the nav.

→ Add `pb-20` (80px) to the chat container so the input clears the bottom nav:

### `src/pages/AIChat.tsx` (line 253):
```tsx
// Before:
<div className="absolute inset-0 flex flex-col overflow-hidden">

// After:
<div className="absolute inset-0 flex flex-col overflow-hidden pb-20">
```

This adds 80px of bottom padding inside the chat container, pushing the input bar above the bottom navigation.

