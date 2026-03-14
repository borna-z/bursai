# BURS — Median.co QA Checklist

## Safe Areas & Layout
- [ ] Notch area renders correctly on iPhone X+ (status bar content visible)
- [ ] Home indicator area has proper padding on iPhone
- [ ] Android navigation bar doesn't overlap bottom nav
- [ ] Landscape orientation handled (or locked to portrait)

## Status Bar
- [ ] Light text on dark routes (landing, onboarding)
- [ ] Dark text on light routes (app pages in light mode)
- [ ] Correct sync on theme toggle
- [ ] Status bar updates on every route change

## Haptic Feedback
- [ ] Bottom nav tab tap → light haptic
- [ ] Pull-to-refresh threshold → light haptic
- [ ] Garment added → success haptic
- [ ] Garment deleted → heavy haptic
- [ ] Outfit saved → success haptic
- [ ] Outfit marked as worn → success haptic
- [ ] Swipe card actions → light haptic

## Camera & Gallery
- [ ] "Take photo" opens device camera (rear)
- [ ] "Choose from gallery" opens photo picker
- [ ] Large images compressed before upload (max 1200px, WebP)
- [ ] Both work on iOS and Android WebViews

## External Links
- [ ] Privacy policy opens in native browser
- [ ] Terms of service opens in native browser
- [ ] Stripe checkout opens in native browser
- [ ] Social links open in native browser
- [ ] "Contact us" email link works

## Keyboard Behavior
- [ ] Bottom nav shifts up when keyboard opens (iOS)
- [ ] Input fields not obscured by keyboard
- [ ] No input zoom on iOS (font-size ≥ 16px)
- [ ] Chat input stays visible when keyboard open
- [ ] Keyboard dismiss on background tap

## Pull-to-Refresh
- [ ] Works on Home page
- [ ] Works on Wardrobe page
- [ ] Native feel (no double-bounce in Median)
- [ ] Loading indicator shows during refresh

## Push Notifications
- [ ] Permission prompt appears on first use
- [ ] Notifications received when app in background
- [ ] Tap notification navigates to correct screen
- [ ] Notification settings toggle works

## Deep Links
- [ ] `burs.me/u/:username` opens public profile
- [ ] `burs.me/outfit/:id` opens outfit detail
- [ ] `burs.me/auth` opens auth page
- [ ] `burs.me/share/:id` opens shared outfit

## Navigation
- [ ] Hardware back button works (Android)
- [ ] Swipe-back gesture works (iOS)
- [ ] Bottom nav persists on app pages
- [ ] Bottom nav hidden on landing/auth/onboarding

## Offline Mode
- [ ] App shell loads without network
- [ ] Cached wardrobe images display
- [ ] Mutations queue when offline
- [ ] Sync banner appears on reconnect
- [ ] Queued changes replay successfully

## Performance
- [ ] LCP < 2.5s on first load
- [ ] No visible layout shifts (CLS < 0.1)
- [ ] Smooth 60fps scrolling in wardrobe grid
- [ ] Route transitions feel instant (< 300ms)
- [ ] No jank during pull-to-refresh animation

## Share
- [ ] Native share sheet opens for outfit sharing
- [ ] Share URL is correct and accessible
- [ ] Fallback to clipboard when share unavailable

## Splash Screen
- [ ] No white flash between splash and first paint
- [ ] Background color matches splash screen
- [ ] App loads within 3 seconds
