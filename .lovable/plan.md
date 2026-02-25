

## Problem Analysis

The landing page fails to render content below the header on first visit. Only a refresh makes it work.

### Root Cause

There are **two interacting bugs**:

**Bug 1: IntersectionObserver uses wrong scroll root**

The Landing page creates its own scroll container: `<div className="dark-landing" style={{ height: '100vh', overflowY: 'auto' }}>`. But the IntersectionObserver on lines 27-43 and 76-95 uses the default `root: null`, which means it observes against the **viewport**, not the actual scroll container. Since all content scrolls inside the `dark-landing` div (not the viewport), elements below the fold never intersect the viewport root and never get the `visible` class. They stay at `opacity: 0` forever.

On refresh, browsers sometimes restore scroll state or the timing differs, causing elements to briefly intersect and become visible.

**Bug 2: Broken cleanup in the re-observer useEffect (line 76-95)**

The second `useEffect` has **no dependency array**, meaning it runs on every render. Inside it, a `setTimeout` callback returns `() => observer.disconnect()` — but that return value is ignored (it's inside a setTimeout callback, not the useEffect return). Observers accumulate endlessly, causing memory leaks and performance issues.

**Bug 3 (minor): `contentVisibility: 'auto'` on HeroSection**

This CSS property can cause the browser to skip rendering off-screen content, which can interact badly with the scroll container setup.

### Fix Plan

**File: `src/pages/Landing.tsx`**

1. **Fix IntersectionObserver root** — Pass `root: scrollRef.current` so the observer works against the actual scroll container instead of the viewport.

2. **Fix the re-observer useEffect** — Add a proper dependency array (`[]`) and fix the cleanup so the observer is properly disconnected when the component unmounts. Use a `MutationObserver` or a single persistent IntersectionObserver that handles dynamically added elements, instead of running on every render.

3. **Simplify to a single useEffect** — Merge the two observer effects into one that:
   - Waits for `scrollRef.current` to be available
   - Creates a single IntersectionObserver with `root: scrollRef.current`
   - Uses a MutationObserver to detect when lazy-loaded sections mount and auto-observe new reveal elements
   - Properly cleans up both observers on unmount

**File: `src/components/landing/HeroSection.tsx`**

4. **Remove `contentVisibility: 'auto'`** — This property can prevent content from rendering when inside a custom scroll container. Remove it since the hero section should always be visible.

### Technical Details

```text
Current flow (broken):
  Landing mounts
  → scrollRef div = custom scroll container (height:100vh, overflow:auto)
  → IntersectionObserver created with root:null (viewport)
  → Elements scroll inside scrollRef, NOT viewport
  → Observer never fires → elements stay opacity:0
  → User sees only fixed header + invisible content

Fixed flow:
  Landing mounts
  → scrollRef div = custom scroll container
  → IntersectionObserver created with root: scrollRef.current
  → Elements scroll inside scrollRef
  → Observer fires correctly → elements get .visible class
  → Full page renders properly on first visit
```

### Scope
- `src/pages/Landing.tsx` — fix observer root + cleanup
- `src/components/landing/HeroSection.tsx` — remove contentVisibility

No other files affected. No database or backend changes needed.
