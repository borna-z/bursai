// Tiny typed EventEmitter for the LiveScan screen.
//
// Why not `useReducer` or context? The filmstrip, scan counter, and quality
// hint all subscribe to high-frequency events. Routing those through React
// state would re-render the parent (which holds the camera view) on every
// pipeline tick. The emitter is local to the screen — `new LiveScanEvents()`
// per mount, garbage-collected on unmount.

import type { MaskStatus } from '../../lib/backgroundRemoval';
import { log } from '../../lib/log';
import type { AnalysisResult } from '../../hooks/useAnalyzeGarment';
import type { PipelineErrorClass, PipelineStage, ScanSessionId } from './types';

type Listener<T> = (payload: T) => void;

/**
 * Wave R-D Bug C — payload emitted after the analyze phase completes and the
 * pipeline pauses for the user's quality choice. Carries everything the
 * review card needs to render + everything the persist phase needs to commit.
 */
export interface AnalyzedScan {
  sessionId: ScanSessionId;
  /** Pre-allocated row UUID — matches the storage folder name. */
  garmentId: string;
  userId: string;
  /** Local file:// URI of the captured frame; cheap to render as fallback. */
  photoUri: string;
  rawStoragePath: string;
  maskedStoragePath: string | null;
  maskStatus: MaskStatus;
  analysis: AnalysisResult;
}

export interface ScanLifecycleEvents {
  start: { sessionId: ScanSessionId; photoUri: string };
  stage: { sessionId: ScanSessionId; stage: PipelineStage };
  /**
   * Capture analyzed successfully and is awaiting the user's Save Original /
   * Save Studio / Skip decision. The pipeline pauses here — the screen's
   * review card consumes the payload and dispatches one of
   * `persistAnalyzedScan` / `discardAnalyzedScan` once the user taps.
   */
  analyzed: AnalyzedScan;
  saved: { sessionId: ScanSessionId; garmentId: string };
  queued: { sessionId: ScanSessionId };
  failed: { sessionId: ScanSessionId; errorClass: PipelineErrorClass };
  discard: { sessionId: ScanSessionId };
}

export class LiveScanEvents {
  private listeners = new Map<keyof ScanLifecycleEvents, Set<Listener<unknown>>>();

  on<K extends keyof ScanLifecycleEvents>(
    event: K,
    listener: Listener<ScanLifecycleEvents[K]>,
  ): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(listener as Listener<unknown>);
    return () => {
      set?.delete(listener as Listener<unknown>);
    };
  }

  emit<K extends keyof ScanLifecycleEvents>(
    event: K,
    payload: ScanLifecycleEvents[K],
  ): void {
    const set = this.listeners.get(event);
    if (!set) return;
    set.forEach((listener) => {
      try {
        (listener as Listener<ScanLifecycleEvents[K]>)(payload);
      } catch (err) {
        log.error(err, { context: 'LiveScan.events.listener_failed' });
        // Listener errors must never disrupt the pipeline. Swallow silently —
        // a misbehaving consumer should not cascade into a failed save.
      }
    });
  }
}
