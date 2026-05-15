// Wave S-C.6 — minimal client-side analytics sink.
//
// Single fire-and-forget helper that writes a row to `analytics_events`
// (event_name + properties + user_id). Existing edge-function telemetry
// (`scale-guard.ts:logTelemetry`) targets the same table, so dashboards keep
// one source of truth.
//
// Why a thin wrapper rather than a full analytics framework:
//   - The mobile app already has Sentry for crashes/errors; this is for
//     product-perf timings (AddPiece p50, etc), not user behaviour analytics.
//   - Adding amplitude/segment would bloat the bundle and require a key flow.
//   - The existing `analytics_events` table is already wired into our cron /
//     dashboard pipeline.
//
// Failure semantics:
//   - All errors swallowed. Telemetry must never block a UX flow or surface to
//     the user. Sentry covers genuine crashes; a missed analytics row is
//     acceptable signal degradation.
//   - No offline queue. A dropped event under offline / signed-out conditions
//     is fine for product-perf metrics — we're sampling, not auditing.

import { supabase } from './supabase';

export type AnalyticsProperties = Record<string, unknown>;

/**
 * Fire-and-forget analytics event. Writes one row to `public.analytics_events`
 * with the provided `event_name` + `properties` JSON. Always best-effort.
 *
 * The supabase client's RLS policy resolves user_id from `auth.uid()`; we
 * don't pass it explicitly so the wrapper works for both signed-in (typical)
 * and anonymous (rare — pre-auth signup events) callers.
 */
export function trackEvent(eventName: string, properties: AnalyticsProperties = {}): void {
  try {
    void supabase
      .from('analytics_events')
      .insert({
        event_name: eventName,
        properties,
      })
      .then(() => {
        // Intentionally empty — fire-and-forget. The PostgrestBuilder thenable
        // resolves with { data, error }; both are dropped. Sentry would
        // dominate this surface if we logged here.
      });
  } catch {
    // Telemetry path must never throw to the caller. Even client constructor
    // errors during early-boot get swallowed here.
  }
}

/**
 * Wave S-C.6 — AddPiece perceived-speed timing. One row per completed AddPiece
 * flow with the four perceived-speed checkpoints relative to t_capture.
 *
 * Pass the millisecond `Date.now()` snapshot for each checkpoint; the helper
 * computes deltas (so the rows are immediately graphable without joining the
 * raw t-values) and stores both. Any null checkpoint means the flow exited
 * before that phase landed — common, for example, when the user backs out
 * before Save (`t_save = null`).
 */
export interface AddPieceTiming {
  t_capture: number | null;
  t_analyze_resolved: number | null;
  t_form_ready: number | null;
  t_save: number | null;
  /** Distinguishes single-photo vs batch_add vs livescan in dashboards. */
  source: string | null;
}

export function trackAddPieceTiming(timing: AddPieceTiming): void {
  const { t_capture, t_analyze_resolved, t_form_ready, t_save, source } = timing;
  const delta = (later: number | null, earlier: number | null) =>
    later != null && earlier != null ? Math.max(0, later - earlier) : null;
  trackEvent('addpiece.timing', {
    t_capture,
    t_analyze_resolved,
    t_form_ready,
    t_save,
    analyze_ms: delta(t_analyze_resolved, t_capture),
    form_ready_ms: delta(t_form_ready, t_capture),
    save_ms: delta(t_save, t_capture),
    source: source ?? 'unknown',
  });
}

// Wave S-C.6 — flow-id aggregator (Codex P2 on #848).
//
// Each AddPiece checkpoint event (`addpiece.capture` / `.analyze.resolved` /
// `.form.ready` / `.save`) is still emitted independently for per-phase
// debugging, but those rows have no shared correlation key, so batch /
// back-to-back sessions can't be joined to compute the aggregate p50/p95
// perceived-speed metric the wave wants. This helper threads a flow id
// (typically the photo URI, stable across the three screens) and emits a
// single `addpiece.timing` row when the save checkpoint lands.
//
// Singleton-style: AddPiece is sequential in the foreground (one active
// flow at a time). A new `'capture'` checkpoint resets the in-flight flow;
// a `'save'` flushes and clears it. Stale flows are evicted on the next
// capture, so a back-out + retry doesn't leak.

type AddPieceCheckpoint = 'capture' | 'analyze_resolved' | 'form_ready' | 'save';

interface InFlightFlow {
  flowId: string;
  source: string | null;
  t_capture: number | null;
  t_analyze_resolved: number | null;
  t_form_ready: number | null;
}

let currentFlow: InFlightFlow | null = null;

export function markAddPieceCheckpoint(
  flowId: string,
  checkpoint: AddPieceCheckpoint,
  meta: { source?: string | null } = {},
): void {
  const now = Date.now();
  if (checkpoint === 'capture') {
    currentFlow = {
      flowId,
      source: meta.source ?? null,
      t_capture: now,
      t_analyze_resolved: null,
      t_form_ready: null,
    };
    return;
  }
  if (!currentFlow || currentFlow.flowId !== flowId) {
    // Out-of-band checkpoint (e.g. user backed out then re-entered without
    // a fresh capture). Skip the aggregator; the per-phase trackEvent at the
    // call site still lands so dashboards aren't blind.
    return;
  }
  if (checkpoint === 'analyze_resolved') {
    currentFlow.t_analyze_resolved = now;
    return;
  }
  if (checkpoint === 'form_ready') {
    currentFlow.t_form_ready = now;
    return;
  }
  // 'save' — flush the aggregate row and clear.
  trackAddPieceTiming({
    t_capture: currentFlow.t_capture,
    t_analyze_resolved: currentFlow.t_analyze_resolved,
    t_form_ready: currentFlow.t_form_ready,
    t_save: now,
    source: meta.source ?? currentFlow.source,
  });
  currentFlow = null;
}

/** Test-only: reset the in-flight flow. Exposed so unit tests don't leak state. */
export function __resetAddPieceFlowForTest(): void {
  currentFlow = null;
}
