# R — On-device background removal + add-garment flow polish

> **Revision 2026-05-12 (post-investigation):** Android LiveScan auto-detect parity is **deferred** from this wave. The original R-A scope was based on the assumption that `react-native-vision-camera` v5 still exposes the v4 `FrameProcessorPlugin` registry — it does not. v5 ships Nitro-based `CameraObjectOutput`, iOS-only; the comment at `mobile/src/screens/LiveScan/frameProcessor.ts:13-14` confirms Android cannot use it yet. Realistic alternatives (parallel-snapshot loop, vision-camera fork, custom Nitro module) were evaluated and rejected as out of proportion to the wave's value. **Android LiveScan stays manual-shutter-only until upstream v5 ships Android `CameraObjectOutput`** — at that point we open a follow-up wave. R-A is reduced to a small iOS quality-prio fix. Additionally, all native R-B code now ships via an **Expo config plugin** (`mobile/plugins/with-background-removal/`) because `mobile/android/` and `mobile/ios/` are gitignored under Expo managed workflow — direct commits to those directories would be blown away on the next `expo prebuild`.

| Field | Value |
|---|---|
| Goal | Introduce on-device garment segmentation as a free "Save Original" output AND as preprocessed input to Gemini Studio renders; close residual single-photo and batch add-garment flow gaps; small iOS LiveScan quality fix. |
| Status | **TODO** — spec revised 2026-05-12 |
| Branch base | `main` |
| PR count | 4 (R-A, R-B, R-C, R-D) |
| Migrations | One — `garments.mask_status` (R-B only) |
| Edge function changes | One — `process_render_jobs` prompt branch (R-B only) |
| Native modules | Two new (iOS Vision wrapper + Android MLKit Subject Seg wrapper) — both shipped via **Expo config plugin** (R-B) |
| Bundle impact | Android +~10 MB (MLKit Subject Seg module). iOS no change. |
| Complexity | XS (R-A), L (R-B), M (R-C, R-D) |
| Authority | Standing CEO post-launch theme-PR authority |

## Background

Post-launch audit on 2026-05-12 surfaced two categories of mobile gaps:

1. **Android LiveScan is structurally degraded.** PR #837 shipped LiveScan v2 ("rapid-fire auto-detect / auto-snap") but the underlying `react-native-vision-camera@5.0.9` ships iOS-only object detection via Apple Vision. The Android code path catches the unavailability (`mobile/src/screens/LiveScan/frameProcessor.ts:13-14, 26-31, 181-189`), pins score to zero, and falls back to manual-shutter-only. The headline auto-snap experience is iOS-only.
2. **Add-garment pipeline misses two product-quality wins.** (a) On-device subject segmentation is now free on iOS 17+ and Android via MLKit, but the app doesn't use it — Gemini does the full segmentation server-side every time, even on clean studio-shot input. (b) Several smaller flow gaps remain: HEIC handling on iOS gallery, Android `content://` URI fragility, Step 3 read-only review, batch multi-garment review gate, batch backgrounding loss.

This wave brings Android to parity, introduces on-device segmentation as a product feature, and closes the residual gaps. Web is not in scope (web is being deleted post-launch per `CLAUDE.md`).

---

## Data model

Schema already has three image columns. Wave R repurposes semantics; one new column.

| Column | Wave R meaning |
|---|---|
| `original_image_path` | Raw user capture (unaltered). Sole consumer: Check Condition viewer on garment card. |
| `image_path` | On-device-segmented WebP (or raw fallback if segmentation unavailable). Consumers: wardrobe display while render pending, Gemini Studio render input, "Save Original" final artifact. |
| `rendered_image_path` | Gemini Studio render (unchanged). |
| `mask_status` (NEW) | Enum: `'masked' \| 'unavailable' \| 'failed' \| NULL`. Drives Gemini prompt branch in `process_render_jobs`. |
| `secondary_image_path` | Unchanged (Wave 4.5 re-render input). |

**Wardrobe display priority unchanged:** `rendered_image_path ?? image_path ?? original_image_path`.

**Storage path change:** new garments use per-garment folders so all three images live together and cleanup is straightforward.
- Raw: `garments/{userId}/{garmentId}/raw.jpg` — JPEG q=75, EXIF stripped, 1280px longest side (~100 KB target)
- Masked: `garments/{userId}/{garmentId}/masked.webp` — WebP with alpha q=80, 1024px (~80 KB)
- Studio: `garments/{userId}/{garmentId}/studio.webp` (unchanged)

