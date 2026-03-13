

# Fix Camera on Android (Median Wrapper)

## Problem

There are two camera-related issues on Android inside the Median.co wrapper:

1. **`useMedianCamera` uses non-existent bridge APIs**: The code calls `window.median.camera.takePhoto()` and `window.median.camera.openPhotoLibrary()`, but these are **not real Median JS Bridge methods**. According to Median's official docs, camera/file uploads work via standard `<input type="file">` HTML elements — there is no `median.camera.takePhoto` bridge. The calls silently fail, then the fallback triggers `fileInputRef.click()`, but by that point the user-gesture context may be lost (especially on Android).

2. **LiveScan calls `getUserMedia` inside `useEffect`**: This violates Android WebView security — camera access must be initiated from a direct user gesture. The `useEffect` call fails silently in Median's Android WebView.

## Plan

### 1. Fix `useMedianCamera` hook — remove fake bridge calls

- Remove the non-existent `median.camera.takePhoto` and `median.camera.openPhotoLibrary` bridge calls
- Go directly to the `<input type="file">` approach, which is Median's officially supported method
- For `takePhoto`: set `capture="environment"` and `accept="image/*"` on the input, then `.click()`
- For `pickFromGallery`: remove `capture` attribute, keep `accept="image/*"`, then `.click()`
- Since there's no async bridge call before the `.click()`, the user-gesture context is preserved

### 2. Fix LiveScan — require user gesture for camera start

- Don't auto-start camera in `useEffect`
- Show a "Start Camera" button that calls `getUserMedia` directly in its `onClick` handler
- This satisfies Android WebView's security requirement for user-gesture-initiated media access
- Keep the existing camera logic but gate it behind the button press

### 3. Clean up type declarations

- Remove the fake `camera` property from the `Window.median` type declaration in `src/lib/median.ts`

## Files to change

| File | Change |
|------|--------|
| `src/hooks/useMedianCamera.ts` | Remove bridge calls, go straight to file input click |
| `src/lib/median.ts` | Remove `camera` from `Window.median` type |
| `src/pages/LiveScan.tsx` | Add "Start Camera" button, move `getUserMedia` into click handler |

