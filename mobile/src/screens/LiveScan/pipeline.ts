// Per-scan async pipeline. Two-phase since Wave R-D Bug C (2026-05-15):
//
//   Phase 1 — `analyzeFromCapture`: resize + upload raw + parallel mask +
//     analyze. Emits `'analyzed'` with the full payload on success so the
//     LiveScan screen can pause scanning and show the per-garment review
//     card. On failure emits `'failed'` and best-effort cleans up the
//     uploaded variants.
//
//   Phase 2 — `persistAnalyzedScan(payload, enableStudioQuality)`:
//     called from the review card after the user picks Save Original /
//     Save Studio. Runs `persistGarmentWithOfflineFallback` with the
//     chosen flag, emits `'saved'` / `'queued'` / `'failed'`, and
//     invalidates wardrobe caches on success.
//
//   Phase 2b — `discardAnalyzedScan(payload)`: called when the user taps
//     Skip on the review card. Cleans up raw + masked uploads from
//     storage and emits `'discard'` so the filmstrip clears its tile.
//
// Why the split: before R-D the pipeline auto-saved with
// `enableStudioQuality: true`, bypassing the choice sheet entirely. Users
// reported during device-test they wanted a per-garment Original / Studio
// choice without leaving the LiveScan flow. Splitting analyze from persist
// lets the screen own the pause and render UI between them while the
// pipeline retains its event-emitting + error-classification contract.
//
// Stage classification (set BEFORE awaiting each step so a thrown error
// classifies on the correct stage):
//   compress — set before resizeForGarment. A throw here gets `compress_failed`.
//   upload   — set BEFORE the raw upload + segmentation parallel-await so a
//              network/storage failure on the raw path classifies as
//              `upload_failed`. Segmentation failures degrade silently to
//              `mask_status='failed'` and never raise the upload stage.
//   analyze  — callEdgeFunction('analyze_garment', { mode: 'fast' }).
//   persist  — set inside `persistAnalyzedScan` before
//              persistGarmentWithOfflineFallback. Same classification rules.
//
// invalidate callback: passed into `persistAnalyzedScan` (not the analyze
// phase) since it should only fire after a successful save. Running it
// inside the pipeline (rather than via event subscription in the screen)
// means the invalidation survives screen unmount — the queryClient is the
// app-root singleton and stays valid after the screen is gone.
//
// Wave R-B — per-garment storage layout. We pre-generate a client-side UUID
// for the garment row, then upload both the raw capture AND (when device
// segmentation succeeds) a masked WebP into `{userId}/{garmentId}/raw.webp`
// and `{userId}/{garmentId}/masked.webp`. The row insert passes both paths so
// `image_path` carries the masked cutout (falling back to the raw bytes if
// segmentation reported `'unavailable'` / `'failed'` / threw). Gemini reads
// `mask_status` off the row to branch its system prompt — see
// `supabase/functions/render_garment_image/index.ts`.

import * as ImageManipulator from 'expo-image-manipulator';
import * as Crypto from 'expo-crypto';

import {
  resizeForGarment,
  uploadGarmentVariant,
  deleteUpload,
  type UploadResult,
} from '../../lib/imageUpload';
import {
  removeBackground,
  MASK_SAVE_TIMEOUT_MS,
  type MaskResult,
  type MaskStatus,
} from '../../lib/backgroundRemoval';
import { callEdgeFunction } from '../../lib/edgeFunctionClient';
import { getLocale } from '../../lib/i18n';
import {
  persistGarmentWithOfflineFallback,
  surfaceRenderEnqueueFailureToast,
  OfflineQueuedError,
} from '../../lib/garmentSave';
import type { AnalysisResult } from '../../hooks/useAnalyzeGarment';
import type { AnalyzedScan, LiveScanEvents } from './events';
import { classifyPipelineError } from './errorClassification';
import type { PipelineStage, ScanSessionId } from './types';

