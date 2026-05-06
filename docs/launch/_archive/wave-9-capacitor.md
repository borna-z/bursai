## Wave 9 — Capacitor Migration

Note: Details for Wave 9 are scoped at execution time. The specs below are structural — the actual work depends on Capacitor's current version and plugin availability at session time. Each prompt requires reading Capacitor docs first.

### P58 — Capacitor scaffold

**Problem**
App currently wrapped via Median.co. Capacitor migration needed for proper IAP, native features, App Store submission.

**Fix**
1. `npm install @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android`
2. `npx cap init BURS me.burs.app --web-dir=dist`
3. `npx cap add ios`
4. `npx cap add android`
5. Configure `capacitor.config.ts`:
   - `appId: 'me.burs.app'`
   - `appName: 'BURS'`
   - `webDir: 'dist'`
   - `server.androidScheme: 'https'`
   - Icon/splash settings

**Files**
- `capacitor.config.ts` (new)
- `ios/` (generated)
- `android/` (generated)
- `package.json` (new deps)

**Acceptance**
- `npx cap sync` works
- `npx cap run ios` launches in simulator
- `npx cap run android` launches in emulator

**Deploy** None.

---

### P59 — Camera: Median → @capacitor/camera

**Problem**
`src/hooks/useMedianCamera.ts` uses Median bridge. Replace with Capacitor.

**Fix**
1. `npm install @capacitor/camera`
2. Create `src/hooks/useCamera.ts`:
```typescript
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

export function useCamera() {
  const takePhoto = async () => {
    const photo = await Camera.getPhoto({
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Camera,
      quality: 85,
      width: 1024,
    });
    return photo.dataUrl;
  };
  // ... pickFromGallery similar
  return { takePhoto, pickFromGallery };
}
```
3. Update all consumers (`AddGarment.tsx`, `LiveScan.tsx`, `useAddGarment.ts`) to use new hook.
4. Delete `src/hooks/useMedianCamera.ts`.

**Files**
- `src/hooks/useCamera.ts` (new)
- `src/hooks/useMedianCamera.ts` (delete)
- All consumers

**Acceptance**
- Camera opens on iOS and Android
- Photo quality settings preserved
- Gallery picker works

**Deploy** None.

---

### P60 — Status bar: Median → @capacitor/status-bar

Similar pattern to P59. Install `@capacitor/status-bar`, replace `useMedianStatusBar.ts`.

**Files**
- `src/hooks/useStatusBar.ts` (new)
- `src/hooks/useMedianStatusBar.ts` (delete)
- Consumers

---

### P61 — Haptics: Median bridge → @capacitor/haptics

Replace `src/lib/haptics.ts` with `@capacitor/haptics`.

---

### P62 — Deep links via @capacitor/app

Install, configure, handle app-level URL opens.

---

### P63 — Push notifications via @capacitor/push-notifications

Replace web push with native where beneficial.

---

### P64 — Splash screen + app icon

Asset generation via `@capacitor/assets` plugin.

---

### P65 — iOS Info.plist permissions

Add usage descriptions for camera, photo library.

---

### P66 — Android manifest permissions

Same as P65 for Android.

---

### P67 — Safe-area handling

Replace Median approach with Capacitor's `@capacitor/status-bar` + CSS safe-area-inset.

---

### P68 — Share API via @capacitor/share

Replace `src/lib/nativeShare.ts` Median bridge.

---

### P69 — Remove all Median files

After Waves 58-68 validated:
- Delete `src/hooks/useMedianCamera.ts`
- Delete `src/hooks/useMedianStatusBar.ts`
- Delete `src/lib/median.ts`
- Remove any remaining Median references

---

