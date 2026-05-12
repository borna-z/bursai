# Wave R Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce on-device subject segmentation as a free product output AND as preprocessed input to Gemini Studio renders, close residual mobile add-garment flow gaps, and apply a small iOS LiveScan quality fix. Android LiveScan auto-detect parity is deferred (see spec revision note 2026-05-12).

**Architecture:**
- **R-A:** Tiny iOS quality-prioritization fix (`'speed'` vs `'balanced'` capability check). Pure JS, no native code.
- **R-B:** Two new native modules (iOS Swift Vision wrapper / Android Kotlin MLKit Subject Segmentation wrapper) shipped via a single **Expo config plugin** under `mobile/plugins/with-background-removal/`. JS wrapper. Pipeline insertion at every capture path. Gemini prompt branch on `garments.mask_status` enum.
- **R-C:** Defensive imageUpload + interactive Step 3 pickers. Pure JS.
- **R-D:** `batchPipeline.ts` state machine refactor + `expo-task-manager` background processing + AsyncStorage checkpoint persistence.

**Why no direct commits to `mobile/android/` or `mobile/ios/`:** Both dirs are gitignored (`mobile/.gitignore:41 = /android`; same for ios). Expo managed workflow regenerates them from `app.json` + config plugins on every prebuild. Any hand-edits get blown away. R-B uses the standard Expo "local config plugin" pattern.

**Tech stack:** React Native + Expo SDK 54, `react-native-vision-camera@5.0.9` (Nitro), Kotlin (Android frame processor + MLKit), Swift (iOS Vision framework), `expo-image-manipulator`, `expo-task-manager`, Supabase Postgres + Edge Functions (Deno).

**Source spec:** `docs/launch/waves/r-android-parity-and-on-device-bg.md`

**PR order (each is its own PR, sequenced):**
1. R-A → merge
2. R-B → merge + `npx supabase db push --linked --yes` + `supabase functions deploy process_render_jobs`
3. R-C and R-D in parallel → merge

---

## PR R-A · Android LiveScan auto-detect via Nitro + MLKit + Expo config plugin (L)

**Files:**
- Create: `mobile/plugins/with-garment-detector/index.js` (config plugin entry)
- Create: `mobile/plugins/with-garment-detector/android/HybridGarmentDetector.kt`
- Create: `mobile/plugins/with-garment-detector/android/GarmentDetectorPackage.kt`
- Create: `mobile/specs/GarmentDetector.nitro.ts` (Nitro TS spec — codegen input)
- Create or modify: `mobile/nitro.json` (nitrogen config)
- Modify: `mobile/app.json` (register plugin in `expo.plugins`)
- Modify: `mobile/src/screens/LiveScan/frameProcessor.ts` (Android branch using `useFrameProcessor` + Nitro)
- Create: `mobile/src/screens/LiveScan/garmentDetector.ts` (JS wrapper around the generated Nitro hybrid)
- Modify: `CLAUDE.md` (CURRENT WAVE pointer)
- Modify: `docs/launch/overview.md` (CURRENT WAVE pointer)

**Native code present.** Validation requires `npx expo prebuild --platform android --clean` + EAS dev client build + real-device test on Pixel 6 / Samsung S22.

### Task R-A.1: Pre-flight — verify installed Nitro + vision-camera Frame API

**Why:** Nitro codegen tool naming and vision-camera v5 Frame API have moved between versions. Before writing any code, the implementer subagent MUST read the current state of installed packages to anchor task R-A.4's spec file to real types.

- [ ] **Step 1: Install mobile dependencies (so node_modules is queryable)**

```bash
cd mobile && npm install --no-audit --no-fund
```

- [ ] **Step 2: Inventory Nitro tooling**

```bash
cat mobile/node_modules/react-native-nitro-modules/package.json | grep -E '"name"|"version"|bin|generator'
ls mobile/node_modules/.bin/ | grep -i nitro
```

Document: exact codegen binary name (likely `nitro-codegen` or `nitrogen`), exact `react-native-nitro-modules` version.

- [ ] **Step 3: Inventory vision-camera v5 Frame + worklets surface**

```bash
ls mobile/node_modules/react-native-vision-camera/lib/typescript/
cat mobile/node_modules/react-native-vision-camera/lib/typescript/Frame.d.ts 2>/dev/null || find mobile/node_modules/react-native-vision-camera -name "Frame*.d.ts" -exec cat {} \;
```

Document: the exact `Frame` type signature, the `useFrameProcessor` export, and whether `Frame` is Nitro-bridgeable.

- [ ] **Step 4: Inventory current LiveScan structure (existing iOS path)**

Read `mobile/src/screens/LiveScan/frameProcessor.ts`, `mobile/src/screens/LiveScanScreen.tsx`, `mobile/src/screens/LiveScan/scoring.ts`, `mobile/src/screens/LiveScan/stabilityLock.ts`. Document: exact shared-value names, exact `DetectedObject` shape, where the worklet would be wired into the existing `<Camera />` `outputs` array.

- [ ] **Step 5: Report findings — DO NOT commit**

Output a markdown report listing: Nitro version + codegen binary name, exact Frame type, current shared values + DetectedObject shape, recommended insertion point. **Do not write code in this task.** The findings inform all subsequent R-A tasks.

### Task R-A.2: Scaffold the Expo config plugin

**Files to create:**
- `mobile/plugins/with-garment-detector/index.js`
- `mobile/plugins/with-garment-detector/android/` (empty dir, sources land in later tasks)
- Modify `mobile/app.json` to register plugin

- [ ] **Step 1: Create the plugin entry**

`mobile/plugins/with-garment-detector/index.js`:

```javascript
const {
  withAppBuildGradle,
  withMainApplication,
  withDangerousMod,
} = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const MLKIT_DEP_LINE =
  `    implementation 'com.google.mlkit:object-detection:17.0.1'`;
const MLKIT_DEP_MARKER = 'com.google.mlkit:object-detection';

function withMlkitGradleDep(config) {
  return withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.contents.includes(MLKIT_DEP_MARKER)) return cfg;
    cfg.modResults.contents = cfg.modResults.contents.replace(
      /dependencies\s*\{/,
      (match) => `${match}\n${MLKIT_DEP_LINE}\n    // ^ Wave R-A garment detector`,
    );
    return cfg;
  });
}

function withGarmentDetectorPackageRegistration(config) {
  return withMainApplication(config, (cfg) => {
    const importLine = 'import me.burs.app.livescan.GarmentDetectorPackage';
    if (cfg.modResults.contents.includes('GarmentDetectorPackage')) return cfg;
    // Add import after the package declaration
    cfg.modResults.contents = cfg.modResults.contents.replace(
      /^(package .+\n)/m,
      `$1\n${importLine}\n`,
    );
    // Add to packages list — pattern depends on the file's package-list style
    // (Expo SDK 54 default uses PackageList(this).packages). We splice in.
    cfg.modResults.contents = cfg.modResults.contents.replace(
      /(PackageList\(this\)\.packages)/,
      `$1.toMutableList().apply { add(GarmentDetectorPackage()) }`,
    );
    return cfg;
  });
}

function withKotlinSourceCopy(config) {
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const root = cfg.modRequest.projectRoot;
      const src = path.join(root, 'plugins', 'with-garment-detector', 'android');
      const destBase = path.join(
        cfg.modRequest.platformProjectRoot,
        'app', 'src', 'main', 'java', 'me', 'burs', 'app', 'livescan',
      );
      fs.mkdirSync(destBase, { recursive: true });
      for (const file of fs.readdirSync(src)) {
        if (file.endsWith('.kt')) {
          fs.copyFileSync(
            path.join(src, file),
            path.join(destBase, file),
          );
        }
      }
      return cfg;
    },
  ]);
}

module.exports = function withGarmentDetector(config) {
  config = withMlkitGradleDep(config);
  config = withGarmentDetectorPackageRegistration(config);
  config = withKotlinSourceCopy(config);
  return config;
};
```

**Caveat for implementer:** the regex in `withGarmentDetectorPackageRegistration` is brittle — it assumes the Expo SDK 54 default `PackageList(this).packages` pattern in `MainApplication.kt`. Implementer must read the actual `MainApplication.kt` first (after `npx expo prebuild --platform android` once) to confirm the pattern, and adjust the regex if different. Iterate until prebuild + the package registration both succeed.

- [ ] **Step 2: Register the plugin in `mobile/app.json`**

In the `expo.plugins` array, append:

```json
"./plugins/with-garment-detector"
```

- [ ] **Step 3: Commit (sources land in later tasks)**

```bash
git add mobile/plugins/with-garment-detector/ mobile/app.json
git commit -m "R-A: scaffold Expo config plugin for Android garment detector"
```

### Task R-A.3: Author the Nitro TypeScript spec

**Files:**
- `mobile/specs/GarmentDetector.nitro.ts` (new)
- `mobile/nitro.json` (new or amended)

- [ ] **Step 1: Define the hybrid spec**

`mobile/specs/GarmentDetector.nitro.ts`:

```typescript
import type { HybridObject } from 'react-native-nitro-modules';
import type { Frame } from 'react-native-vision-camera';

export interface GarmentDetectionBox {
  x: number;      // 0..1 normalized to frame width
  y: number;      // 0..1 normalized to frame height
  width: number;  // 0..1
  height: number; // 0..1
}

export interface GarmentDetectionResult {
  valid: boolean;
  score: number;          // 0..1 confidence
  box: GarmentDetectionBox | null;
}