`garmentId` is a client-side UUIDv4 generated at capture time, used as the storage folder name and as the row PK at save. Allows uploading both raw and masked before the row exists. Orphan cleanup is a follow-up concern, not in this wave.

Historical garments (with flat-path storage paths) are not migrated. Wardrobe display reads whatever path the row carries.

---

## R-A · iOS LiveScan quality prioritization fix (XS)

### Scope (revised 2026-05-12)
Android LiveScan auto-detect is deferred (see top-of-document revision note). R-A is now just the iOS quality-prio fix.

### Fix
`mobile/src/screens/LiveScanScreen.tsx:~161` currently falls back to `'balanced'` whenever `device.supportsSpeedQualityPrioritization` is missing. Many recent Android devices (Pixel 6, Samsung S22) and some iPhones expose 30 fps formats but not the support flag. Replace the blanket fallback with a `device.formats` capability check — pick `'speed'` when the active format supports 30 fps, else `'balanced'`.

### Files touched
- `mobile/src/screens/LiveScanScreen.tsx` (one logic change, ~5 lines)
- `CLAUDE.md` (current wave pointer)
- `docs/launch/overview.md` (current wave pointer)

### Acceptance
- Devices that previously got `'balanced'` due to missing `supportsSpeedQualityPrioritization` but offer 30 fps formats now pick `'speed'`
- iOS LiveScan behavior unchanged vs PR #837 baseline (regression-checked)
- No native code touched, no EAS build required for this PR's CI

---

## R-B · On-device background removal + Gemini integration

### Capture pipeline
Every capture path (LiveScan, Camera, Gallery, Batch) runs on-device segmentation immediately after resize. The masked output is the canonical `image_path` for both "Save Original" and "Save Studio."

```
capture
  → resize (existing imageUpload pipeline)
  → segment in parallel with raw upload
  → upload masked (or raw fallback if segmentation unavailable)
  → analyze_garment (consumes masked)
  → user reaches Step 3 → choice sheet
    → "Save Original"  : commit image_path = masked, done
    → "Save Studio"    : commit image_path = masked, enqueue_render_job → Gemini reads image_path (masked)
```

### Native modules

| Platform | API | Min OS | Speed | On unavailable |
|---|---|---|---|---|
| iOS 17+ | `VNGenerateForegroundInstanceMaskRequest` | iOS 17.0 | 100–200 ms | Returns `status='unavailable'`; `image_path = raw` |
| iOS 15–16 | No native subject segmentation available | — | — | Returns `status='unavailable'`; `image_path = raw` |
| Android 7+ | MLKit Subject Segmentation `16.0.0-beta1` | API 24 | 200–400 ms | Returns `status='failed'` on error; `image_path = raw` |

### Native API surface (both platforms identical)

```ts
type MaskResult = {
  uri: string;              // file:// path to masked WebP, or original on fallback
  status: 'masked' | 'unavailable' | 'failed';
  confidence: number;       // mean alpha 0..1
  durationMs: number;
};

NativeModules.BackgroundRemoval.maskImage(uri: string): Promise<MaskResult>
NativeModules.BackgroundRemoval.prepare(): Promise<void>  // warm-up at app boot
```

**Quality gate:** if `confidence < 0.5` OR any error thrown → return original URI, `status='failed'`. JS always gets a usable URI.

### JS wrapper (`mobile/src/lib/backgroundRemoval.ts`, ~80 LOC)
- `prepare()` fires at app startup; on Android, triggers Play Services module download silently
- `removeBackground(uri)` deduplicates rapid-fire requests by URI
- Save-time blocking timeout: if user reaches "Save" before the mask resolves, wait at most 800 ms then fall through to raw-as-`image_path`

### Pipeline integration points
1. `mobile/src/screens/LiveScan/pipeline.ts` — after resize, in parallel with raw upload
2. `mobile/src/screens/AddPieceStep1.tsx` — camera + gallery image handlers

Batch integration is in R-D (R-D imports the `removeBackground` module landed by R-B).

### Edge function change
`supabase/functions/process_render_jobs/index.ts` reads `garments.mask_status` and branches the Gemini system prompt:
- `'masked'` → "Input image has been pre-segmented onto a transparent background. Compose a clean studio render focusing on lighting, garment shape preservation, and product photography. Do not re-remove background."
- otherwise → current prompt (full removal + composition)

Gemini receives `image_path` in both branches — only the instruction differs.

### Migration
`supabase/migrations/{ts}_add_mask_status.sql`:

```sql
ALTER TABLE garments
  ADD COLUMN IF NOT EXISTS mask_status text
    CHECK (mask_status IN ('masked','unavailable','failed') OR mask_status IS NULL);
```

