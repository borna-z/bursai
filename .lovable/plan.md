

# Fix Dark Mode Status Bar Mismatch in PWA

## Problem

The screenshot shows a visible color seam between the iOS status bar and the app content in dark mode. The status bar shows a slightly different shade of black than the app background.

Root cause: The `theme-color` for dark mode is set to `#0D0D0D`, but the actual body background in `index.html` is `#030305`, and the CSS dark background token is `0 0% 5%` (which is approximately `#0D0D0D`). The inline body style on `index.html` uses `#030305` which creates a mismatch.

## Fixes

### 1. `index.html` -- Align dark theme-color with actual body background

Change the dark `theme-color` meta tag from `#0D0D0D` to `#030305` so the status bar matches the actual body inline background color. Also update the inline body `background` to match the CSS token, or vice versa -- pick one consistent value.

**Decision**: Use `#0D0D0D` everywhere (matching the CSS `--background: 0 0% 5%` = `hsl(0,0%,5%)` = `#0D0D0D`) and update the body inline style from `#030305` to `#0D0D0D`.

Alternatively, keep `#030305` for the ultra-dark noir look and update the CSS `--background` in `.dark` to `0 0% 1%` to match. The simplest fix: align the `theme-color` and inline body `background` to the same value.

**Recommended approach**: Change `index.html` body inline style to `#0D0D0D` and keep the dark theme-color as `#0D0D0D`. This keeps CSS tokens and meta tags consistent.

### 2. Verify safe-area padding

The `padding-top: env(safe-area-inset-top)` on body is already applied. With `black-translucent` status bar style, the content extends behind the status bar, and the safe-area padding pushes content down so it remains visible. The background color showing through the status bar will now match the app.

## Files changed

| File | Change |
|---|---|
| `index.html` | Change body inline `background:#030305` to `background:#0D0D0D` to match CSS dark background and theme-color meta |

This is a one-line change that eliminates the visible color seam between the status bar and app content in dark mode PWA.