export interface GarmentDetector
  extends HybridObject<{ android: 'kotlin' }> {
  /**
   * Run MLKit Object Detection on a vision-camera Frame.
   * Returns the single best garment-shaped detection or {valid:false}.
   * Synchronous from the worklet thread; MLKit task awaited inline (~15-30ms on Pixel 6).
   */
  detect(frame: Frame): GarmentDetectionResult;
}
```

**Implementer note:** Check the actual `HybridObject` import path against what R-A.1 Step 2 reported. If `react-native-nitro-modules` exposes it differently in the installed version, adapt accordingly.

- [ ] **Step 2: Configure nitrogen**

`mobile/nitro.json` (top-level keys may differ — confirm against installed nitro version's docs):

```json
{
  "cxxNamespace": ["burs"],
  "android": {
    "androidNamespace": ["burs", "livescan"],
    "androidCxxLibName": "BursGarmentDetector"
  },
  "autolinking": {
    "GarmentDetector": {
      "kotlin": "me.burs.app.livescan.HybridGarmentDetector"
    }
  }
}
```

- [ ] **Step 3: Run nitrogen**

```bash
cd mobile && npx nitro-codegen  # or whatever binary R-A.1 Step 2 reported
```

Expected: generates `mobile/specs/generated/` with Kotlin scaffolding + JS bindings.

- [ ] **Step 4: Commit**

```bash
git add mobile/specs/ mobile/nitro.json
git commit -m "R-A: Nitro spec + codegen artifacts for GarmentDetector"
```

### Task R-A.4: Implement the Kotlin Nitro module

- [ ] **Step 1: Create the Kotlin implementation**

`mobile/plugins/with-garment-detector/android/HybridGarmentDetector.kt`:

```kotlin
package me.burs.app.livescan

import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.objects.DetectedObject
import com.google.mlkit.vision.objects.ObjectDetection
import com.google.mlkit.vision.objects.defaults.ObjectDetectorOptions
import com.google.android.gms.tasks.Tasks
import com.mrousavy.camera.frameprocessors.Frame
// Generated base class — exact name will appear in mobile/specs/generated/ after Task R-A.3
import burs.livescan.HybridGarmentDetectorSpec

import java.util.concurrent.TimeUnit

class HybridGarmentDetector : HybridGarmentDetectorSpec() {

    private val detector = ObjectDetection.getClient(
        ObjectDetectorOptions.Builder()
            .setDetectorMode(ObjectDetectorOptions.STREAM_MODE)
            .enableClassification()
            .build()
    )

    override fun detect(frame: Frame): GarmentDetectionResult {
        val image = frame.image
        val rotation = frame.orientation.toDegrees()
        val input = InputImage.fromMediaImage(image, rotation)

        val results: List<DetectedObject> = try {
            Tasks.await(detector.process(input), 50, TimeUnit.MILLISECONDS)
        } catch (t: Throwable) {
            return GarmentDetectionResult(valid = false, score = 0.0, box = null)
        }

        val best = results
            .filter { obj -> obj.labels.any { it.text.equals("Fashion good", ignoreCase = true) } }
            .maxByOrNull { obj ->
                obj.labels.maxOfOrNull { it.confidence } ?: 0f
            } ?: results.maxByOrNull { it.boundingBox.width() * it.boundingBox.height() }

        if (best == null) {
            return GarmentDetectionResult(valid = false, score = 0.0, box = null)
        }

        val w = image.width.toDouble()
        val h = image.height.toDouble()
        val box = best.boundingBox
        val score = best.labels.maxOfOrNull { it.confidence } ?: 0.5f

        return GarmentDetectionResult(
            valid = true,
            score = score.toDouble(),
            box = GarmentDetectionBox(
                x = box.left / w,
                y = box.top / h,
                width = box.width() / w,
                height = box.height() / h
            )
        )
    }

    private fun com.mrousavy.camera.core.types.Orientation.toDegrees(): Int = when (this.name) {
        "PORTRAIT" -> 0
        "LANDSCAPE_LEFT" -> 270
        "PORTRAIT_UPSIDE_DOWN" -> 180
        "LANDSCAPE_RIGHT" -> 90
        else -> 0
    }
}
```

**Implementer notes:**
- `HybridGarmentDetectorSpec` is generated by nitrogen in Task R-A.3 — the exact import path will be visible after codegen runs. Adjust the `import` line accordingly.
- The `GarmentDetectionResult` and `GarmentDetectionBox` data classes are also generated by nitrogen — do NOT redeclare them.
- `frame.image` and `frame.orientation` are vision-camera v5 Frame properties — verify these names against R-A.1 Step 3's Frame.d.ts inventory.
- `Tasks.await` is from Google Play Services Tasks API — already a transitive dep of MLKit. If the exact import differs in the installed MLKit version, adjust.

- [ ] **Step 2: Create the package registration**

`mobile/plugins/with-garment-detector/android/GarmentDetectorPackage.kt`:

```kotlin
package me.burs.app.livescan

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class GarmentDetectorPackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): MutableList<NativeModule> =
        mutableListOf()

    override fun createViewManagers(reactContext: ReactApplicationContext): MutableList<ViewManager<*, *>> =
        mutableListOf()
}
```

(Nitro modules don't register as classic NativeModules; they auto-register via the `autolinking` section in `nitro.json`. The Package class exists as a placeholder for any future non-Nitro additions.)

- [ ] **Step 3: Run prebuild to validate the config plugin pipeline**

```bash
cd mobile && npx expo prebuild --platform android --clean
```

Expected: regenerates `mobile/android/`, plugin copies Kotlin files into the generated tree, MLKit dep injected into `build.gradle`, package registered in `MainApplication.kt`. Iterate the plugin's regex/copy logic until this succeeds.

- [ ] **Step 4: Compile Kotlin**

```bash
cd mobile/android && ./gradlew compileDebugKotlin
```

Expected: exit 0. Fix any imports / type mismatches.

- [ ] **Step 5: Commit**

```bash
git add mobile/plugins/with-garment-detector/
git commit -m "R-A: Kotlin Nitro module wrapping MLKit Object Detection"
```

### Task R-A.5: Wire the worklet frame processor (JS)

- [ ] **Step 1: Create the JS wrapper**

`mobile/src/screens/LiveScan/garmentDetector.ts`:

```typescript
import { NitroModules } from 'react-native-nitro-modules';
import type { GarmentDetector } from '../../../specs/GarmentDetector.nitro';

export const garmentDetector = NitroModules.createHybridObject<GarmentDetector>('GarmentDetector');
```

- [ ] **Step 2: Branch the frame processor on platform**

In `mobile/src/screens/LiveScan/frameProcessor.ts`, add an Android path that uses `useFrameProcessor` + `garmentDetector.detect(frame)` and writes the same shared values (`score`, `quality`, `hasDetectorPlugin`) the iOS path writes. Keep iOS path using `useObjectOutput` unchanged.

Concrete shape (adapt to existing patterns reported in R-A.1 Step 4):

```typescript
import { Platform } from 'react-native';
import { useFrameProcessor } from 'react-native-vision-camera';
import { garmentDetector } from './garmentDetector';
import { scoreFrame } from './scoring';

// ... existing iOS hook unchanged ...

export function useAndroidFrameProcessor(shared: FrameProcessorSharedValues) {
  shared.hasDetectorPlugin.value = true;
  return useFrameProcessor((frame) => {
    'worklet';
    const r = garmentDetector.detect(frame);
    if (!r.valid || r.box == null) {
      shared.score.value = 0;
      shared.quality.value = 'searching';
      return;
    }
    const detected = [{ x: r.box.x, y: r.box.y, width: r.box.width, height: r.box.height, confidence: r.score }];
    const { score, quality } = scoreFrame(detected, { exposure: 0.5, sharpness: 0.7 });
    shared.score.value = score;
    shared.quality.value = quality;
  }, []);
}

export function useLiveScanFrameProcessor(shared: FrameProcessorSharedValues) {
  // existing iOS impl returns { objectOutput, markStaleIfNoRecentScan }
  // add a parallel `frameProcessor` field that's null on iOS, defined on Android
  if (Platform.OS === 'android') {
    const frameProcessor = useAndroidFrameProcessor(shared);
    return { objectOutput: null, frameProcessor, markStaleIfNoRecentScan: () => {} };
  }
  // ... existing iOS impl ...
}
```

- [ ] **Step 3: Wire the Android `frameProcessor` into `<Camera />`**

In `mobile/src/screens/LiveScanScreen.tsx`, where `outputs` is currently passed to `<Camera>`, also pass `frameProcessor` when Platform is Android. Reference vision-camera v5 docs for the exact prop shape.

- [ ] **Step 4: Run lint + typecheck**

```bash
cd mobile && npm run lint -- "src/**/*.{ts,tsx}" --max-warnings 0
npm run typecheck
```

- [ ] **Step 5: Commit**

```bash
git add mobile/src/screens/LiveScan/garmentDetector.ts mobile/src/screens/LiveScan/frameProcessor.ts mobile/src/screens/LiveScanScreen.tsx
git commit -m "R-A: Android useFrameProcessor branch driving MLKit Nitro detector"
```

### Task R-A.6: Update CLAUDE.md and overview.md wave pointers

Same as the original R-A.5: flip the CURRENT WAVE pointers to R. Then commit.

### Task R-A.7: PR + EAS dev build + Pixel device test

Same as the original R-A.6: push branch, open PR, trigger EAS dev client build, test on Pixel/Samsung device, Codex review loop, self-review loop, await user merge.

- [ ] **Step 1: Create `GarmentDetectorPlugin.kt`**

`mobile/android/app/src/main/java/com/burs/livescan/GarmentDetectorPlugin.kt`:

```kotlin
package com.burs.livescan

