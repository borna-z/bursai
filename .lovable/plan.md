

# Make BURS Ready for Median.co Native Wrapper

## What is Median.co?
Median.co wraps your web app into native iOS/Android apps using a WebView with access to native features (push notifications, status bar, haptics, camera, etc.) via a JavaScript Bridge.

## What needs to change

### 1. Create a Median detection utility (`src/lib/median.ts`)
- Detect if the app is running inside a Median native wrapper by checking the user agent for `median` or `gonative`
- Export helpers: `isMedianApp()`, `isMedianIOS()`, `isMedianAndroid()`
- Export a `medianBridge` object that safely calls `median.*` JS bridge functions when available

### 2. Update haptics (`src/lib/haptics.ts`)
- When running inside Median, use the Median haptics bridge (`median.haptics.impact()`) instead of the Vibration API, which provides real native haptic feedback (taptic engine on iOS)
- Fall back to current Vibration API for browser usage

### 3. Update push notifications (`src/hooks/usePushNotifications.ts`)
- When inside Median, use the Median OneSignal or native push bridge instead of Web Push/VAPID
- Median handles push registration natively — detect and skip service worker registration
- Use `median.onesignal.register()` or `median.push.register()` when in-app

### 4. Hide browser-specific UI when in native app
- **Bottom nav**: Add safe-area padding that works with Median's native insets (already using `safe-bottom` class — verify it works with Median's `env(safe-area-inset-bottom)`)
- **Landing page**: Skip entirely when inside Median (users installed the app, they don't need the marketing page). Redirect `/welcome` to `/` or `/auth`
- **"Install app" or PWA prompts**: Hide any install banners when inside Median
- **Cookie consent banner**: Hide inside native app (not needed for app store apps)

### 5. External link handling (`src/lib/externalNavigation.ts`)
- When inside Median, use `median.open.externalBrowser(url)` for links that should leave the app (Stripe checkout, Instagram, privacy/terms links)
- Links with `target="_blank"` should use `median.share.open()` or external browser bridge

### 6. Status bar configuration
- On app load inside Median, call `median.statusbar.set({style: 'dark'})` for light theme and `median.statusbar.set({style: 'light'})` for dark theme
- Update when theme changes via the ThemeContext

### 7. Navigation behavior
- Disable pull-to-refresh browser behavior (Median has its own config for this, but CSS `overscroll-behavior: none` on body helps)
- Ensure back-swipe gesture works with React Router (Median supports native back gestures — no code change needed, but verify `history.back()` is used in back buttons)

### 8. Manifest & meta tags adjustments (`index.html`)
- The existing `<meta name="apple-mobile-web-app-capable">` and viewport settings are already good
- Add `overscroll-behavior: none` to prevent bounce scrolling in WebView

### 9. Camera/photo access
- Current photo upload for garments uses `<input type="file" accept="image/*">` which works in Median WebView
- For LiveScan (camera), Median's native camera plugin provides better UX — detect and use `median.camera.openPhotoLibrary()` or `median.camera.takePhoto()` when available

## Files to create/edit

| File | Action |
|------|--------|
| `src/lib/median.ts` | **Create** — detection utils + bridge wrapper |
| `src/lib/haptics.ts` | **Edit** — add Median native haptics |
| `src/hooks/usePushNotifications.ts` | **Edit** — add Median push path |
| `src/components/layout/AppLayout.tsx` | **Edit** — apply `overscroll-behavior: none` |
| `src/components/layout/BottomNav.tsx` | **Edit** — ensure safe area works with Median |
| `src/lib/externalNavigation.ts` | **Edit** — add Median external browser bridge |
| `src/contexts/ThemeContext.tsx` | **Edit** — sync status bar style on theme change |
| `src/components/landing/CookieConsent.tsx` | **Edit** — hide in Median |
| `src/pages/Index.tsx` | **Edit** — skip landing redirect when in Median |
| `src/index.css` | **Edit** — add `overscroll-behavior: none` to html/body |

## What does NOT need changing
- Routing (React Router works fine in Median WebView)
- Auth flow (works as-is in WebView)
- All existing API calls and edge functions (unchanged)
- The bottom tab navigation pattern (Median supports web-based tab bars)

