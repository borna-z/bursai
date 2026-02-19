

# Fix: Full-Width Layout and Scroll-to-Top for Internal Container

## Problem

1. **Content not filling full width**: `max-w-lg mx-auto` is applied on the `<main>` element in `AppLayout`, which constrains the entire scrollable area to 512px. Every page already applies its own `max-w-lg mx-auto` on inner content divs, so the one on `<main>` is redundant and causes double-constraining.

2. **ScrollToTop targets wrong element**: Currently `window.scrollTo(0, 0)` is used, but since `AppLayout` uses `overflow-hidden` on the outer div, the window itself doesn't scroll -- the `<main>` element does. So scroll-to-top has no effect.

## Changes

### 1. `src/components/layout/AppLayout.tsx`

Remove `max-w-lg mx-auto` from `<main>` -- keep only `pb-20` for bottom nav padding. The `<main>` should be full-width; individual pages handle their own width constraints.

```
<main className={`flex-1 overflow-y-auto scrollbar-hide ${hideNav ? '' : 'pb-20'}`}>
```

### 2. `src/components/layout/ScrollToTop.tsx`

Instead of `window.scrollTo`, find the `<main>` element (the actual scrolling container) and reset its `scrollTop` to 0 on route change.

```tsx
useEffect(() => {
  window.scrollTo(0, 0);
  const main = document.querySelector('main');
  if (main) main.scrollTop = 0;
}, [pathname]);
```

## Why This Works

- Every page (Settings, Home, Plan, Wardrobe, etc.) already has `max-w-lg mx-auto` on its own content wrapper, so width is handled per-page.
- `PageHeader` and `BottomNav` also have their own `max-w-lg mx-auto`.
- Removing the constraint from `<main>` lets the background and scroll area fill the full viewport width, which looks correct on all screen sizes.
- Scroll-to-top now targets the real scrolling container so pages start at the top when navigating.

Two files, two small edits.

