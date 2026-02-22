

# Fix PWA Native App Feel -- No Zoom, Matching Header, Polished Mobile Experience

## Problems

1. **Auto-zoom on inputs**: iOS Safari auto-zooms when font size in input fields is below 16px. The app uses `text-sm` (14px) on inputs, triggering unwanted zoom.
2. **Dark status bar header mismatch**: The `theme-color` meta tag is `#111111` (charcoal), but the app background is `#F6F4F1` (light mode) or `#0D0D0D` (dark mode), creating a visible color seam between the OS status bar and the app.
3. **Missing PWA-specific meta tags**: No `apple-mobile-web-app-status-bar-style`, no zoom-prevention viewport settings, no `apple-mobile-web-app-capable`.

## Fixes

### 1. `index.html` -- Viewport and Meta Tags

- Update the viewport meta to prevent auto-zoom:
  ```
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover, maximum-scale=1.0, user-scalable=no" />
  ```
- Add `apple-mobile-web-app-capable` for true fullscreen PWA on iOS:
  ```
  <meta name="apple-mobile-web-app-capable" content="yes" />
  ```
- Add status bar style that blends with the app content:
  ```
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  ```
  This makes the iOS status bar overlay transparent so the app background shows through -- no more color mismatch.
- Update `theme-color` to use two meta tags for light/dark:
  ```
  <meta name="theme-color" content="#F6F4F1" media="(prefers-color-scheme: light)" />
  <meta name="theme-color" content="#0D0D0D" media="(prefers-color-scheme: dark)" />
  ```

### 2. `src/index.css` -- Safe Area Padding for Status Bar

- Add top safe-area padding to the body or root layout so content does not hide behind the transparent status bar:
  ```css
  body {
    padding-top: env(safe-area-inset-top, 0);
  }
  ```
- This ensures the app content starts below the notch/status bar area.

### 3. `src/pages/Auth.tsx` -- Fix Input Zoom

- Change input font size to 16px minimum to prevent iOS auto-zoom. Update `inputClass` to use `text-base` instead of `text-sm`.

### 4. `src/index.css` -- Global Input Zoom Prevention

- Add a global rule to ensure all inputs and selects render at 16px minimum on mobile:
  ```css
  @media screen and (max-width: 768px) {
    input, select, textarea { font-size: 16px !important; }
  }
  ```

### 5. `public/manifest.json` -- Align Colors

- Update `background_color` and `theme_color` to match the actual app background for a seamless splash screen:
  - `background_color`: `#F6F4F1`
  - `theme_color`: `#F6F4F1`

These are small, targeted changes across 4 files that together eliminate zoom, fix the header color seam, and make the PWA feel like a native app.
