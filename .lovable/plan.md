

# Fix: Live Scan camera permission not being requested

## Problem

The Live Scan page uses `getUserMedia` which requires the browser/WebView to have camera permissions. The current code structure is correct for standard browsers (permission is requested from a button click handler), but there are two likely issues:

1. **Median WebView**: When running inside the Median.co native wrapper, `getUserMedia` may not be supported or may require special permission configuration in the native app. The Median bridge doesn't expose a camera API — it relies on `<input type="file" capture>` instead.

2. **Missing permission check**: The code jumps straight to `getUserMedia` without first checking if the API is available or if permissions have been granted/denied. If permission was previously denied, users get a generic "Camera not available" error with no guidance on how to fix it.

## Plan

### 1. Add Median detection fallback
When running inside Median (`isMedianApp()`), skip `getUserMedia` entirely and fall back to a file-input-based capture flow using the existing `useMedianCamera` pattern. The live video stream won't work in Median's WebView, so we show a "take photo" button instead.

### 2. Improve permission handling for browsers
Before calling `getUserMedia`, use `navigator.permissions.query({ name: 'camera' })` to check if permission is already denied, and show a clear message telling users to enable camera access in their browser/device settings.

### 3. Better error messages
Replace the generic `t('scan.camera_error')` with specific messages for:
- Permission denied → "Camera access denied. Please enable it in your browser settings."
- No camera found → "No camera detected on this device."
- Median WebView → Switch to file-input capture mode automatically.

### Files to change

- **`src/pages