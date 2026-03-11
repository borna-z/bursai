

# Fix: Only conversation area should scroll in Stylist Chat

## Problem
The `AppLayout` wraps the chat page with `<main className="flex-1 overflow-y-auto">`, which means the **entire page** (header + badge + messages + input) scrolls as one block. The header and input bar should stay fixed; only the messages area should scroll.

## Solution
Pass `hideNav` is not enough — the chat page needs to **opt out of the parent `<main>` scroll** entirely. The fix:

1. **`src/pages/AIChat.tsx`**: The outer `<div>` already has `flex flex-col` with a calculated height. The messages div at line 291 already has `overflow-y-auto`. The issue is that `AppLayout`'s `<main>` also has `overflow-y-auto`, creating a double-scroll situation.

2. **Add `overflow-hidden`** to the chat page's root div so the `<main>` scroll container has nothing to scroll — all scrolling is handled by the inner messages div.

### Change in `src/pages/AIChat.tsx` (line 253):
```tsx
// Before:
<div className="flex flex-col" style={{ height: 'calc(100dvh - 4rem)' }}>

// After:
<div className="flex flex-col overflow-hidden" style={{ height: 'calc(100dvh - 4rem)' }}>
```

This single class addition ensures:
- **Header**: stays pinned at top (already `shrink-0`)
- **Messages area**: scrolls independently (`flex-1 overflow-y-auto`)
- **Input bar**: stays pinned at bottom (already `shrink-0`)
- **Parent `<main>`**: has nothing overflowing, so no page-level scroll

