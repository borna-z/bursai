// Per-scan async pipeline. Fire-and-forget at the caller; the function always
// resolves. Emits lifecycle events the screen subscribes to. Concurrency is
// the caller's responsibility (filmstrip caps in-flight scans at 3).
//
// Stages (set BEFORE awaiting each step, so a thrown error classifies on the
// correct stage):
//   1. compress — set right before calling resizeAndUpload (which does both
//      compression and upload). A throw here gets `compress_failed`.
//   2. upload — set AFTER resizeAndUpload returns (everything past this point
//      is post-upload work). Currently only the analyze and persist stages
//      use it for classification — kept as an explicit hop for the
//      lifecycle event consumers.
//   3. analyze — callEdgeFunction('analyze_garment', { mode: 'fast' }).
//   4. persist — persistGarmentWithOfflineFallback. This already kicks off
//      queueRender and triggerGarmentEnrichment internally per
//      mobile/src/lib/garmentSave.ts.

import { resizeAndUpload } from '../../lib/imageUpload';
import { callEdgeFunction } from '../../lib/edgeFunctionClient';
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
): Promise<void> {
  let stage: PipelineStage = 'compress';
  events.emit('start', { sessionId, photoUri });
  try {
    // 1. compress + upload (single call — resizeAndUpload does both).
    events.emit('stage', { sessionId, stage });
    const uploaded = await resizeAndUpload(photoUri, userId);
    stage = 'upload';
    events.emit('stage', { sessionId, stage });

    // 2. analyze
    stage = 'analyze';
    events.emit('stage', { sessionId, stage });
    const analysis = await callEdgeFunction<AnalysisResult>('analyze_garment', {
      body: {
        storagePath: uploaded.storagePath,
        mode: 'fast',
        locale: 'en',
      },
    });
    if (!analysis) {
      throw new Error('analyze_garment returned empty payload');
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
  } catch (err) {
    if (err instanceof OfflineQueuedError) {
      events.emit('queued', { sessionId });
      return;
    }
    events.emit('failed', {
      sessionId,
      errorClass: classifyPipelineError(err, stage),
    });
  }
}