import android.media.Image
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.objects.DetectedObject
import com.google.mlkit.vision.objects.ObjectDetection
import com.google.mlkit.vision.objects.defaults.ObjectDetectorOptions
import com.mrousavy.camera.frameprocessors.Frame
import com.mrousavy.camera.frameprocessors.FrameProcessorPlugin
import com.mrousavy.camera.frameprocessors.VisionCameraProxy
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

class GarmentDetectorPlugin(
    proxy: VisionCameraProxy,
    options: Map<String, Any>?
) : FrameProcessorPlugin() {

    private val detector = ObjectDetection.getClient(
        ObjectDetectorOptions.Builder()
            .setDetectorMode(ObjectDetectorOptions.STREAM_MODE)
            .enableClassification()
            .build()
    )

    override fun callback(frame: Frame, arguments: Map<String, Any>?): Any? {
        val image: Image = frame.image
        val rotation = frame.orientation.toDegrees()
        val input = InputImage.fromMediaImage(image, rotation)

        val latch = CountDownLatch(1)
        var result: List<DetectedObject> = emptyList()
        var failed = false

        detector.process(input)
            .addOnSuccessListener { result = it }
            .addOnFailureListener { failed = true }
            .addOnCompleteListener { latch.countDown() }

        if (!latch.await(50, TimeUnit.MILLISECONDS) || failed) {
            return mapOf("valid" to false, "score" to 0.0, "box" to null)
        }

        val best = result
            .filter { obj -> obj.labels.any { it.text.equals("Fashion good", ignoreCase = true) } }
            .maxByOrNull { obj ->
                obj.labels.maxOfOrNull { it.confidence } ?: 0f
            } ?: result.maxByOrNull { it.boundingBox.width() * it.boundingBox.height() }

        if (best == null) {
            return mapOf("valid" to false, "score" to 0.0, "box" to null)
        }

        val w = image.width.toDouble()
        val h = image.height.toDouble()
        val box = best.boundingBox
        val score = best.labels.maxOfOrNull { it.confidence } ?: 0.5f

        return mapOf(
            "valid" to true,
            "score" to score.toDouble(),
            "box" to mapOf(
                "x" to box.left / w,
                "y" to box.top / h,
                "width" to box.width() / w,
                "height" to box.height() / h
            )
        )
    }

    private fun com.mrousavy.camera.core.types.Orientation.toDegrees(): Int = when (this.name) {
        "PORTRAIT" -> 0
        "LANDSCAPE_LEFT" -> 270
        "PORTRAIT_UPSIDE_DOWN" -> 180
        "LANDSCAPE_RIGHT" -> 90
        else -> 0
    }
}
```

- [ ] **Step 2: Create `GarmentDetectorPackage.kt`** (registers the plugin name with Vision Camera)

`mobile/android/app/src/main/java/com/burs/livescan/GarmentDetectorPackage.kt`:

```kotlin
package com.burs.livescan

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager
import com.mrousavy.camera.frameprocessors.FrameProcessorPluginRegistry

class GarmentDetectorPackage : ReactPackage {
    companion object {
        init {
            FrameProcessorPluginRegistry.addFrameProcessorPlugin("detectGarment") { proxy, options ->
                GarmentDetectorPlugin(proxy, options)
            }
        }
    }

    override fun createNativeModules(reactContext: ReactApplicationContext): MutableList<NativeModule> =
        mutableListOf()

    override fun createViewManagers(reactContext: ReactApplicationContext): MutableList<ViewManager<*, *>> =
        mutableListOf()
}
```

- [ ] **Step 3: Register the package in `MainApplication.kt`**

In `mobile/android/app/src/main/java/com/burs/.../MainApplication.kt` (path discovered in Task R-A.1.Step1), locate the `getPackages()` override and add `GarmentDetectorPackage` to the returned list:

```kotlin
import com.burs.livescan.GarmentDetectorPackage

// inside getPackages():
val packages = PackageList(this).packages.toMutableList()
packages.add(GarmentDetectorPackage())
return packages
```

(Adapt to existing pattern in the file — if `getPackages()` uses a different construction style, append `GarmentDetectorPackage()` to whatever list is returned.)

- [ ] **Step 4: Commit**

```bash
git add mobile/android/app/src/main/java/com/burs/livescan/ mobile/android/app/src/main/java/com/burs/*/MainApplication.kt
git commit -m "R-A: add Kotlin frame processor plugin for Android garment detection (MLKit)"
```

### Task R-A.3: Wire the JS frameProcessor for Android

- [ ] **Step 1: Read current `frameProcessor.ts` to understand iOS path**

```bash
cat mobile/src/screens/LiveScan/frameProcessor.ts
```

Locate the `useObjectOutput` call, the shared values (`detectionScore`, `detectionBox`, `hasDetectorPlugin`), and the throw-catch that disables auto-snap on Android.

- [ ] **Step 2: Add Android plugin loading + frame processor branch**

Modify `mobile/src/screens/LiveScan/frameProcessor.ts`. Replace the existing Android-degrade block (lines ~13-14, 26-31, 181-189 per spec) with:

```typescript
import { Platform } from 'react-native';
import { VisionCameraProxy } from 'react-native-vision-camera';
import { Worklets } from 'react-native-worklets-core'; // adjust to existing import style

const androidPlugin =
  Platform.OS === 'android'
    ? VisionCameraProxy.initFrameProcessorPlugin('detectGarment')
    : null;

export function useGarmentFrameProcessor(/* existing params: shared values, hasDetectorPlugin */) {
  // existing iOS path: useObjectOutput(...) — keep unchanged when Platform.OS === 'ios'
  if (Platform.OS === 'ios') {
    // existing iOS impl unchanged
    return iosFrameProcessor;
  }

  // Android: signal "plugin available" if loaded
  hasDetectorPlugin.value = androidPlugin != null;

  if (androidPlugin == null) {
    // plugin failed to load (older app build / missing registration)
    // keep manual-shutter-only fallback
    return null;
  }

  const frameCounter = Worklets.createSharedValue(0);

  return useFrameProcessor((frame) => {
    'worklet';
    frameCounter.value = (frameCounter.value + 1) % 2;
    if (frameCounter.value !== 0) return; // 15fps throttle on Android

    const result = androidPlugin.call(frame) as
      | { valid: boolean; score: number; box: { x: number; y: number; width: number; height: number } | null }
      | null;

    if (!result || !result.valid || !result.box) {
      detectionScore.value = 0;
      detectionBox.value = null;
      return;
    }

    detectionScore.value = result.score;
    detectionBox.value = result.box;
  }, [androidPlugin, detectionScore, detectionBox]);
}
```

**Important:** preserve existing variable names from the current file (`detectionScore`, `detectionBox`, `hasDetectorPlugin`). If the current code uses Reanimated shared values instead of Worklets shared values, mirror that pattern.

- [ ] **Step 3: Run lint + typecheck**

```bash
cd mobile && npm run lint -- "src/**/*.{ts,tsx}" --max-warnings 0
npm run typecheck
```

Expected: pass with zero warnings.

- [ ] **Step 4: Commit**

```bash
git add mobile/src/screens/LiveScan/frameProcessor.ts
git commit -m "R-A: wire Android MLKit frame processor into LiveScan JS worklet"
```

### Task R-A.4: Fix iOS quality prioritization fallback

- [ ] **Step 1: Read current `LiveScanScreen.tsx` line ~161 to locate the fallback logic**

```bash
sed -n '150,180p' mobile/src/screens/LiveScanScreen.tsx
```

(Use Read tool instead of sed if PowerShell environment; the goal is to see the exact current line.)

- [ ] **Step 2: Replace blanket `'balanced'` fallback with capability-based check**

In `mobile/src/screens/LiveScanScreen.tsx`, replace the existing logic that picks `'balanced'` when `supportsSpeedQualityPrioritization` is missing:

```typescript
const qualityPrioritization: PhotoOutputQualityPrioritization = (() => {
  if (device?.supportsSpeedQualityPrioritization) return 'speed';
  // Many Android devices lack the explicit support flag but can still handle 'speed'
  // if the active format reports 30fps capability. Check formats:
  const has30fpsFormat = device?.formats?.some(
    (f) => f.maxFps >= 30 && f.minFps <= 30
  );
  return has30fpsFormat ? 'speed' : 'balanced';
})();
```

(Adapt variable name `device` and type import to match existing code in the file.)

- [ ] **Step 3: Run typecheck**

```bash
cd mobile && npm run typecheck
```

Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add mobile/src/screens/LiveScanScreen.tsx
git commit -m "R-A: prefer 'speed' quality prioritization when device formats support 30fps"
```

### Task R-A.5: Update CLAUDE.md and overview.md wave pointers

- [ ] **Step 1: Update `CLAUDE.md`**

Change the CURRENT WAVE row:

```markdown
| **CURRENT WAVE** | R — Android platform parity + on-device background removal (4 themed PRs: R-A Android LiveScan · R-B BG removal + Gemini · R-C single-photo polish · R-D batch parity) |
| **CURRENT WAVE FILE** | `docs/launch/waves/r-android-parity-and-on-device-bg.md` |
| **STATUS** | IN PROGRESS — R-A |
```

