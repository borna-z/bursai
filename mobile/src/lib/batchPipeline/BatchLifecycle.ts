// Explicit lifecycle registry for batches. Replaces the implicit module-scope
// `Map` with `register` / `unregister` / `cleanup` so the boundary between
// "batch alive" and "batch torn down" is named rather than implied.
//
// `cleanup` is idempotent — calling it after the batch is already gone is a
// no-op, not an error. This matters because Step 3 unmount and the final-save
// path can both fire `cleanup` for the same batchId.

import * as Crypto from 'expo-crypto';

import type { AnalysisResult } from '../../hooks/useAnalyzeGarment';
import type { AddGarmentSource } from '../garmentSave';
import { deleteUpload } from '../imageUpload';
import type { BatchItemState } from './BatchStateMachine';

export interface BatchItem extends BatchItemState {
  _settled: Promise<BatchItem> | null;
}

export interface Batch {
  id: string;
  userId: string;
  source: AddGarmentSource;
  items: BatchItem[];
  analyzeFn: (input: { base64: string } | { storagePath: string }) => Promise<AnalysisResult | null>;
  maxParallel: number;
  inFlightCount: number;
  rateLimitTimerId: ReturnType<typeof setTimeout> | null;
}

const batches = new Map<string, Batch>();

export function makeBatchId(): string {
  return `b-${Crypto.randomUUID()}`;
}

export function register(batch: Batch): void {
  batches.set(batch.id, batch);
}

export function unregister(batchId: string): void {
  batches.delete(batchId);
}

export function getBatch(batchId: string): Batch | undefined {
  return batches.get(batchId);
}

export function hasBatch(batchId: string): boolean {
  return batches.has(batchId);
}

/**
 * Tear down a batch — clears the entry from the map and best-effort deletes
 * any storage objects from items the user never saved. Idempotent.
 */
export function cleanup(batchId: string): void {
  const batch = batches.get(batchId);
  if (!batch) return;
  batches.delete(batchId);
  if (batch.rateLimitTimerId !== null) {
    clearTimeout(batch.rateLimitTimerId);
    batch.rateLimitTimerId = null;
  }
  for (const item of batch.items) {
    if (item.status !== 'saved' && item.storagePath) {
      void deleteUpload(item.storagePath);
    }
  }
}
