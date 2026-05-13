# Wave R-A.1 — Pre-flight inventory findings

> Produced by R-A.1 subagent 2026-05-12. Authoritative for R-A.2–R-A.7 execution.
> If anything in `docs/launch/wave-r-implementation-plan.md` conflicts with this file, **this file wins** until the plan is rebased.

## Headline corrections to plan assumptions

| Plan said | Reality on disk |
|---|---|
| Codegen is `nitro-codegen` OR `nitrogen` (some binary in `react-native-nitro-modules`) | `react-native-nitro-modules@0.35.6` ships NO codegen binary. Codegen is a **separate npm package `nitrogen@0.35.6`** that must be installed as a devDep. Invoke via `npx nitrogen`. |
| Use `useFrameProcessor` from `react-native-vision-camera` | **`useFrameProcessor` does not exist in vision-camera v5.** The v5 equivalent is **`useFrameOutput`** (`react-native-vision-camera/lib/hooks/useFrameOutput.d.ts`). |
| `react-native-worklets@0.7.2` (per nitro's devDep) | `react-native-worklets@0.5.1` is installed; pinned by Expo SDK 54 / Reanimated 4. Do not bump. |
| (Implicit) Worklets companion for vision-camera is already there | **`react-native-vision-camera-worklets` is NOT installed.** Required by `useFrameOutput`. Must be added in R-A.2 or R-A.5. |
| Frame.orientation is a Java enum (`PORTRAIT`, `LANDSCAPE_LEFT`, …) | v5 `Frame.orientation` is a **string enum**: `'up' \| 'right' \| 'left' \| 'down'`. Kotlin `when`-branch must match strings, not enum constants. |

## 1 · Nitro tooling

- `react-native-nitro-modules@0.35.6` installed; ships an Expo config plugin at `node_modules/react-native-nitro-modules/app.plugin.js` (wire into `mobile/app.json` `expo.plugins` IF not already there — verify first; do not duplicate).
- Codegen is a separate package: `nitrogen@0.35.6`. Install via:
  ```bash
  cd mobile && npm i -D nitrogen@0.35.6 --no-audit --no-fund
  ```
- Then invoke:
  ```bash
  cd mobile && npx nitrogen
  ```
- Nitrogen reads `mobile/nitro.json` + any `*.nitro.ts` under `jsSrcsDir`. Emits Kotlin/Swift glue under `mobile/nitrogen/generated/{android,ios,shared}/`. **Generated tree must be committed** (vision-camera commits theirs as the precedent).
- Reference layouts:
  - `node_modules/react-native-vision-camera/nitro.json` — `nitro.json` schema example.
  - `node_modules/react-native-nitro-image/` — full Nitro-module layout reference (specs + generated tree + Kotlin/Swift impls).

## 2 · vision-camera v5 Frame + worklets API

- `react-native-vision-camera@5.0.9` installed (matches plan assumption).
- `.d.ts` layout is **flat** under `node_modules/react-native-vision-camera/lib/` (not under `lib/typescript/`). The plan's `ls .../lib/typescript/` command will fail — use `lib/`.

### `useFrameProcessor` is gone. Use `useFrameOutput`.

```ts
import { useFrameOutput } from 'react-native-vision-camera'

const frameOutput = useFrameOutput({
  pixelFormat: 'yuv',
  onFrame(frame) {
    'worklet'
    // frame is a HybridObject<{ ios:'swift'; android:'kotlin' }>
    // Pass directly to a Nitro module method.
    frame.dispose()
  },
})
```

`useFrameOutput` returns a `CameraFrameOutput` (Nitro hybrid). Attach to `<Camera outputs={[…, frameOutput]} />`.

### `useFrameOutput` requires `react-native-vision-camera-worklets`

From the `useFrameOutput` docstring (`lib/hooks/useFrameOutput.d.ts:52-54`):
> `useFrameOutput` requires `react-native-vision-camera-worklets` (and `react-native-worklets`) to be installed.

Not currently installed. Install in R-A.2 (recommended — keeps R-A.5 focused) or R-A.5:
```bash
cd mobile && npm i react-native-vision-camera-worklets@^5
```

### Frame is Nitro-bridgeable

`node_modules/react-native-vision-camera/lib/specs/instances/Frame.nitro.d.ts:91`:

```ts
export interface Frame extends HybridObject<{ ios: 'swift'; android: 'kotlin' }> {
  readonly timestamp: number;
  readonly isValid: boolean;
  readonly width: number;
  readonly height: number;
  readonly bytesPerRow: number;
  readonly pixelFormat: PixelFormat;
  readonly orientation: CameraOrientation;  // 'up' | 'right' | 'left' | 'down'
  readonly isMirrored: boolean;
  readonly isPlanar: boolean;
  getPlanes(): FramePlane[];
  getPixelBuffer(): ArrayBuffer;
  getNativeBuffer(): NativeBuffer;
  readonly cameraIntrinsicMatrix?: number[];  // iOS-only
  convertCameraPointToFramePoint(cameraPoint: Point): Point;
  convertFramePointToCameraPoint(framePoint: Point): Point;
}
```

A Nitro module's Kotlin method can accept `Frame` directly as a parameter — no serialization shim. Frame docstring explicitly suggests passing `orientation` to MLKit-style libs as the rotation hint.

### `useObjectOutput` (current iOS-only path)

`lib/hooks/useObjectOutput.d.ts:30`: `useObjectOutput({ types, onObjectsScanned }) => CameraObjectOutput`. The `CameraObjectOutput` + `ScannedObject` types are documented `@platform iOS` only. Confirms Wave R-A premise — there is no `CameraObjectOutput` for Android.

## 3 · Worklets

- `react-native-worklets@0.5.1` installed.
- Reanimated 4 re-exports cover the current LiveScan use: `useSharedValue`, `useDerivedValue`, `useAnimatedStyle`, `runOnJS`, `withTiming`, `cancelAnimation`, `Easing`.
- Raw `react-native-worklets` exposes `createSerializable`, `runOnJS`, `runOnUI`, `runOnRuntime`, `createWorkletRuntime`, `Synchronizable`. `useFrameOutput`'s worklet runtime is built on `runOnRuntime` under the hood.
- The Babel plugin (`react-native-worklets/plugin`) must be registered in `mobile/babel.config.js`. **Verify in R-A.5** — Reanimated 4 typically wires this automatically, but confirm.

## 4 · Current LiveScan structure (R-A.5 branch source)

### Shared values (created in `LiveScanScreen.tsx:140-145`)

```ts
const score = useSharedValue(0);                            // 0..1
const quality = useSharedValue<Quality>('searching');       // enum below
const hasDetectorPlugin = useSharedValue(true);             // <-- THE Android gate
const lockProgress = useSharedValue(0);
const flashOpacity = useSharedValue(0);
const shutterOpacity = useSharedValue(0);
```

`Quality` enum (`mobile/src/screens/LiveScan/types.ts:10-16`):
`'searching' | 'low_light' | 'too_close' | 'too_far' | 'not_centered' | 'ready'`.

The first three (`score`, `quality`, `hasDetectorPlugin`) form `FrameProcessorSharedValues` (`mobile/src/screens/LiveScan/frameProcessor.ts:50-54`). **R-A.5's Android branch must write to these same three names** (not the `detectionScore` / `detectionBox` that some plan sections mention).

### `DetectedObject` shape (mobile/src/screens/LiveScan/types.ts:18-26)

```ts
export interface DetectedObject {
  x: number;       // normalized 0..1 top-left
  y: number;
  width: number;
  height: number;
  confidence: number;
}
```

`scoreFrame(boxes: DetectedObject[], metrics: FrameMetrics): FrameScore` — iOS path defaults `exposure: 0.5, sharpness: 0.7` (`frameProcessor.ts:47-48`).

### Insertion point — `frameProcessor.ts:181-189`

```ts
let objectOutput: CameraObjectOutput | null;
try {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  objectOutput = useObjectOutput({ types: ['salient-object'], onObjectsScanned });
} catch {
  objectOutput = null;
}
```

Followed by `useEffect` at lines 191-199 that flips `shared.hasDetectorPlugin.value = false` when `objectOutput == null`. R-A.5 should:
1. Keep iOS `useObjectOutput` unchanged.
2. Add a `Platform.OS === 'android'` branch that uses `useFrameOutput({ pixelFormat: 'yuv', onFrame(frame) { 'worklet'; … } })` returning a `CameraFrameOutput`.
3. Inside `onFrame`: call the Nitro detector synchronously, run `scoreFrame` (must be `'worklet'`-callable — verify), write the three shared values directly from the worklet runtime.
4. Make `useLiveScanFrameProcessor` return a union `{ output: CameraOutput | null; markStaleIfNoRecentScan }` so `LiveScanScreen.tsx` doesn't need a platform check.

### Camera outputs wiring — `LiveScanScreen.tsx:166-169`

```ts
const outputs = useMemo(
  () => (objectOutput ? [photoOutput, objectOutput] : [photoOutput]),
  [photoOutput, objectOutput],
);
```

On Android this becomes `[photoOutput, frameOutput]`. Screen's `<Camera outputs={outputs} … />` (line 418) stays unchanged.

### Stability lock — `stabilityLock.ts`

Consumes raw `number` scores via `update(score)` on the JS thread (called from `tickLock` at `LiveScanScreen.tsx:273`). No Android-specific changes needed here.

## 5 · Per-task corrections (apply when each task is executed)

### R-A.2 — Scaffold config plugin

- Check `mobile/app.json` first to see whether `react-native-nitro-modules` is already wired in `expo.plugins`. If not, add it. **Do not duplicate.**
- Recommended: also install `react-native-vision-camera-worklets` in this task so R-A.5 isn't blocked.
- The `mobile/plugins/with-garment-detector/index.js` plugin's role is narrow: (a) add MLKit gradle dep, (b) register `GarmentDetectorPackage` in `MainApplication.kt`, (c) copy Kotlin source files. **Nitro autolinking is handled separately** by `react-native-nitro-modules`'s plugin via the codegen's `react-native.config.js`.

### R-A.3 — Nitro TS spec + codegen

Replace the plan's "run `nitro-codegen`" step with:

```bash
cd mobile && npm i -D nitrogen@0.35.6 --no-audit --no-fund
cd mobile && npx nitrogen
```

`mobile/nitro.json` minimum shape (use `node_modules/react-native-vision-camera/nitro.json` as the canonical reference):

```json
{
  "$schema": "https://nitro.margelo.com/nitro.schema.json",
  "cxxNamespace": ["burs"],
  "android": {
    "androidNamespace": ["burs"],
    "androidCxxLibName": "BursGarmentDetector"
  },
  "autolinking": {
    "GarmentDetector": {
      "android": {
        "language": "kotlin",
        "implementationClassName": "HybridGarmentDetector"
      }
    }
  }
}
```

`mobile/specs/GarmentDetector.nitro.ts`:

```ts
import type { HybridObject } from 'react-native-nitro-modules'
import type { Frame } from 'react-native-vision-camera'

export interface DetectedBox {
  x: number; y: number; width: number; height: number; confidence: number;
}

export interface GarmentDetector extends HybridObject<{ android: 'kotlin' }> {
  detect(frame: Frame): DetectedBox[]
}
```

The generated tree (`mobile/nitrogen/generated/`) must be committed.

### R-A.4 — Kotlin Nitro impl

- File goes under `mobile/plugins/with-garment-detector/android/HybridGarmentDetector.kt`. Spec class is generated by nitrogen — extend `HybridGarmentDetectorSpec`.
- MLKit Object Detection accepts `InputImage`. Convert from `Frame`:
  - With `pixelFormat: 'yuv'` set in `useFrameOutput`, read `frame.getPlanes()` and feed planes into `InputImage.fromByteArray(...)` (or convert to Camera2 `Image` and use `InputImage.fromMediaImage`).
  - **Pass `frame.orientation` (a `String`) as the rotation hint** to MLKit's `InputImage` builder. The mapping is:
    ```kotlin
    val rotationDegrees = when (frame.orientation) {
      "up" -> 0
      "right" -> 90
      "down" -> 180
      "left" -> 270
      else -> 0
    }
    ```
  - **Do not** import `com.mrousavy.camera.core.types.Orientation` — that v4 type is irrelevant in v5.
- MLKit `process()` returns `Task<List<DetectedObject>>`. The frame-processor thread is a background NativeThread, so `Tasks.await(detector.process(image))` is fine (no main-thread blocking).
- MLKit gradle dep (added by the config plugin): `com.google.mlkit:object-detection:17.0.1` (verify latest stable against Gradle 8.x / AGP from Expo SDK 54 before pinning).
- Return shape: `List<DetectedBox>` with normalized coords (divide pixel coords by frame width/height).

### R-A.5 — JS worklet wire-up

- **Use `useFrameOutput`, not `useFrameProcessor`.**
- Shared values to write: `shared.score.value`, `shared.quality.value`, `shared.hasDetectorPlugin.value`. The Android branch sets `hasDetectorPlugin.value = true` at hook init.
- `scoreFrame` must be `'worklet'`-callable. Read `mobile/src/screens/LiveScan/scoring.ts` — if it's already pure with no React/platform imports, it should compile clean under the worklets Babel plugin; add a top-of-file `'worklet'` directive if needed.
- Sketch:
  ```ts
  import { useFrameOutput } from 'react-native-vision-camera'
  import { NitroModules } from 'react-native-nitro-modules'
  import type { GarmentDetector } from '../../specs/GarmentDetector.nitro'

  const detector = NitroModules.createHybridObject<GarmentDetector>('GarmentDetector')

  function useAndroidFrameOutput(shared: FrameProcessorSharedValues) {
    shared.hasDetectorPlugin.value = true
    return useFrameOutput({
      pixelFormat: 'yuv',
      onFrame(frame) {
        'worklet'
        const boxes = detector.detect(frame)
        const { score, quality } = scoreFrame(boxes, { exposure: 0.5, sharpness: 0.7 })
        shared.score.value = score
        shared.quality.value = quality
        frame.dispose()
      },
    })
  }
  ```
- Make `useLiveScanFrameProcessor` return `{ output: CameraOutput | null; markStaleIfNoRecentScan }` so `LiveScanScreen.tsx`'s `outputs` `useMemo` doesn't need a platform check.

## 6 · Confidence flags (open questions for downstream subagents)

1. **MLKit Object Detection version pinning** — confirm latest stable that builds against the Gradle/AGP shipped by Expo SDK 54. The plan's `17.0.1` is plausible; verify before R-A.4 commits the gradle dep.
2. **YUV-plane → MLKit `InputImage` recipe** — `InputImage.fromByteArray` vs constructing a `MediaImage` from planes. Reference repo: `mrousavy/react-native-vision-camera-v3-image-labeling` or `react-native-vision-camera`-MLKit examples on GitHub.
3. **Sync calls from a `'worklet'` onFrame to a Nitro hybrid method** — Frame's docstring + `Sync<>` type wrapper on `CameraFrameOutput.setOnFrameCallback` suggest this works without ceremony. Confirm from `mrousavy.com/docs/nitro/the-c++-side/threading` before R-A.5 commits.
4. **`app.json` plugins entry** — verify whether `react-native-nitro-modules`'s plugin is already wired (R-A.2 task).
5. **Babel plugin** — verify `react-native-worklets/plugin` is in `mobile/babel.config.js` (R-A.5 task).

## 7 · Key file paths for downstream subagents

- `mobile/src/screens/LiveScan/frameProcessor.ts:181-199` — insertion point for Android `useFrameOutput`
- `mobile/src/screens/LiveScanScreen.tsx:140-145` — shared values; `:166-169` — outputs wiring
- `mobile/src/screens/LiveScan/types.ts` — `DetectedObject`, `FrameMetrics`, `Quality`
- `mobile/src/screens/LiveScan/scoring.ts` — verify worklet-safety
- `mobile/node_modules/react-native-vision-camera/nitro.json` — `nitro.json` schema reference
- `mobile/node_modules/react-native-vision-camera/lib/hooks/useFrameOutput.d.ts` — Android path API
- `mobile/node_modules/react-native-vision-camera/lib/specs/instances/Frame.nitro.d.ts` — Frame HybridObject signature
- `mobile/node_modules/react-native-nitro-image/` — reference Nitro-module layout
