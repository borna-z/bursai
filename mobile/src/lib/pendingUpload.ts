// Coordination primitive for the parallel analyze + upload flow in AddPiece.
//
// Why this exists: PR 1 fires the analyze_garment edge call concurrently with
// the storage upload so the user can land on Step 3 before the upload settles.
// React Navigation's params must be plain serializable JSON, so the in-flight
// Promise can't ride along on `nav.navigate` params. Step 2 generates an id,
// stashes the upload promise here, then passes only the id forward. Step 3
// awaits the promise via `takePendingUpload(id)` when the user hits Save —
// or earlier if `storagePath` is referenced before the user gets there.
//
// `take` semantics — entries are deleted on read so a subsequent retry / nav
// flow can't accidentally consume a stale promise. Step 3 is the sole reader
// in PR 1, but the discipline keeps things tidy as PR 5 / PR 8 (batch + offline)
// add more producers.
//
// Memory: bounded by user behaviour — a slow upload + a quick back/forward
// nav loop could leak a handful of entries. The map is module-level (process-
// wide), so a hot-reload during dev or app restart clears it. Adding an LRU
// cap is overkill for the current footprint; revisit if PR 5's batch-add
// produces 30+ pending entries simultaneously.

import type { UploadResult } from './imageUpload';

export type PendingUploadPromise = Promise<UploadResult>;

const pending = new Map<string, PendingUploadPromise>();

/** Generate a short, collision-resistant id. Not cryptographic — just unique enough across an in-flight Add session. */
export function makeUploadId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function setPendingUpload(id: string, promise: PendingUploadPromise): void {
  pending.set(id, promise);
}

/**
 * Retrieve and remove a pending upload promise. Returns `undefined` if the id
 * was never registered or has already been consumed. Callers must handle the
 * undefined case — typically by surfacing a generic "upload didn't finish" error.
 */
export function takePendingUpload(id: string): PendingUploadPromise | undefined {
  const p = pending.get(id);
  if (p) pending.delete(id);
  return p;
}

/** Drop a registration without consuming the promise — used when the user backs out of Step 2 mid-upload. */
export function dropPendingUpload(id: string): void {
  pending.delete(id);
}