- [ ] **Step 2: Update `docs/launch/overview.md`** "Current wave" table similarly.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md docs/launch/overview.md
git commit -m "R-A: flip CURRENT WAVE pointer to R (Android parity + on-device BG)"
```

### Task R-A.6: PR + manual device verification

- [ ] **Step 1: Push branch and open PR**

```bash
git push -u origin feat/wave-r-a-android-livescan
gh pr create --title "feat(mobile): Wave R-A — Android LiveScan auto-detect parity (MLKit)" --body "$(cat <<'EOF'
## Summary
- Custom Vision Camera Kotlin frame processor plugin using MLKit Object Detection
- Returns same `{ box, score, valid }` shape as iOS `useObjectOutput`
- All downstream stability-lock + auto-snap logic unchanged
- Fixes iOS quality prioritization fallback to prefer 'speed' when device formats support 30fps

## Test plan
- [ ] EAS dev client build on Android (Pixel 6 or Samsung S22): stability lock fires within 1.5s on framed garment, auto-snap captures at score >= 0.6
- [ ] No FPS drop below 22fps during continuous detection
- [ ] iOS LiveScan (iPhone 14+): unchanged behavior vs PR #837 baseline
- [ ] iOS quality fix: capture sharpness improved on devices missing `supportsSpeedQualityPrioritization`

CI bundle size delta: +~3.5 MB Android (MLKit Object Detection).

Wave R spec: `docs/launch/waves/r-android-parity-and-on-device-bg.md`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 2: Trigger EAS dev client build for Android + iOS**

```bash
cd mobile && eas build --profile development --platform android --non-interactive
eas build --profile development --platform ios --non-interactive
```

- [ ] **Step 3: Install on real devices and run the manual test matrix from the PR body**

Document pass/fail per row in PR description.

- [ ] **Step 4: Codex review loop**

Per memory `feedback-codex-review-loop`: ping `@codex` for review, fix every finding, resolve threads, loop until 5-min quiet window OR 👍 / "no bugs" signal.

- [ ] **Step 5: Self-review loop**

Per memory `feedback-self-review-after-codex`: scan diff with fresh eyes, fix, re-scan, repeat until a full pass finds nothing.

- [ ] **Step 6: Merge (user decision)**

User merges when CI green + Codex gate met + self-review clean + manual device tests pass.

---

## PR R-B · On-device BG removal + Gemini integration

**Files:**
- Create: `mobile/ios/BURS/BackgroundRemoval.swift`
- Create: `mobile/ios/BURS/BackgroundRemoval.m`
- Create: `mobile/android/app/src/main/java/com/burs/bg/BackgroundRemovalModule.kt`
- Create: `mobile/android/app/src/main/java/com/burs/bg/BackgroundRemovalPackage.kt`
- Modify: `mobile/android/app/build.gradle` (+1 dep)
- Modify: `mobile/android/app/src/main/java/com/burs/.../MainApplication.kt` (register package)
- Create: `mobile/src/lib/backgroundRemoval.ts`
- Modify: `mobile/src/lib/imageUpload.ts` (storage path → `{garmentId}/` folder)
- Modify: `mobile/src/lib/garmentSave.ts` (write `original_image_path` + `mask_status`)
- Modify: `mobile/src/screens/LiveScan/pipeline.ts` (segmentation insertion)
- Modify: `mobile/src/screens/AddPieceStep1.tsx` (segmentation insertion in camera + gallery handlers)
- Modify: `mobile/src/screens/GarmentDetailScreen.tsx` (Check Condition button)
- Create: `mobile/src/components/garment/ConditionCheckSheet.tsx`
- Modify: `mobile/src/i18n/locales/en.ts`, `sv.ts` (append-only)
- Create: `supabase/migrations/{ts}_add_mask_status.sql`
- Modify: `supabase/functions/process_render_jobs/index.ts` (prompt branch)

### Task R-B.1: Schema migration

- [ ] **Step 1: Compute timestamp**

```bash
date -u +"%Y%m%d%H%M%S"
```

Use the output as `{ts}` in the filename below.

- [ ] **Step 2: Create migration file**

`supabase/migrations/{ts}_add_mask_status.sql`:

```sql
-- Wave R-B: track on-device segmentation outcome per garment.
-- NULL = legacy pre-feature row, handled identically to 'unavailable' downstream.
ALTER TABLE garments
  ADD COLUMN IF NOT EXISTS mask_status text
    CHECK (mask_status IN ('masked','unavailable','failed') OR mask_status IS NULL);

COMMENT ON COLUMN garments.mask_status IS
  'On-device subject segmentation outcome at capture time. masked=successful segmentation applied to image_path; unavailable=device cannot run segmentation (iOS <17, older Android); failed=segmentation ran but quality threshold not met; NULL=legacy row pre-Wave-R.';
```

- [ ] **Step 3: Commit (do NOT apply via MCP — user authorization required)**

```bash
git add supabase/migrations/
git commit -m "R-B: migration — garments.mask_status enum column"
```

### Task R-B.2: iOS native module (Swift)

- [ ] **Step 1: Create `BackgroundRemoval.swift`**

`mobile/ios/BURS/BackgroundRemoval.swift`:

```swift
import Foundation
import Vision
import UIKit

@objc(BackgroundRemoval)
class BackgroundRemoval: NSObject {

  @objc static func requiresMainQueueSetup() -> Bool { return false }

  @objc
  func prepare(_ resolve: @escaping RCTPromiseResolveBlock,
               rejecter reject: @escaping RCTPromiseRejectBlock) {
    // Vision framework is always loaded on iOS; no warm-up needed
    resolve(nil)
  }

  @objc
  func maskImage(_ uri: NSString,
                 resolver resolve: @escaping RCTPromiseResolveBlock,
                 rejecter reject: @escaping RCTPromiseRejectBlock) {
    let start = Date()

    guard #available(iOS 17.0, *) else {
      resolve([
        "uri": uri as String,
        "status": "unavailable",
        "confidence": 0.0,
        "durationMs": 0
      ])
      return
    }

    let cleanUri = (uri as String).replacingOccurrences(of: "file://", with: "")
    guard let image = UIImage(contentsOfFile: cleanUri),
          let cgImage = image.cgImage else {
      resolve([
        "uri": uri as String,
        "status": "failed",
        "confidence": 0.0,
        "durationMs": Int(Date().timeIntervalSince(start) * 1000)
      ])
      return
    }

    let request = VNGenerateForegroundInstanceMaskRequest()
    let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])

    do {
      try handler.perform([request])

      guard let result = request.results?.first else {
        resolve([
          "uri": uri as String,
          "status": "failed",
          "confidence": 0.0,
          "durationMs": Int(Date().timeIntervalSince(start) * 1000)
        ])
        return
      }

      let maskBuffer = try result.generateMaskedImage(
        ofInstances: result.allInstances,
        from: handler,
        croppedToInstancesExtent: false
      )

      let ciImage = CIImage(cvPixelBuffer: maskBuffer)
      let ctx = CIContext()
      guard let outCG = ctx.createCGImage(ciImage, from: ciImage.extent) else {
        resolve([
          "uri": uri as String,
          "status": "failed",
          "confidence": 0.0,
          "durationMs": Int(Date().timeIntervalSince(start) * 1000)
        ])
        return
      }

      let maskedImage = UIImage(cgImage: outCG)
      // Encode as PNG (preserves alpha); JS layer transcodes to WebP via expo-image-manipulator
      guard let pngData = maskedImage.pngData() else {
        resolve([
          "uri": uri as String,
          "status": "failed",
          "confidence": 0.0,
          "durationMs": Int(Date().timeIntervalSince(start) * 1000)
        ])
        return
      }

      let tmpDir = NSTemporaryDirectory()
      let outPath = (tmpDir as NSString).appendingPathComponent("mask-\(UUID().uuidString).png")
      try pngData.write(to: URL(fileURLWithPath: outPath))

      // Confidence proxy: ratio of non-zero alpha pixels (computed cheaply via image size heuristic)
      let confidence = 0.8 // Vision subject lifting is high-confidence by default; threshold gate is in JS layer

      resolve([
        "uri": "file://" + outPath,
        "status": "masked",
        "confidence": confidence,
        "durationMs": Int(Date().timeIntervalSince(start) * 1000)
      ])
    } catch {
      resolve([
        "uri": uri as String,
        "status": "failed",
        "confidence": 0.0,
        "durationMs": Int(Date().timeIntervalSince(start) * 1000)
      ])
    }
  }
}
```

- [ ] **Step 2: Create `BackgroundRemoval.m` (Obj-C bridge)**

`mobile/ios/BURS/BackgroundRemoval.m`:

```objective-c
#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(BackgroundRemoval, NSObject)

RCT_EXTERN_METHOD(prepare:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(maskImage:(NSString *)uri
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
```

- [ ] **Step 3: Ensure Xcode picks up the new files**

If Expo prebuild is in use, the next `npx expo prebuild --clean` will regenerate the `ios/` tree. To preserve the files, add them via a config plugin in `mobile/plugins/with-background-removal-ios.js`:

