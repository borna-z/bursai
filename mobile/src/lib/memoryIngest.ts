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

import { supabaseUrl } from './supabase';

export type MemoryIngestEvent = {
  event_type: string;
  outfit_id?: string;
  garment_ids?: string[];
  metadata?: Record<string, unknown>;
  source?: string;
};

export async function ingestMemoryEvent(
  accessToken: string,
  event: MemoryIngestEvent,
): Promise<void> {
  try {
    await fetch(`${supabaseUrl}/functions/v1/memory_ingest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(event),
    });
  } catch {
    // Fire-and-forget — memory failure must never block UI.
  }
}
