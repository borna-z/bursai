// Per-scan async pipeline. Fire-and-forget at the caller; the function always
// resolves. Emits lifecycle events the screen subscribes to. Concurrency is
// the caller's responsibility (filmstrip caps in-flight scans at 3).
//
// Stages (set BEFORE awaiting each step, so a thrown error classifies on the
// correct stage):
//   1. compress — set before resizeForGarment. A throw here gets `compress_failed`.
//   2. upload   — set BEFORE uploadManipulatedImage so a network/storage failure
//                 classifies as `upload_failed` (not `compress_failed`).
//   3. analyze  — callEdgeFunction('analyze_garment', { mode: 'fast' }).
//   4. persist  — persistGarmentWithOfflineFallback. This already kicks off
//                 queueRender and triggerGarmentEnrichment internally per
//                 mobile/src/lib/garmentSave.ts.
//
// invalidate callback: the caller passes a React Query invalidation function
// that runs after a successful save OR after an OfflineQueuedError. Running it
// inside the pipeline (rather than via event subscription in the screen) means
// the invalidation survives screen unmount — the queryClient is the app-root
// singleton and stays valid after the screen is gone.

import { resizeForGarment, uploadManipulatedImage, deleteUpload, type UploadResult } from '../../lib/imageUpload';
import { callEdgeFunction } from '../../lib/edgeFunctionClient';
import { getLocale } from '../../lib/i18n';
import {
  persistGarmentWithOfflineFallback,
  OfflineQueuedError,
} from '../../lib/garmentSave';
import type { AnalysisResult } from '../../hooks/useAnalyzeGarment';
import type { LiveScanEvents } from './events';
import { classifyPipelineError } from './errorClassification';
import type { PipelineStage, ScanSessionId } from './types';

export async function ingestScan(
  photoUri: string,
  sessionId: ScanSessionId,
  userId: string,
  events: LiveScanEvents,
  invalidate: () => void,
): Promise<void> {
  let stage: PipelineStage = 'compress';
  // Declared outside the try so the catch can reference it when cleaning up
  // an orphaned upload after a later-stage failure (analyze / persist).
  let uploaded: UploadResult | null = null;
  events.emit('start', { sessionId, photoUri });
  try {
    // 1a. compress
    events.emit('stage', { sessionId, stage });
    const compressed = await resizeForGarment(photoUri);

    // 1b. upload — advance stage BEFORE awaiting so a storage failure
    //     classifies as upload_failed, not compress_failed.
    stage = 'upload';
    events.emit('stage', { sessionId, stage });
    uploaded = await uploadManipulatedImage(compressed, userId);

    // 2. analyze
    stage = 'analyze';
    events.emit('stage', { sessionId, stage });
    const analysis = await callEdgeFunction<AnalysisResult>('analyze_garment', {
      body: {
        storagePath: uploaded.storagePath,
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
      await deleteUpload(uploaded.storagePath).catch(() => {});
      events.emit('failed', { sessionId, errorClass: 'multi_garment' });
      return;
    }

    // 3. persist (kicks off queueRender + triggerGarmentEnrichment internally)
    stage = 'persist';
    events.emit('stage', { sessionId, stage });
    const garment = await persistGarmentWithOfflineFallback({
      storagePath: uploaded.storagePath,
      analysis,
      source: 'live_scan',
      enableStudioQuality: true,
    });

    events.emit('saved', { sessionId, garmentId: garment.id });
    // Invalidate React Query caches directly so wardrobe/count/insights
    // refresh even when the screen has already unmounted (background finish).
    invalidate();
  } catch (err) {
    if (err instanceof OfflineQueuedError) {
      // Do NOT delete the uploaded object here — the queued replay will
      // reuse the storage path when it eventually runs.
      events.emit('queued', { sessionId });
      // Invalidate here too — the garment will appear once the queue
      // replays, but the count / stats should reflect the queued item now.
      invalidate();
      return;
    }
    // Clean up orphaned upload if analyze/persist failed after upload
    // succeeded. Best-effort; we never want cleanup to mask the original
    // error or block the 'failed' event.
    if (uploaded?.storagePath) {
      void deleteUpload(uploaded.storagePath).catch(() => {});
    }
    events.emit('failed', {
      sessionId,
      errorClass: classifyPipelineError(err, stage),
    });
  }
}
