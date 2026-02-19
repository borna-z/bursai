

# Fix Persistent Scrollbar and Scroll-to-Top on Navigation

## Problems

1. **Vertical scrollbar still visible on the right**: The browser's native scrollbar on the `html`/`body` element is still showing when content overflows. The previous `scrollbar-hide` fixes only targeted inner containers, not the root scrollable element.

2. **Pages don't start from the top when navigating**: When switching between pages via the bottom nav (e.g., Plan to AI Stylist), the scroll position carries over, making it look like you've already scrolled down.

## Solution

### Fix 1: Hide the body/html scrollbar globally

Add `scrollbar-hide` styles directly to `html` and `body` in `src/index.css`. This removes the visible scrollbar while keeping scroll functionality.

| File | Change |
|------|--------|
| `src/index.css` | Add `scrollbar-hide` equivalent styles to `html` in the base layer (lines 144-146) |

Specifically, add these properties to `html`:
- `-ms-overflow-style: none`
- `scrollbar-width: none`

And add a CSS rule for `html::-webkit-scrollbar { display: none; }`.

### Fix 2: Scroll to top on route change

Create a small `ScrollToTop` component that listens to route changes and scrolls the window to the top. Then add it inside the `BrowserRouter` in `App.tsx`.

| File | Change |
|------|--------|
| `src/components/layout/ScrollToTop.tsx` | New file: a component using `useLocation` + `useEffect` to call `window.scrollTo(0, 0)` on pathname change |
| `src/App.tsx` | Import and add `<ScrollToTop />` inside `<BrowserRouter>`, before `<Routes>` |

### Fix 3: Make AppLayout not contribute to body scroll on full-screen pages

For pages like AI Chat that manage their own scroll internally (using `overflow-y-auto` on an inner container with `height: calc(100dvh - 4rem)`), the outer `AppLayout` div should use `h-screen overflow-hidden` to prevent the body from scrolling at all. This ensures only the inner chat container scrolls.

| File | Change |
|------|--------|
| `src/components/layout/AppLayout.tsx` | Change outer div from `min-h-screen` to `h-[100dvh] overflow-hidden` so the body never overflows |

This is a total of 4 small changes across 3 files (1 new, 2 edited).