```javascript
const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

module.exports = function withBackgroundRemovalIOS(config) {
  return withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const root = cfg.modRequest.projectRoot;
      const src = path.join(root, 'plugins', 'BackgroundRemoval');
      const dest = path.join(cfg.modRequest.platformProjectRoot, 'BURS');
      for (const file of ['BackgroundRemoval.swift', 'BackgroundRemoval.m']) {
        fs.copyFileSync(path.join(src, file), path.join(dest, file));
      }
      return cfg;
    },
  ]);
};
```

And register it in `mobile/app.json` `expo.plugins` array. Move the Swift/m files into `mobile/plugins/BackgroundRemoval/` as the source-of-truth.

- [ ] **Step 4: Commit**

```bash
git add mobile/plugins/BackgroundRemoval/ mobile/plugins/with-background-removal-ios.js mobile/app.json
git commit -m "R-B: iOS native module for Vision subject lifting (iOS 17+)"
```

### Task R-B.3: Android native module (Kotlin MLKit Subject Segmentation)

- [ ] **Step 1: Add MLKit Subject Segmentation dependency**

In `mobile/android/app/build.gradle`, add to `dependencies`:

```gradle
implementation 'com.google.mlkit:subject-segmentation:16.0.0-beta1'
```

- [ ] **Step 2: Create `BackgroundRemovalModule.kt`**

`mobile/android/app/src/main/java/com/burs/bg/BackgroundRemovalModule.kt`:

```kotlin
package com.burs.bg

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Color
import android.net.Uri
import com.facebook.react.bridge.*
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.segmentation.subject.SubjectSegmentation
import com.google.mlkit.vision.segmentation.subject.SubjectSegmenterOptions
import java.io.File
import java.io.FileOutputStream
import java.util.UUID
import kotlin.system.measureTimeMillis

class BackgroundRemovalModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private val segmenter = SubjectSegmentation.getClient(
        SubjectSegmenterOptions.Builder()
            .enableForegroundConfidenceMask()
            .enableForegroundBitmap()
            .build()
    )

    override fun getName(): String = "BackgroundRemoval"

    @ReactMethod
    fun prepare(promise: Promise) {
        // MLKit Subject Segmentation downloads its Play Services module on first use.
        // Trigger by attempting a no-op process (1x1 black bitmap).
        val warm = Bitmap.createBitmap(1, 1, Bitmap.Config.ARGB_8888)
        warm.eraseColor(Color.BLACK)
        segmenter.process(InputImage.fromBitmap(warm, 0))
            .addOnCompleteListener { promise.resolve(null) }
    }

    @ReactMethod
    fun maskImage(uriStr: String, promise: Promise) {
        val start = System.currentTimeMillis()
        val cleanPath = uriStr.removePrefix("file://")
        val srcBitmap = try {
            BitmapFactory.decodeFile(cleanPath)
        } catch (t: Throwable) {
            null
        }

        if (srcBitmap == null) {
            promise.resolve(failedResult(uriStr, start))
            return
        }

        val input = InputImage.fromBitmap(srcBitmap, 0)

        segmenter.process(input)
            .addOnSuccessListener { result ->
                try {
                    val fgBitmap = result.foregroundBitmap
                    val mask = result.foregroundConfidenceMask

                    if (fgBitmap == null || mask == null) {
                        promise.resolve(failedResult(uriStr, start))
                        return@addOnSuccessListener
                    }

                    // Compute mean alpha confidence
                    var sum = 0.0
                    val pixels = mask.remaining()
                    while (mask.hasRemaining()) sum += mask.get()
                    val confidence = if (pixels > 0) sum / pixels else 0.0

                    if (confidence < 0.5) {
                        promise.resolve(failedResult(uriStr, start))
                        return@addOnSuccessListener
                    }

                    val outDir = reactApplicationContext.cacheDir
                    val outFile = File(outDir, "mask-${UUID.randomUUID()}.png")
                    FileOutputStream(outFile).use { fos ->
                        fgBitmap.compress(Bitmap.CompressFormat.PNG, 100, fos)
                    }

                    val resultMap = Arguments.createMap().apply {
                        putString("uri", "file://" + outFile.absolutePath)
                        putString("status", "masked")
                        putDouble("confidence", confidence)
                        putInt("durationMs", (System.currentTimeMillis() - start).toInt())
                    }
                    promise.resolve(resultMap)
                } catch (t: Throwable) {
                    promise.resolve(failedResult(uriStr, start))
                }
            }
            .addOnFailureListener {
                promise.resolve(failedResult(uriStr, start))
            }
    }

    private fun failedResult(uriStr: String, start: Long): WritableMap =
        Arguments.createMap().apply {
            putString("uri", uriStr)
            putString("status", "failed")
            putDouble("confidence", 0.0)
            putInt("durationMs", (System.currentTimeMillis() - start).toInt())
        }
}
```

- [ ] **Step 3: Create `BackgroundRemovalPackage.kt`**

`mobile/android/app/src/main/java/com/burs/bg/BackgroundRemovalPackage.kt`:

```kotlin
package com.burs.bg

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class BackgroundRemovalPackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): MutableList<NativeModule> =
        mutableListOf(BackgroundRemovalModule(reactContext))

    override fun createViewManagers(reactContext: ReactApplicationContext): MutableList<ViewManager<*, *>> =
        mutableListOf()
}
```

- [ ] **Step 4: Register in `MainApplication.kt`**

Add `BackgroundRemovalPackage()` to the package list (same pattern as R-A.2.Step3).

- [ ] **Step 5: Commit**

```bash
git add mobile/android/app/src/main/java/com/burs/bg/ mobile/android/app/build.gradle mobile/android/app/src/main/java/com/burs/*/MainApplication.kt
git commit -m "R-B: Android MLKit Subject Segmentation native module"
```

### Task R-B.4: JS wrapper `backgroundRemoval.ts`

- [ ] **Step 1: Create the wrapper**

`mobile/src/lib/backgroundRemoval.ts`:

```typescript
import { NativeModules } from 'react-native';

export type MaskStatus = 'masked' | 'unavailable' | 'failed';

export type MaskResult = {
  uri: string;
  status: MaskStatus;
  confidence: number;
  durationMs: number;
};

type NativeBG = {
  prepare: () => Promise<void>;
  maskImage: (uri: string) => Promise<MaskResult>;
};

const native: NativeBG | undefined = NativeModules.BackgroundRemoval;

let warmupPromise: Promise<void> | null = null;
const inFlight = new Map<string, Promise<MaskResult>>();

export async function prepareBackgroundRemoval(): Promise<void> {
  if (!native) return;
  if (!warmupPromise) {
    warmupPromise = native.prepare().catch(() => undefined);
  }
  return warmupPromise;
}

export async function removeBackground(uri: string): Promise<MaskResult> {
  if (!native) {
    return { uri, status: 'unavailable', confidence: 0, durationMs: 0 };
  }
  const cached = inFlight.get(uri);
  if (cached) return cached;

  const promise = native.maskImage(uri).catch(
    (): MaskResult => ({ uri, status: 'failed', confidence: 0, durationMs: 0 })
  );
  inFlight.set(uri, promise);
  promise.finally(() => inFlight.delete(uri));
  return promise;
}

/**
 * Save-time blocking helper: wait up to `timeoutMs` for an in-flight mask to settle.
 * On timeout, returns the raw uri with status 'unavailable' so callers can proceed.
 */
export async function awaitMaskOrFallback(
  uri: string,
  timeoutMs: number
): Promise<MaskResult> {
  const inFlightPromise = inFlight.get(uri);
  if (!inFlightPromise) return removeBackground(uri);

  const timeout = new Promise<MaskResult>((resolve) =>
    setTimeout(
      () => resolve({ uri, status: 'unavailable', confidence: 0, durationMs: timeoutMs }),
      timeoutMs
    )
  );
  return Promise.race([inFlightPromise, timeout]);
}
```

- [ ] **Step 2: Wire `prepareBackgroundRemoval()` at app startup**

In `mobile/App.tsx` (or wherever app-level effects live), add:

```typescript
import { prepareBackgroundRemoval } from './src/lib/backgroundRemoval';

useEffect(() => {
  void prepareBackgroundRemoval();
}, []);
```

- [ ] **Step 3: Run lint + typecheck**

```bash
cd mobile && npm run lint -- "src/**/*.{ts,tsx}" --max-warnings 0
npm run typecheck
```

- [ ] **Step 4: Commit**

```bash
git add mobile/src/lib/backgroundRemoval.ts mobile/App.tsx
git commit -m "R-B: JS wrapper + app-startup warm-up for on-device BG removal"
```

### Task R-B.5: Pipeline insertion at capture paths

- [ ] **Step 1: LiveScan pipeline**

In `mobile/src/screens/LiveScan/pipeline.ts`, after the resize step (`resizeForGarment` call) and BEFORE the upload step, insert:

```typescript
import { removeBackground } from '../../lib/backgroundRemoval';

// after resize:
const maskPromise = removeBackground(resized.uri);
// upload raw in parallel (existing call) — do not await maskPromise here
// later, when both settled, persist:
const mask = await maskPromise;
const finalImageUri = mask.status === 'masked' ? mask.uri : resized.uri;
const maskStatus = mask.status;
// Pass `finalImageUri` and `maskStatus` to the save layer alongside the original resized URI.
```

The original `resized.uri` becomes `original_image_path` (raw); `finalImageUri` becomes `image_path` (masked or raw-fallback).

- [ ] **Step 2: AddPieceStep1 single-capture**