/** Phase 1 — capture → resize → upload → segment → analyze. */
export async function analyzeFromCapture(
  photoUri: string,
  sessionId: ScanSessionId,
  userId: string,
  events: LiveScanEvents,
): Promise<void> {
  let stage: PipelineStage = 'compress';
  let rawUpload: UploadResult | null = null;
  let maskedUpload: UploadResult | null = null;
  // Wave R-B — client-side UUID stamps both upload paths AND the eventual
  // row insert so all three garment-image variants co-locate under
  // `garments/{userId}/{garmentId}/`. Lets us upload masked + raw before
  // the row exists.
  const garmentId = Crypto.randomUUID();
  events.emit('start', { sessionId, photoUri });
  try {
    // 1a. compress
    events.emit('stage', { sessionId, stage });
    const compressed = await resizeForGarment(photoUri);

    // 1b. upload — advance stage BEFORE awaiting so a storage failure
    //     classifies as upload_failed, not compress_failed.
    //
    //     R-B parallelism: kick off raw upload + on-device segmentation
    //     simultaneously. Both touch the resized URI but operate on
    //     independent IO paths (segmentation reads the local file bytes;
    //     upload writes to Supabase storage). The segmenter falls back to
    //     `status='failed'` on any error and never raises.
    //
    //     Codex P1 round 4 — `Promise.all` would let a slow mask block
    //     the entire save path. Worst case: first-launch Android needs
    //     to download the MLKit Subject Segmentation Play Services
    //     module (~10 MB, multi-second). The save MUST NOT be gated by
    //     that download. Solution: await the raw upload normally, then
    //     race the mask result against MASK_SAVE_TIMEOUT_MS. If the
    //     segmenter hasn't returned by then, degrade to raw-only with
    //     `mask_status='unavailable'`. The mask may still resolve in
    //     the background; we just discard its result. The transcode +
    //     masked upload that come after the race are themselves fast
    //     (< 200 ms typically) so the post-cap path stays inside
    //     reasonable latency budgets even when masking succeeds.
    stage = 'upload';
    events.emit('stage', { sessionId, stage });
    const rawUploadP = uploadGarmentVariant(compressed, userId, garmentId, 'raw');
    const maskP = removeBackground(compressed.uri);
    rawUpload = await rawUploadP;

    let maskTimer: ReturnType<typeof setTimeout> | null = null;
    const maskTimeoutP = new Promise<MaskResult>((resolve) => {
      maskTimer = setTimeout(
        () => resolve({
          uri: compressed.uri,
          status: 'unavailable',
          confidence: 0,
          durationMs: 0,
        }),
        MASK_SAVE_TIMEOUT_MS,
      );
    });
    let maskRes: MaskResult;
    try {
      maskRes = await Promise.race([maskP, maskTimeoutP]);
    } finally {
      if (maskTimer) clearTimeout(maskTimer);
    }
    // Defensive: swallow late rejections from the loser of the race so
    // the JS engine doesn't log unhandled-promise-rejection warnings
    // when the timeout wins and the mask later throws.
    maskP.catch(() => {});

    // R-B — when the native segmenter produced a usable cutout, transcode
    // it through expo-image-manipulator to WebP (matching the storage
    // contentType the upload helper writes) and upload as the masked
    // variant.
    //
    // Why the transcode: iOS Vision writes PNG (it has no built-in WebP
    // encoder); Android MLKit writes WebP already. Both flow through the
    // same JS-side ImageManipulator pass so the storage upload's
    // `image/webp` MIME contract holds across platforms. The extra
    // encode on Android is ~30ms on a 1024px image — negligible
    // compared to the segmentation step itself.
    //
    // Any failure here degrades to `mask_status='failed'` and leaves
    // the row pointing at the raw bytes — never blocks the save.
    let maskStatus: MaskStatus = maskRes.status;
    if (maskRes.status === 'masked') {
      try {
        const transcoded = await ImageManipulator.manipulateAsync(
          maskRes.uri,
          [],
          {
            compress: 0.8,
            format: ImageManipulator.SaveFormat.WEBP,
          },
        );
        maskedUpload = await uploadGarmentVariant(
          transcoded,
          userId,
          garmentId,
          'masked',
        );
      } catch {
        maskStatus = 'failed';
        maskedUpload = null;
      }
    }

    // 2. analyze — uses the raw upload's storage path (Gemini reads bytes
    //    server-side, segmentation isn't part of analyze's signal).
    stage = 'analyze';
    events.emit('stage', { sessionId, stage });
    const analysis = await callEdgeFunction<AnalysisResult>('analyze_garment', {
      body: {
        storagePath: rawUpload.storagePath,
        mode: 'fast',
        locale: getLocale(),
      },
    });
    if (!analysis) {
      throw new Error('analyze_garment returned empty payload');
    }

    // Multi-garment short-circuit: do not persist an ambiguous photo. Clean
    // up the orphan upload and surface the amber tile state so the user can
    // retake. The filmstrip's AMBER_CLASSES set handles the visual.
    if (analysis.image_contains_multiple_garments) {
      await deleteUpload(rawUpload.storagePath).catch(() => {});
      if (maskedUpload?.storagePath) {
        await deleteUpload(maskedUpload.storagePath).catch(() => {});
      }
      events.emit('failed', { sessionId, errorClass: 'multi_garment' });
      return;
    }

    // 3. analyzed — pause for the review card. The screen subscribes to
    //    this event, presents Save Original / Save Studio / Skip, then
    //    dispatches `persistAnalyzedScan` or `discardAnalyzedScan` with
    //    the payload below.
    const payload: AnalyzedScan = {
      sessionId,
      garmentId,
      userId,
      photoUri,
      rawStoragePath: rawUpload.storagePath,
      maskedStoragePath: maskedUpload?.storagePath ?? null,
      maskStatus,
      analysis,
    };
    events.emit('analyzed', payload);
  } catch (err) {
    // Clean up orphaned uploads if analyze failed after upload succeeded.
    // Best-effort; we never want cleanup to mask the original error or
    // block the 'failed' event.
    if (rawUpload?.storagePath) {
      void deleteUpload(rawUpload.storagePath).catch(() => {});
    }
    if (maskedUpload?.storagePath) {
      void deleteUpload(maskedUpload.storagePath).catch(() => {});
    }
    events.emit('failed', {
      sessionId,
      errorClass: classifyPipelineError(err, stage),
    });
  }
}