Idempotent. No backfill — NULL = "legacy pre-feature row," handled identically to `'unavailable'` by the edge function branch.

### "Check Condition" UI
New garment-detail-card button (icon + label). Tapping opens a full-screen modal viewing `original_image_path` (signed URL). Pinch-to-zoom enabled.

- Component: `mobile/src/components/garment/ConditionCheckSheet.tsx` (~120 LOC)
- Button placement: garment detail screen action row, after existing "Wear" / "Save outfit" actions
- i18n: en `"Check condition"`, sv `"Inspektera skick"` (final SV string to be confirmed by user before merge)

### Native source delivery: Expo config plugin
**Revision 2026-05-12:** `mobile/android/` and `mobile/ios/` are gitignored under Expo managed workflow — direct commits get blown away on `expo prebuild`. All native source ships via a config plugin under `mobile/plugins/with-background-removal/` that copies sources + injects Gradle deps + adds Swift module entries during prebuild. The plugin is registered in `mobile/app.json`'s `expo.plugins` array.

### Files touched
- `mobile/plugins/with-background-removal/index.js` (new — Expo config plugin entry point)
- `mobile/plugins/with-background-removal/ios/BackgroundRemoval.swift` (new — Vision framework wrapper)
- `mobile/plugins/with-background-removal/ios/BackgroundRemoval.m` (new — RCT bridge)
- `mobile/plugins/with-background-removal/android/BackgroundRemovalModule.kt` (new — MLKit Subject Seg wrapper)
- `mobile/plugins/with-background-removal/android/BackgroundRemovalPackage.kt` (new)
- `mobile/app.json` (register plugin in `expo.plugins`)
- `mobile/src/lib/backgroundRemoval.ts` (new — JS wrapper)
- `mobile/src/lib/imageUpload.ts` (storage path change to `{garmentId}/` folder)
- `mobile/src/lib/garmentSave.ts` (write `original_image_path` + `mask_status`)
- `mobile/src/screens/LiveScan/pipeline.ts` (segmentation insertion)
- `mobile/src/screens/AddPieceStep1.tsx` (segmentation insertion)
- `mobile/src/screens/GarmentDetailScreen.tsx` (Check Condition button)
- `mobile/src/components/garment/ConditionCheckSheet.tsx` (new)
- `mobile/src/i18n/locales/en.ts`, `sv.ts` (append-only — new keys)
- `supabase/migrations/{ts}_add_mask_status.sql` (new)
- `supabase/functions/process_render_jobs/index.ts` (prompt branch)

### Acceptance
- iOS 17+: capture → masked preview visible within 300 ms → Save Original produces clean cutout in wardrobe
- iOS 15/16: capture → no masking → Save Original produces raw photo (no regression)
- Android (Pixel 6): capture → masked preview within 600 ms → Studio render visibly improved vs control image
- Check Condition button on any post-R-B garment opens raw photo viewer

---

## R-C · Single-photo flow polish

Three independent fixes bundled — all touch the Step 1→3 capture path.

### R-C.1 · HEIC→JPEG explicit conversion (iOS gallery)
`expo-image-picker` returns HEIC on iOS 11+. `expo-image-manipulator` usually transcodes but fails on 10-bit HDR / multi-frame HEIC variants. Fix in `mobile/src/lib/imageUpload.ts`: detect `.heic` / `.heif` by extension, transcode to JPEG q=0.95 first, then run normal WebP resize. Adds ~80 ms to HEIC gallery imports; no impact on camera or LiveScan.

### R-C.2 · Android `content://` URI defense
`mobile/src/lib/imageUpload.ts:92` does `new FsFile(resized.uri).bytes()` with no error handling. Samsung One UI + multi-window + 3rd-party galleries return `content://` URIs that FsFile can't read. Wrap in try/catch; on failure, `expo-file-system.copyAsync` to a cache file, retry. Surfaces a toast on second failure. ~30 LOC.

### R-C.3 · Step 3 full edit pickers
Today Step 3 is read-only display of AI tags. Web has full pickers. Pull forward from Wave 9 plan since it's small.

Add to `mobile/src/screens/AddPieceStep3.tsx`:
- Category picker (existing options from `garmentCategories.ts`)
- Color picker (primary + secondary, existing swatch palette)
- Material picker (existing dropdown options)
- Seasons multi-chip (make existing display interactive)
- Formality 3-stop selector (casual / smart / formal)

AI-prefilled values; edited fields mark `ai_overridden: true` for analytics. Reuse `mobile/src/components/pickers/*` primitives if present; otherwise build minimal pill-button rows.