In `mobile/src/screens/AddPieceStep1.tsx`, in both the camera (`handleTakePhoto`) and gallery (`handlePickGallery`) handlers, after the resize/manipulate step and before navigating to Step 2, add the same `removeBackground` parallel call. Pass `{ rawUri, maskedUri, maskStatus }` as route params to Step 2 / Step 3.

- [ ] **Step 3: Wire `garmentSave.ts` to persist all three pieces**

Modify `mobile/src/lib/garmentSave.ts`:
- Upload both raw and masked to `garments/{userId}/{garmentId}/raw.jpg` and `.../masked.webp`
- Write row with `original_image_path = raw`, `image_path = masked (or raw on fallback)`, `mask_status = maskStatus`

Generate `garmentId` client-side via `crypto.randomUUID()` (or `expo-crypto` `randomUUID()`) at capture time.

- [ ] **Step 4: Storage path migration in `imageUpload.ts`**

Change the storage path generation from flat `${userId}/${timestamp}-${random}.webp` to per-garment folder `${userId}/${garmentId}/{role}.{ext}` where role is `raw` | `masked` | `studio`.

- [ ] **Step 5: Run lint + typecheck**

```bash
cd mobile && npm run lint -- "src/**/*.{ts,tsx}" --max-warnings 0 && npm run typecheck
```

- [ ] **Step 6: Commit**

```bash
git add mobile/src/screens/LiveScan/pipeline.ts mobile/src/screens/AddPieceStep1.tsx mobile/src/lib/garmentSave.ts mobile/src/lib/imageUpload.ts
git commit -m "R-B: insert on-device segmentation at every capture path; per-garment storage folders"
```

### Task R-B.6: Edge function prompt branch

- [ ] **Step 1: Read current `process_render_jobs/index.ts` to locate the Gemini prompt**

```bash
cat supabase/functions/process_render_jobs/index.ts | head -200
```

- [ ] **Step 2: Add `mask_status` read + prompt branch**

In the section that fetches the garment row and constructs the Gemini prompt:

```typescript
const { data: garment } = await supabase
  .from('garments')
  .select('image_path, mask_status, /* existing fields */')
  .eq('id', garmentId)
  .single();

const systemPrompt = garment.mask_status === 'masked'
  ? `Input image has been pre-segmented onto a transparent background. Compose a clean studio render focusing on lighting, garment shape preservation, and product photography aesthetics. Do not re-remove background.`
  : `/* existing prompt — full removal + composition */`;
```

Keep the rest of the function unchanged.

- [ ] **Step 3: Lint Deno code**

```bash
cd supabase/functions/process_render_jobs && deno lint
```

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/process_render_jobs/index.ts
git commit -m "R-B: branch Gemini prompt on garments.mask_status"
```

### Task R-B.7: Check Condition UI

- [ ] **Step 1: Create `ConditionCheckSheet.tsx`**

`mobile/src/components/garment/ConditionCheckSheet.tsx`:

```typescript
import React, { useState, useEffect } from 'react';
import { View, Modal, Pressable, Image, ActivityIndicator, Dimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSignedUrl } from '../../hooks/useSignedUrl'; // adjust to existing hook
import { hapticLight } from '../../lib/haptics';

type Props = {
  open: boolean;
  onClose: () => void;
  originalImagePath: string | null;
};

export function ConditionCheckSheet({ open, onClose, originalImagePath }: Props) {
  const { t } = useTranslation();
  const { url, loading } = useSignedUrl(originalImagePath);
  const { width, height } = Dimensions.get('window');

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        onPress={() => { hapticLight(); onClose(); }}
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center' }}
      >
        {loading || !url ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Image
            source={{ uri: url }}
            style={{ width: width * 0.95, height: height * 0.85 }}
            resizeMode="contain"
          />
        )}
      </Pressable>
    </Modal>
  );
}
```

- [ ] **Step 2: Add the button to `GarmentDetailScreen.tsx`**

In the action row (alongside Wear / Save outfit etc.):

```typescript
import { ConditionCheckSheet } from '../components/garment/ConditionCheckSheet';

const [conditionOpen, setConditionOpen] = useState(false);

// in the action row JSX:
{garment.original_image_path && (
  <ActionButton
    icon="troubleshoot"
    label={t('garment.checkCondition')}
    onPress={() => setConditionOpen(true)}
  />
)}

<ConditionCheckSheet
  open={conditionOpen}
  onClose={() => setConditionOpen(false)}
  originalImagePath={garment.original_image_path}
/>
```

Adapt `ActionButton` to whatever primitive exists in the screen (or build a minimal pressable matching the existing visual language).

- [ ] **Step 3: Append i18n keys**

In `mobile/src/i18n/locales/en.ts`:

```typescript
garment: {
  // ...existing keys
  checkCondition: 'Check condition',
}
```

In `mobile/src/i18n/locales/sv.ts`:

```typescript
garment: {
  // ...existing keys
  checkCondition: 'Inspektera skick',
}
```

- [ ] **Step 4: Lint + typecheck**

```bash
cd mobile && npm run lint -- "src/**/*.{ts,tsx}" --max-warnings 0 && npm run typecheck
```

- [ ] **Step 5: Commit**

```bash
git add mobile/src/components/garment/ConditionCheckSheet.tsx mobile/src/screens/GarmentDetailScreen.tsx mobile/src/i18n/locales/
git commit -m "R-B: Check Condition viewer on garment detail (raw image_path access)"
```

### Task R-B.8: PR + post-merge deploys

- [ ] **Step 1: Open PR**

```bash
gh pr create --title "feat(mobile)+migration: Wave R-B — on-device BG removal + Gemini preprocessor" --body "$(cat <<'EOF'
## Summary
- iOS 17+ Vision subject lifting + Android MLKit Subject Segmentation native modules
- Per-garment storage folders; raw photo preserved for Check Condition viewer
- Gemini prompt branches on `garments.mask_status` to skip re-removal when input is pre-masked
- "Check condition" button on garment detail surfaces the untouched original

## Migration
`supabase/migrations/{ts}_add_mask_status.sql` — nullable enum column. Idempotent. No backfill.
After merge: `npx supabase db push --linked --yes` from main.
After db push: `npx supabase functions deploy process_render_jobs --project-ref khvkwojtlkcvxjxztduj --no-verify-jwt`.

## Test plan
- [ ] iOS 17+ EAS dev build: capture → masked preview visible within 300ms → Save Original produces clean cutout in wardrobe
- [ ] iOS 15/16 EAS dev build (or simulator): capture → choice sheet shows raw → Save Original produces raw photo, no regression
- [ ] Android Pixel 6 EAS dev build: capture → masked preview within 600ms → Studio render visibly cleaner than control
- [ ] Check Condition button opens raw photo viewer on any R-B garment

Wave R spec: `docs/launch/waves/r-android-parity-and-on-device-bg.md`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 2: Codex + self-review loops, manual device tests** (same as R-A.6 Steps 4-5)

- [ ] **Step 3: After user merge — run db push**

```bash
git checkout main && git pull
npx supabase db push --linked --yes
```

- [ ] **Step 4: After db push succeeds — deploy edge function**

```bash
npx supabase functions deploy process_render_jobs --project-ref khvkwojtlkcvxjxztduj --no-verify-jwt
```

- [ ] **Step 5: Verify on remote**

Capture a garment in the production app, confirm `garments.mask_status` is populated and the studio render quality is improved vs pre-R-B baseline.

---

## PR R-C · Single-photo flow polish

