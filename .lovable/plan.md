

# Fix: Restore Scrolling on All Pages

## Problem

The recent change made `AppLayout`'s outer div `h-[100dvh] overflow-hidden`, which correctly prevents the browser scrollbar. But the `<main>` element inside it has no `overflow-y-auto`, so **all page content is clipped and cannot be scrolled**. This affects Wardrobe, Insights, Settings, Plan, and every other page with content taller than the viewport.

Only AIChat works because it has its own internal `overflow-y-auto` container.

## Solution

Make `AppLayout` use a flex column layout so the `<main>` element fills the remaining space and scrolls internally.

### File: `src/components/layout/AppLayout.tsx`

Change the layout to:

```
<div className="h-[100dvh] overflow-hidden bg-background flex flex-col">
  <main className="flex-1 overflow-y-auto scrollbar-hide {other classes}">
    {children}
  </main>
  {!hideNav && <BottomNav />}
</div>
```

Key changes:
- Add `flex flex-col` to the outer div so children stack vertically
- Add `flex-1 overflow-y-auto scrollbar-hide` to `<main>` so it fills available space and scrolls internally (without a visible scrollbar)
- The `BottomNav` is `fixed` so it doesn't affect the flex layout, but the `pb-20` on main already accounts for it

This is a single-file, single-line class change. No logic changes. All pages regain scrolling while the browser scrollbar stays hidden.
