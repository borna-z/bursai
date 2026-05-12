// Tiny typed EventEmitter for the LiveScan screen.
//
// Why not `useReducer` or context? The filmstrip, scan counter, and quality
// hint all subscribe to high-frequency events. Routing those through React
// state would re-render the parent (which holds the camera view) on every
// pipeline tick. The emitter is local to the screen — `new LiveScanEvents()`
// per mount, garbage-collected on unmount.

import type { PipelineErrorClass, PipelineStage, ScanSessionId } from './types';

type Listener<T> = (payload: T) => void;

export interface ScanLifecycleEvents {
  start: { sessionId: ScanSessionId; photoUri: string };
  stage: { sessionId: ScanSessionId; stage: PipelineStage };
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
      } catch {
        // Listener errors must never disrupt the pipeline. Swallow silently —
        // a misbehaving consumer should not cascade into a failed save.
      }
    });
  }
}