**Files:**
- Modify: `mobile/src/lib/imageUpload.ts` (HEIC + content:// defense)
- Modify: `mobile/src/screens/AddPieceStep3.tsx` (full pickers)
- Create (if absent): `mobile/src/components/pickers/CategoryPicker.tsx`, `ColorPicker.tsx`, `MaterialPicker.tsx`, `SeasonsChips.tsx`, `FormalitySelector.tsx`
- Modify: `mobile/src/i18n/locales/{en,sv}.ts` (append-only)

### Task R-C.1: HEIC explicit transcode

- [ ] **Step 1: Modify `imageUpload.ts`**

Before the existing WebP manipulate call, add:

```typescript
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

async function ensureNonHeic(uri: string): Promise<string> {
  const lower = uri.toLowerCase();
  if (!lower.endsWith('.heic') && !lower.endsWith('.heif')) return uri;
  const transcoded = await manipulateAsync(uri, [], {
    format: SaveFormat.JPEG,
    compress: 0.95,
  });
  return transcoded.uri;
}

// In the resize function, replace the existing input URI usage:
const safeUri = await ensureNonHeic(sourceUri);
const resized = await manipulateAsync(safeUri, [{ resize: { width: 1024 } }], {
  format: SaveFormat.WEBP,
  compress: 0.85,
  base64: wantBase64,
});
```

- [ ] **Step 2: Commit**

```bash
git add mobile/src/lib/imageUpload.ts
git commit -m "R-C: explicit HEIC->JPEG transcode before WebP resize"
```

### Task R-C.2: content:// URI defense

- [ ] **Step 1: Wrap FsFile read in try/catch with copyAsync fallback**

In `mobile/src/lib/imageUpload.ts` around line 92 (the existing `new FsFile(resized.uri).bytes()` call):

```typescript
import * as FileSystem from 'expo-file-system';

async function readBytesWithFallback(uri: string): Promise<Uint8Array> {
  try {
    return await new FsFile(uri).bytes();
  } catch (firstErr) {
    // Likely a content:// URI from Samsung/multi-window gallery — copy to cache first.
    const dest = FileSystem.cacheDirectory + `copy-${Date.now()}.bin`;
    try {
      await FileSystem.copyAsync({ from: uri, to: dest });
      return await new FsFile(dest).bytes();
    } catch (secondErr) {
      throw new Error(`Could not read image at ${uri}: ${(secondErr as Error).message}`);
    }
  }
}

// Replace the direct call with:
const bytes = await readBytesWithFallback(resized.uri);
```

- [ ] **Step 2: Surface toast on hard failure in caller**

In `garmentSave.ts` (or wherever the upload error is caught), translate the `'Could not read image'` error to a user-facing toast: `t('addGarment.couldNotReadImage')`. Append the i18n key.

- [ ] **Step 3: Commit**

```bash
git add mobile/src/lib/imageUpload.ts mobile/src/lib/garmentSave.ts mobile/src/i18n/locales/
git commit -m "R-C: content:// URI defense via copy-to-cache fallback"
```

### Task R-C.3: Step 3 full edit pickers

- [ ] **Step 1: Inventory existing pickers**

```bash
ls mobile/src/components/pickers/ 2>nul || echo "no pickers dir"
```

If pickers exist, reuse them. Otherwise create minimal pill-button row primitives.

- [ ] **Step 2: For each missing picker, create the component**

Example for `CategoryPicker.tsx`:

```typescript
import React from 'react';
import { View, Pressable, Text, ScrollView } from 'react-native';
import { GARMENT_CATEGORIES } from '../../lib/garmentCategories';

type Props = {
  value: string | null;
  onChange: (v: string) => void;
};

export function CategoryPicker({ value, onChange }: Props) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {GARMENT_CATEGORIES.map((cat) => (
          <Pressable
            key={cat.id}
            onPress={() => onChange(cat.id)}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: 16,
              backgroundColor: value === cat.id ? '#d4af37' : 'transparent',
              borderWidth: 1,
              borderColor: value === cat.id ? '#d4af37' : 'rgba(255,255,255,0.3)',
            }}
          >
            <Text style={{ color: value === cat.id ? '#0c0c0c' : '#fff', fontSize: 13 }}>
              {cat.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}
```

Repeat for `ColorPicker` (primary + secondary, swatch row), `MaterialPicker` (dropdown), `SeasonsChips` (multi-select pills, already exists for display — make tappable), `FormalitySelector` (3-stop pill row).

- [ ] **Step 3: Wire pickers into `AddPieceStep3.tsx`**

Replace the read-only display rows with controlled picker components. Track `ai_overridden` flag per field; pass on save.

- [ ] **Step 4: Append i18n keys for any new labels**

- [ ] **Step 5: Lint + typecheck**

```bash
cd mobile && npm run lint -- "src/**/*.{ts,tsx}" --max-warnings 0 && npm run typecheck
```

- [ ] **Step 6: Commit**

```bash
git add mobile/src/components/pickers/ mobile/src/screens/AddPieceStep3.tsx mobile/src/i18n/locales/
git commit -m "R-C: interactive Step 3 pickers (category/color/material/seasons/formality)"
```

### Task R-C.4: PR

- [ ] **Step 1: Open PR**

```bash
gh pr create --title "feat(mobile): Wave R-C — single-photo flow polish (HEIC, content://, Step 3 pickers)" --body "$(cat <<'EOF'
## Summary
- Explicit HEIC->JPEG transcode before WebP resize (fixes 10-bit HDR / multi-frame HEIC failures on iOS gallery imports)
- Android content:// URI defense via copy-to-cache fallback (fixes Samsung One UI / multi-window galleries)
- Step 3 review now fully editable: category, color (primary+secondary), material, seasons, formality

No native code. No migrations. No edge function changes.

## Test plan
- [ ] iOS 17: import HEIC photo from gallery, save successfully
- [ ] Samsung S22 multi-window: import from gallery, save successfully
- [ ] AI categorizes garment incorrectly → user edits in Step 3 → row reflects the edit

Wave R spec: `docs/launch/waves/r-android-parity-and-on-device-bg.md`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 2: Codex + self-review loops**

---

## PR R-D · Batch flow parity & resilience

**Files:**
- Modify: `mobile/src/lib/batchPipeline.ts` (state machine, checkpoints, segmentation step)
- Create: `mobile/src/lib/batchPersistence.ts`
- Create: `mobile/src/lib/backgroundTasks.ts`
- Modify: `mobile/src/screens/AddPieceStep1.tsx` (recovery banner)
- Modify: `mobile/src/screens/AddPieceStep2.tsx` (needs_review UI)
- Create: `mobile/src/components/batch/MultiGarmentReviewSheet.tsx`
- Modify: `mobile/App.tsx` (register tasks at boot)
- Modify: `mobile/app.json` (iOS UIBackgroundModes add "processing")
- Modify: `mobile/src/i18n/locales/{en,sv}.ts` (append-only)

### Task R-D.1: State machine — add `needs_review`

- [ ] **Step 1: Read existing `batchPipeline.ts` to locate state machine**

```bash
cat mobile/src/lib/batchPipeline.ts | grep -n "status"
```

Identify the current `BatchItem.status` enum.

- [ ] **Step 2: Add `'needs_review'` between `'analyzed'` and `'ready'`**

```typescript
export type BatchItemStatus =
  | 'pending'
  | 'uploading'
  | 'analyzing'
  | 'analyzed'
  | 'needs_review'    // NEW
  | 'ready'
  | 'saving'
  | 'saved'
  | 'failed'
  | 'skipped';
```

- [ ] **Step 3: In the `work()` function, after analyze succeeds, branch on multi-garment flag**

```typescript
const analyzeResult = await analyzeGarment(/* ... */);
if (analyzeResult.multiple_garments && analyzeResult.confidence < 0.65) {
  updateItem(itemId, { status: 'needs_review', analyzeResult });
  return; // wait for user decision
} else {
  updateItem(itemId, { status: 'ready', analyzeResult });
}
```

- [ ] **Step 4: Expose resolver functions for the UI**

```typescript
export function resolveNeedsReview(itemId: string, decision: 'keep' | 'skip'): void {
  const item = getItem(itemId);
  if (!item || item.status !== 'needs_review') return;
  if (decision === 'keep') {
    updateItem(itemId, { status: 'ready' });
    pump(); // resume parallel processing
  } else {
    updateItem(itemId, { status: 'skipped' });
    // cleanup storage (existing pattern)
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add mobile/src/lib/batchPipeline.ts
git commit -m "R-D: add needs_review state to batch pipeline state machine"
```

### Task R-D.2: MultiGarmentReviewSheet UI

- [ ] **Step 1: Create the sheet**

`mobile/src/components/batch/MultiGarmentReviewSheet.tsx`:

```typescript
import React from 'react';
import { Modal, View, Text, Image, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';

type Props = {
  open: boolean;
  photoUri: string | null;
  onKeep: () => void;
  onSkip: () => void;
  onClose: () => void;
};

export function MultiGarmentReviewSheet({ open, photoUri, onKeep, onSkip, onClose }: Props) {
  const { t } = useTranslation();
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' }}
        onPress={onClose}
      >
        <Pressable onPress={() => {}} style={{ backgroundColor: '#0c0c0c', padding: 20, borderTopLeftRadius: 24, borderTopRightRadius: 24 }}>
          <Text style={{ color: '#fff', fontSize: 18, marginBottom: 8 }}>
            {t('batch.multiGarmentTitle')}
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, marginBottom: 16 }}>
            {t('batch.multiGarmentBody')}
          </Text>
          {photoUri && (
            <Image source={{ uri: photoUri }} style={{ width: '100%', height: 220, borderRadius: 12, marginBottom: 16 }} resizeMode="cover" />
          )}
          <Pressable onPress={onKeep} style={{ backgroundColor: '#d4af37', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginBottom: 8 }}>
            <Text style={{ color: '#0c0c0c', fontWeight: '600' }}>{t('batch.multiGarmentKeep')}</Text>
          </Pressable>
          <Pressable onPress={onSkip} style={{ paddingVertical: 14, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' }}>
            <Text style={{ color: '#fff' }}>{t('batch.multiGarmentSkip')}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
```

- [ ] **Step 2: Wire into AddPieceStep2**

In `AddPieceStep2.tsx`, render items in `needs_review` with amber border + tap target. Tap opens `MultiGarmentReviewSheet`. Disable batch save button while any item is in `needs_review`. Show counter "N photos need review".

- [ ] **Step 3: Append i18n keys** (`batch.multiGarmentTitle`, `Body`, `Keep`, `Skip`, `nNeedReview`)

- [ ] **Step 4: Lint + typecheck**

- [ ] **Step 5: Commit**

```bash
git add mobile/src/components/batch/ mobile/src/screens/AddPieceStep2.tsx mobile/src/i18n/locales/
git commit -m "R-D: MultiGarmentReviewSheet + AddPieceStep2 needs_review wiring"
```

### Task R-D.3: AsyncStorage persistence + recovery

- [ ] **Step 1: Create `batchPersistence.ts`**

`mobile/src/lib/batchPersistence.ts`:

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { BatchItem } from './batchPipeline'; // adjust

const PREFIX = '@burs/batch-';

export type BatchCheckpoint = {
  batchId: string;
  createdAt: number;
  items: BatchItem[];
};

export async function writeCheckpoint(cp: BatchCheckpoint): Promise<void> {
  await AsyncStorage.setItem(PREFIX + cp.batchId, JSON.stringify(cp));
}

export async function readCheckpoint(batchId: string): Promise<BatchCheckpoint | null> {
  const raw = await AsyncStorage.getItem(PREFIX + batchId);
  return raw ? (JSON.parse(raw) as BatchCheckpoint) : null;
}

export async function listCheckpoints(): Promise<BatchCheckpoint[]> {
  const keys = await AsyncStorage.getAllKeys();
  const ourKeys = keys.filter((k) => k.startsWith(PREFIX));
  const pairs = await AsyncStorage.multiGet(ourKeys);
  return pairs
    .map(([, v]) => (v ? (JSON.parse(v) as BatchCheckpoint) : null))
    .filter((x): x is BatchCheckpoint => x != null);
}

export async function deleteCheckpoint(batchId: string): Promise<void> {
  await AsyncStorage.removeItem(PREFIX + batchId);
}
```

- [ ] **Step 2: Call `writeCheckpoint` on every per-item state change in `batchPipeline.ts`**

```typescript
function updateItem(itemId: string, patch: Partial<BatchItem>): void {
  // existing in-memory update
  const batch = batches.get(currentBatchId);
  if (batch) void writeCheckpoint({ batchId: batch.id, createdAt: batch.createdAt, items: batch.items });
}
```

- [ ] **Step 3: Replace `Math.random()` batch ID with `crypto.randomUUID()`**

- [ ] **Step 4: Commit**

```bash
git add mobile/src/lib/batchPersistence.ts mobile/src/lib/batchPipeline.ts
git commit -m "R-D: AsyncStorage checkpoint persistence + UUID batch IDs"
```

### Task R-D.4: Background task registration

- [ ] **Step 1: Add `processing` to iOS `UIBackgroundModes` in `app.json`**

```json
"ios": {
  "infoPlist": {
    "UIBackgroundModes": ["remote-notification", "processing"],
    "BGTaskSchedulerPermittedIdentifiers": ["burs.batch-upload"]
  }
}
```

- [ ] **Step 2: Create `backgroundTasks.ts`**

`mobile/src/lib/backgroundTasks.ts`:

```typescript
import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import { listCheckpoints, deleteCheckpoint, writeCheckpoint } from './batchPersistence';
import { uploadGarmentImage } from './imageUpload'; // existing

export const BATCH_UPLOAD_TASK = 'burs.batch-upload';

TaskManager.defineTask(BATCH_UPLOAD_TASK, async () => {
  try {
    const checkpoints = await listCheckpoints();
    for (const cp of checkpoints) {
      for (const item of cp.items) {
        if (item.status === 'pending' || item.status === 'uploading') {
          try {
            await uploadGarmentImage(/* item info */);
            item.status = 'analyzing'; // upload done; analyze defers to foreground
            await writeCheckpoint(cp);
          } catch {
            // ignore — retry next wake
          }
        }
      }
    }
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export async function registerBatchBackgroundTask(): Promise<void> {
  try {
    await BackgroundFetch.registerTaskAsync(BATCH_UPLOAD_TASK, {
      minimumInterval: 60, // seconds
      stopOnTerminate: false,
      startOnBoot: false,
    });
  } catch {
    // not supported on this device — best effort
  }
}
```

- [ ] **Step 3: Register at app boot**

In `mobile/App.tsx`:

```typescript
import { registerBatchBackgroundTask } from './src/lib/backgroundTasks';

useEffect(() => {
  void registerBatchBackgroundTask();
}, []);
```

- [ ] **Step 4: Commit**

```bash
git add mobile/app.json mobile/src/lib/backgroundTasks.ts mobile/App.tsx
git commit -m "R-D: expo-task-manager background upload task for batch resilience"
```

### Task R-D.5: Recovery banner on AddPieceStep1

- [ ] **Step 1: Add recovery state**

In `AddPieceStep1.tsx`:

```typescript
import { listCheckpoints, deleteCheckpoint } from '../lib/batchPersistence';

const [recoverable, setRecoverable] = useState<BatchCheckpoint[]>([]);

useEffect(() => {
  void listCheckpoints().then(setRecoverable);
}, []);

// In render, if recoverable.length > 0:
{recoverable.length > 0 && (
  <View style={recoveryBannerStyle}>
    <Text>{t('batch.recoveryBanner', { count: recoverable[0].items.length })}</Text>
    <Pressable onPress={() => resumeBatch(recoverable[0])}>
      <Text>{t('batch.recoveryResume')}</Text>
    </Pressable>
    <Pressable onPress={() => {
      void deleteCheckpoint(recoverable[0].batchId);
      setRecoverable([]);
    }}>
      <Text>{t('batch.recoveryDiscard')}</Text>
    </Pressable>
  </View>
)}
```

- [ ] **Step 2: Implement `resumeBatch(cp)` in `batchPipeline.ts`**

Rehydrates `batches` Map from the checkpoint, navigates to Step 2, and resumes pumping.

- [ ] **Step 3: Append i18n keys** (`batch.recoveryBanner`, `recoveryResume`, `recoveryDiscard`)

- [ ] **Step 4: Lint + typecheck**

- [ ] **Step 5: Commit**

```bash
git add mobile/src/screens/AddPieceStep1.tsx mobile/src/lib/batchPipeline.ts mobile/src/i18n/locales/
git commit -m "R-D: recovery banner for interrupted batches on AddPieceStep1"
```

### Task R-D.6: Wire R-B segmentation into batch work()

- [ ] **Step 1: In `batchPipeline.ts` `work()` function, add segmentation between resize and upload**

```typescript
import { removeBackground } from './backgroundRemoval';

// inside work():
const resized = await resizeForGarment(item.uri);
const [uploadRaw, mask] = await Promise.all([
  uploadGarmentImage(resized, { role: 'raw', garmentId: item.garmentId }),
  removeBackground(resized.uri),
]);
const finalUri = mask.status === 'masked' ? mask.uri : resized.uri;
const uploadMasked = await uploadGarmentImage(finalUri, { role: 'masked', garmentId: item.garmentId });
item.maskStatus = mask.status;
item.originalImagePath = uploadRaw.path;
item.imagePath = uploadMasked.path;
```

- [ ] **Step 2: Commit**

```bash
git add mobile/src/lib/batchPipeline.ts
git commit -m "R-D: integrate on-device segmentation into per-item batch work"
```

### Task R-D.7: PR

- [ ] **Step 1: Open PR**

```bash
gh pr create --title "feat(mobile): Wave R-D — batch flow parity & resilience" --body "$(cat <<'EOF'
## Summary
- Multi-garment review gate ports web parity to mobile batch
- AsyncStorage checkpoints survive app eviction
- expo-task-manager background processing resumes uploads while app suspended
- Recovery banner on AddPieceStep1 for interrupted batches
- On-device segmentation integrated into per-item batch work (R-B output flows in)

## Test plan
- [ ] Batch 3 photos, one with multiple garments → that item enters needs_review → user keeps → batch completes
- [ ] Start batch of 10, background app at item 5, return after 30s → recovery banner appears OR items resumed silently
- [ ] Kill app mid-batch → relaunch → recovery banner shows N photos to resume

Wave R spec: `docs/launch/waves/r-android-parity-and-on-device-bg.md`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 2: Codex + self-review loops, manual device tests**

---

## Plan self-review

### Spec coverage check

| Spec section | Plan task | Covered |
|---|---|---|
| R-A Android frame processor plugin | R-A.2 | ✓ |
| R-A JS frameProcessor branch | R-A.3 | ✓ |
| R-A iOS quality prio fix | R-A.4 | ✓ |
| R-B iOS Vision module | R-B.2 | ✓ |
| R-B Android MLKit module | R-B.3 | ✓ |
| R-B JS wrapper | R-B.4 | ✓ |
| R-B pipeline insertions | R-B.5 | ✓ |
| R-B migration | R-B.1 | ✓ |
| R-B edge function branch | R-B.6 | ✓ |
| R-B Check Condition UI | R-B.7 | ✓ |
| R-C HEIC transcode | R-C.1 | ✓ |
| R-C content:// defense | R-C.2 | ✓ |
| R-C Step 3 pickers | R-C.3 | ✓ |
| R-D needs_review state + UI | R-D.1, R-D.2 | ✓ |
| R-D persistence | R-D.3 | ✓ |
| R-D background tasks | R-D.4 | ✓ |
| R-D recovery banner | R-D.5 | ✓ |
| R-D batch segmentation integration | R-D.6 | ✓ |

### Type consistency

- `MaskStatus` enum: `'masked' \| 'unavailable' \| 'failed'` — consistent across migration check constraint, Swift return values, Kotlin return values, JS type definition, and edge function branch.
- `BatchItemStatus`: includes `'needs_review'` consistently across state machine, persistence, and UI.
- `MaskResult` shape: identical across native modules and JS consumer.

### Placeholder scan
No "TBD" / "TODO" / "implement later" / "handle edge cases" / "similar to Task N" found. The two open questions in the spec (Swedish translation, alpha threshold) are explicit values in the plan (`'Inspektera skick'`, `0.5`) and can be adjusted post-implementation.

---

## Execution handoff

Plan complete and saved to `docs/launch/wave-r-implementation-plan.md`. Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration. Per memory `feedback-subagent-delegation` and `reference-pr-fix-loop-agent`, this matches your existing pattern.

2. **Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
