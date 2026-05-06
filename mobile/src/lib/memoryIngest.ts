// Fire-and-forget client for the `memory_ingest` edge function.
//
// Memory ingest is a write-only signal channel for the Style Memory subsystem
// (Wave 8.5). Failures must never block the UI — wear/save/rate flows already
// got their primary DB write through, so a missed memory event is a
// best-effort signal degradation, not a correctness break. Wrapping every
// call in a try/catch and swallowing the error is the canonical contract
// (mirrors web's `fireMemoryIngest` helper).
//
// Body shape per supabase/functions/memory_ingest/index.ts:
//   { event_type: string, outfit_id?: string, garment_ids?: string[],
//     metadata?: Record<string, unknown>, source?: string, ... }
//
// M9: routes through `callEdgeFunction` so retry / timeout / circuit-break /
// pre-flight session refresh are consistent with every other edge call.

import { callEdgeFunction } from './edgeFunctionClient';

export type MemoryIngestEvent = {
  event_type: string;
  outfit_id?: string;
  garment_ids?: string[];
  metadata?: Record<string, unknown>;
  source?: string;
};

export async function ingestMemoryEvent(event: MemoryIngestEvent): Promise<void> {
  try {
    await callEdgeFunction('memory_ingest', { body: event, retries: 0 });
  } catch {
    // Fire-and-forget — memory failure must never block UI.
  }
}