/**
 * Phase 2 — persist a reviewed scan with the user's quality choice. Fires
 * after the review card's Save Original (false) / Save Studio (true) tap.
 * Emits `'saved'` on success, `'queued'` on offline, `'failed'` otherwise.
 * Runs the invalidation callback on success + on offline-queued (the
 * garment will appear once the queue replays, but the count / stats
 * should reflect the queued item now).
 */
export async function persistAnalyzedScan(
  payload: AnalyzedScan,
  enableStudioQuality: boolean,
  events: LiveScanEvents,
  invalidate: () => void,
): Promise<void> {
  events.emit('stage', { sessionId: payload.sessionId, stage: 'persist' });
  try {
    const garment = await persistGarmentWithOfflineFallback(
      {
        // Pre-generated row UUID — must match the folder name we
        // uploaded raw + masked variants into, otherwise the row's
        // `image_path` / `original_image_path` would point at files
        // under a folder whose name nothing else can reconstruct.
        garmentId: payload.garmentId,
        storagePath: payload.rawStoragePath,
        maskedStoragePath: payload.maskedStoragePath ?? undefined,
        maskStatus: payload.maskStatus,
        analysis: payload.analysis,
        source: 'live_scan',
        enableStudioQuality,
      },
      { onRenderEnqueueFailure: surfaceRenderEnqueueFailureToast },
    );
    events.emit('saved', { sessionId: payload.sessionId, garmentId: garment.id });
    invalidate();
  } catch (err) {
    if (err instanceof OfflineQueuedError) {
      // Do NOT delete the uploaded objects here — the queued replay will
      // reuse the storage paths when it eventually runs.
      events.emit('queued', { sessionId: payload.sessionId });
      invalidate();
      return;
    }
    // Persist failed for a non-offline reason (RLS, validation, server
    // 5xx). Clean up the storage objects so a retry doesn't accumulate
    // orphans — the user can re-capture if they want to try again.
    void deleteUpload(payload.rawStoragePath).catch(() => {});
    if (payload.maskedStoragePath) {
      void deleteUpload(payload.maskedStoragePath).catch(() => {});
    }
    events.emit('failed', {
      sessionId: payload.sessionId,
      errorClass: classifyPipelineError(err, 'persist'),
    });
  }
}

/**
 * Phase 2b — user tapped Skip on the review card. Clean up raw + masked
 * storage objects so nothing orphans, then emit `'discard'` so the
 * filmstrip clears its tile.
 */
export async function discardAnalyzedScan(
  payload: AnalyzedScan,
  events: LiveScanEvents,
): Promise<void> {
  void deleteUpload(payload.rawStoragePath).catch(() => {});
  if (payload.maskedStoragePath) {
    void deleteUpload(payload.maskedStoragePath).catch(() => {});
  }
  events.emit('discard', { sessionId: payload.sessionId });
}
