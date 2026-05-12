// Nitro JS wrapper for the Android-only `GarmentDetector` HybridObject. The
// Kotlin implementation (see `mobile/plugins/with-garment-detector/android/`)
// wraps Google MLKit Object Detection and is registered with Nitro at native
// init via the codegen'd `HybridGarmentDetector` autolinking entry in
// `mobile/nitro.json`.
//
// On iOS this module is not registered (the spec is `HybridObject<{ android:
// 'kotlin' }>` only), so `NitroModules.createHybridObject('GarmentDetector')`
// must NOT be called at module load on iOS. The `frameProcessor.ts` consumer
// gates this import behind a `Platform.OS === 'android'` branch so iOS bundles
// never execute the `createHybridObject` call.

import { NitroModules } from 'react-native-nitro-modules';

import type { GarmentDetector } from '../../../specs/GarmentDetector.nitro';

/**
 * Android-only Nitro garment detector. Calling `.detect(frame)` from inside a
 * `useFrameOutput` worklet returns an array of `DetectedBox` synchronously.
 *
 * Do NOT import this module from iOS code paths — the underlying hybrid
 * object is only registered on Android. Use a `Platform.OS === 'android'`
 * gate at the call site.
 */
export const garmentDetector =
  NitroModules.createHybridObject<GarmentDetector>('GarmentDetector');