### Files touched
- `mobile/src/lib/imageUpload.ts` (HEIC + content:// defense)
- `mobile/src/screens/AddPieceStep3.tsx` (pickers)
- `mobile/src/components/pickers/*.tsx` (new primitives if needed)
- `mobile/src/i18n/locales/{en,sv}.ts` (append-only)

No new dependencies. No native work. No migrations.

### Acceptance
- HEIC gallery import on iOS 17 produces a saved garment with a valid image
- `content://` URI from a multi-window Samsung gallery import produces a saved garment with a valid image (or a clear toast)
- Step 3 lets user override any AI field; saved row reflects the override

---

## R-D · Batch flow parity & resilience

Tightly coupled to a `batchPipeline.ts` refactor — four items ship together.

### R-D.1 · Multi-garment review gate (web parity)
`analyze_garment` already returns multi-subject flags. Web halts items at confidence < 0.65; mobile silently passes them through.

Add state `'needs_review'` between `'analyzed'` and `'ready'` in the per-item state machine. UI in `mobile/src/screens/AddPieceStep2.tsx`:
- Items in `needs_review` render amber border + tap target
- Tap opens `MultiGarmentReviewSheet`: photo + AI note + two actions ("Keep — this is one garment" / "Skip this photo")
- Batch save disabled while any item is in `needs_review`; counter shows "2 photos need review"
- No crop tool in v1 — deferred

### R-D.2 · Backgrounding survival
Today's `batchPipeline.batches` Map is in-memory module-scope. Killed on app eviction.

Use **`expo-task-manager`** (sanctioned cross-platform path; both iOS BG processing tasks and Android HeadlessJsTaskService under one API):
- Register task `'burs.batch-upload'` at app boot
- `batchPipeline` checkpoints to AsyncStorage (`@burs/batch-{batchId}`) on every per-item state change
- iOS `UIBackgroundModes` gains `"processing"` in `app.json`
- Background task resumes **uploads only** (analyze too heavy for BG; deferred to next foreground)
- On foreground: scan `@burs/batch-*` keys, rehydrate state machines, continue analyze + save for items where upload completed in background

### R-D.3 · BG removal integration (R-B in batch context)
Per-item `work()` gains segmentation step between resize and upload, parallel with raw upload. `MAX_PARALLEL` stays at 2 — segmentation absorbed by existing parallelism budget. Idempotent and cheap, so background-interruption restart is safe.

### R-D.4 · Persistent batch ID + recovery banner
Replace `Math.random()` batch ID with `crypto.randomUUID()`. On AddPieceStep1 mount, if any `@burs/batch-*` keys exist, show recovery banner: "Resume your last batch (N photos)? [Resume] [Discard]". Best-effort — dead URIs surface as `'failed'` items on resume.

### Files touched
- `mobile/src/lib/batchPipeline.ts` (state machine, checkpoints, segmentation step)
- `mobile/src/lib/batchPersistence.ts` (new — AsyncStorage rw helpers)
- `mobile/src/lib/backgroundTasks.ts` (new — task-manager registration)
- `mobile/src/screens/AddPieceStep1.tsx` (recovery banner)
- `mobile/src/screens/AddPieceStep2.tsx` (needs_review UI)
- `mobile/src/components/batch/MultiGarmentReviewSheet.tsx` (new)
- `mobile/App.tsx` (register tasks at boot)
- `mobile/app.json` (iOS `UIBackgroundModes` add `"processing"`)
- `mobile/src/i18n/locales/{en,sv}.ts` (append-only)

No edge function changes. No migrations.

### Explicit deferrals
- Drag-reorder batch (`react-native-draggable-flatlist` dep, low value)
- In-batch crop tool
- Per-item caption editing (Wave 9 bulk-edit territory)

### Acceptance
- Multi-garment photo correctly enters `needs_review` and the user can skip or keep
- Backgrounded batch with N pending uploads resumes correctly when the app returns to foreground
- A killed-mid-batch session shows a recovery banner on relaunch

---

## PR sequencing

```
[R-A]  Android LiveScan parity                    (standalone)
    └── merge
[R-B]  BG removal + Gemini integration            (migration + edge fn + 2 native modules)
    └── merge + db push + functions deploy
[R-C]  Single-photo polish    +    [R-D]  Batch parity     (parallel, no file overlap)
    └── merge                          └── merge
```

**Why this order:**
- R-A first: standalone, no schema dependency, validates the EAS dev-client build path for native modules ahead of R-B's larger landing
- R-B before R-D: R-D's batch pipeline imports `removeBackground` from R-B's module
- R-C and R-D can ship in parallel — no shared files

**Wave-file pointer flip:** I update `docs/launch/overview.md` CURRENT WAVE pointer to `R — Android platform parity + on-device background removal`, commit, then start R-A.

**`CLAUDE.md` repair:** the project root `CLAUDE.md` CURRENT WAVE pointer is stale (still says "P — Mobile parity sweep"). I update it to reflect actual state (Wave Q-mobile-parity-2 closed 2026-05-12, Wave R now active) as part of the R-A PR.

---

## CI / testing

Per `reference-mobile-ci-gates` memory: every PR runs locally and in CI:

```bash
cd mobile
npm run lint -- "src/**/*.{ts,tsx}" --max-warnings 0
npm run typecheck
npm run test
```

(Note: lint MUST use the glob form, not `--ext .ts,.tsx` — different warning sets.)

Codex review loop per PR per `feedback-pr-gate-workflow`: fix every finding (incl. design comments), resolve threads, ping `@codex` after each round, loop until 5-min quiet window OR explicit 👍 / "no bugs found" message. Self-review loop after Codex passes.

**Native-module CI gap:** R-A and R-B require **real-device EAS development client builds**. MLKit doesn't run reliably in Android emulator; iOS 17 Vision needs real hardware or iOS 17 simulator. CI cannot validate the native paths. Each PR description carries a manual test matrix:

| Device | R-A test | R-B test |
|---|---|---|
| iPhone (iOS 17+) | n/a | Capture → masked preview in choice sheet → Save Original → wardrobe shows clean cutout |
| iPhone (iOS 15/16) | n/a | Capture → choice sheet shows raw → Save Original → wardrobe shows raw |
| Pixel / Samsung | LiveScan auto-snap fires within 1.5 s on framed garment | Capture → masked preview within 600 ms → Studio render visibly cleaner |

---

## Risk register

| Risk | Mitigation |
|---|---|
| MLKit Subject Seg is `16.0.0-beta1` | Native module catches all exceptions → `status='failed'` → raw fallback. Worst case = today's behavior. |
| iOS 17+ subject lifting requires `@available(iOS 17.0, *)` gate | Native module returns `'unavailable'` for iOS 16 and earlier. |
| Android frame processor worklet thread safety | MLKit detector instantiated once, reused. All plugin calls synchronous from worklet thread (vision-camera docs pattern). |
| Bundle size +13.5 MB on Android | Disclosed in PR description. ~1.5 % of typical 1 GB install threshold. |
| `react-native-vision-camera` v5 frame processor plugin API stability | Pin exact version `5.0.9`. Don't auto-bump. |
| `expo-task-manager` background processing reliability on Android | Best-effort only. Recovery banner is the safety net. |
| `content://` URI revocation across app lifecycle | R-C.2 copy-to-file fallback + recovery banner cleanly drops dead URIs. |
| Storage path change to `{garmentId}/` folder breaks orphan cleanup expectations | Document new layout in PR description; existing flat-path garments are untouched. |
| iOS Swift module signing / target-version bumps on EAS build | Validate iOS deployment target `>= 14.0` in Podfile (current Expo SDK 54 default). |
| Gemini prompt-branch regression on existing renders (`mask_status` IS NULL) | NULL handled identically to `'unavailable'` — current behavior preserved. |

---

## Out of Wave R scope (deferred)

- Linked imports (Pinterest / Shein URL paste on mobile)
- Drag-reorder batch + in-batch crop
- Per-item batch caption editing (Wave 9 bulk-edit territory)
- Web-side anything (web being deleted post-launch)
- Wave 9 bulk-edit beyond the Step 3 pickers R-C pulls forward
- Orphan storage cleanup cron for the new `{garmentId}/` folder layout

---

## Migration discipline (R-B only)

Per `CLAUDE.md`:
- `supabase/migrations/{ts}_add_mask_status.sql` committed in the R-B PR
- I never `apply_migration` via MCP
- Post-merge: I run `npx supabase db push --linked --yes` from `main` (per memory `feedback-db-push-after-merge`)
- One edge function redeploy:
  ```
  npx supabase functions deploy process_render_jobs --project-ref khvkwojtlkcvxjxztduj --no-verify-jwt
  ```

---

## Open questions for user before R-B PR opens
- Swedish translation confirmation for "Check condition" button (current draft: `"Inspektera skick"`).
- Confidence threshold for `mask_status='failed'` fallback (current draft: mean alpha < 0.5). Tunable after first device tests.
