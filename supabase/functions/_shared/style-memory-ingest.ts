/**
 * Wave 8.5 P85 — Style Memory ingest helper.
 *
 * Cross-function helper for writing Style Memory signals from edge functions
 * OTHER than `memory_ingest` itself. Used by P89's `style_chat` for
 * chat-driven preference persistence (e.g. "never suggest this", "I hate
 * skinny jeans") where the user's intent is detected mid-conversation and
 * the signal must be recorded as a side effect of the chat turn.
 *
 * The `memory_ingest` edge function does NOT use this helper — it calls the
 * `ingest_memory_event` RPC directly because it owns the full request/
 * response envelope (auth, idempotency, body validation, structured response
 * shape). This helper is for callers that already have a verified userId
 * and a service-role client in scope, and want to append a memory event as
 * a fire-and-forget side effect.
 *
 * Contract per Wave 8.5 D3 (atomic triple-write):
 *   - Frontend writers go through the `memory_ingest` HTTP entry point,
 *     which validates auth + idempotency + body shape, then calls the RPC.
 *   - Server-side writers (e.g., `style_chat` detecting a preference) call
 *     this helper, which normalizes the signal name + invokes the RPC.
 *
 * Behavior:
 *   - Normalizes the legacy or canonical event_type via the P83 helper.
 *   - On unknown / dead enum signal types, returns
 *     `{ ok: false, error: 'unknown_signal_type' }` and does NOT call the RPC.
 *   - On RPC error, returns `{ ok: false, error: 'rpc_failed' }` and logs.
 *     Caller decides what to do (typically: log and continue — memory writes
 *     are not user-blocking).
 *   - On RPC success, returns
 *     `{ ok: true, signalId, eventType, pairDelta }` mirroring the RPC's
 *     response shape (camelCase per TS convention).
 *
 * The helper is pure — no Deno imports, no runtime deps beyond the supabase
 * client passed in. Bundles cleanly into any edge function consumer AND
 * runs unmodified under vitest.
 */

import {
  type CanonicalStyleMemorySignal,
  normalizeStyleMemorySignal,
} from "./style-memory-signals.ts";

/**
 * Input to `ingestMemoryEvent`. Mirrors the `memory_ingest` edge function's
 * request body shape, with camelCase keys (TS convention) and a strongly-
 * typed userId requirement.
 */
export interface IngestMemoryEventInput {
  /**
   * Verified user id (must come from a server-trusted source — a JWT
   * `getUser()` call or a system-generated id for cron jobs). Never trust
   * client-supplied user_id.
   */
  userId: string;
  /**
   * Signal type. Accepts canonical (`save_outfit`, `wear_outfit`, etc.) or
   * legacy (`save`, `wear_confirm`, etc.) names — normalization happens
   * internally via the P83 helper.
   */
  eventType: string;
  /**
   * Optional outfit id. Required for outfit-level signals (save_outfit,
   * unsave_outfit, rate_outfit, wear_outfit, skip_outfit, reject_outfit,
   * swap_garment), but the helper does not enforce this — it forwards
   * whatever the caller provides to the RPC. The RPC validates downstream.
   */
  outfitId?: string;
  /**
   * Garment ids participating in the event. Semantics vary by event_type:
   *   - save_outfit / wear_outfit / rate_outfit / etc: full outfit roster.
   *   - swap_garment: post-swap roster (kept + added).
   *   - like_pair / dislike_pair: exactly 2 ids.
   *   - never_suggest_garment: single id (the target).
   *   - quick_reaction: 0+ ids depending on UI surface.
   */
  garmentIds?: string[];
  /** swap_garment: ids removed from the outfit. */
  removedGarmentIds?: string[];
  /** swap_garment: ids added to the outfit. */
  addedGarmentIds?: string[];
  /** rate_outfit: 1-5 star value. */
  rating?: number;
  /** Optional free-text feedback (rejected outfit explanation, etc.). */
  feedbackText?: string;
  /**
   * Optional explicit value carrying direction or polarity. For
   * quick_reaction, expected values are
   * `'like'|'dislike'|'positive'|'negative'|'thumbs_up'|'thumbs_down'`. The
   * RPC reads this to derive pair-memory delta.
   */
  value?: string;
  /**
   * Free-form metadata bag. Caller-provided keys win on collision with the
   * RPC's auto-injected fields (garment_ids, removed_garment_ids, etc).
   */
  metadata?: Record<string, unknown>;
  /**
   * Analytics tag identifying the call site (e.g., 'OutfitDetail',
   * 'style_chat:never_suggest', 'BackfillCron'). Stored in
   * feedback_signals.metadata.source.
   */
  source?: string;
}

/**
 * Result of `ingestMemoryEvent`. Discriminated union — callers branch on
 * `ok` and check `error` for failure cases.
 */
export type IngestMemoryEventResult =
  | {
      ok: true;
      signalId: string;
      eventType: CanonicalStyleMemorySignal;
      pairDelta: number;
    }
  | {
      ok: false;
      error: "unknown_signal_type" | "rpc_failed";
      /**
       * Original (un-normalized) input value when error is `unknown_signal_type`.
       * Useful for the caller's log/telemetry.
       */
      originalEventType?: string;
      /**
       * Underlying RPC error message when error is `rpc_failed`. Surface only
       * to logs — never propagate to client responses.
       */
      message?: string;
    };

/**
 * Loose type for the supabase client. Accepts the service-role client from
 * `@supabase/supabase-js` without forcing edge consumers to import the SDK
 * type. The helper only uses `.rpc(...)`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ServiceClient = any;

/**
 * Atomically write a Style Memory signal (feedback_signals + garment_pair_
 * memory + summary dirty-mark) via the `ingest_memory_event` Postgres RPC.
 *
 * Caller responsibilities:
 *   1. Verify `userId` from a trusted source (JWT, system context).
 *   2. Provide a service-role supabase client (the RPC is GRANT'd EXECUTE
 *      to service_role only).
 *   3. Wrap the call in fire-and-forget semantics if user-facing latency
 *      matters — most callers will await + log + continue regardless of
 *      result.
 */
export async function ingestMemoryEvent(
  serviceClient: ServiceClient,
  input: IngestMemoryEventInput,
): Promise<IngestMemoryEventResult> {
  const canonical = normalizeStyleMemorySignal(input.eventType);
  if (!canonical) {
    console.warn(
      "[style-memory-ingest] dropping event with unknown signal_type:",
      input.eventType,
    );
    return {
      ok: false,
      error: "unknown_signal_type",
      originalEventType: input.eventType,
    };
  }

  const rpcArgs = {
    p_user_id: input.userId,
    p_event_type: canonical,
    p_outfit_id: input.outfitId ?? null,
    p_garment_ids: input.garmentIds ?? [],
    p_removed_garment_ids: input.removedGarmentIds ?? [],
    p_added_garment_ids: input.addedGarmentIds ?? [],
    p_rating: typeof input.rating === "number" ? input.rating : null,
    p_feedback_text: input.feedbackText ?? null,
    p_value: input.value ?? null,
    p_metadata: input.metadata ?? {},
    p_source: input.source ?? null,
  };

  try {
    const { data, error } = await serviceClient.rpc(
      "ingest_memory_event",
      rpcArgs,
    );
    if (error) {
      const message =
        typeof error === "object" && error !== null && "message" in error
          ? String((error as { message?: unknown }).message ?? error)
          : String(error);
      console.error(
        "[style-memory-ingest] ingest_memory_event RPC error:",
        message,
      );
      return { ok: false, error: "rpc_failed", message };
    }

    // RPC returns jsonb: { ok, signal_id, event_type, pair_delta }.
    // Coerce defensively because the RPC's return shape is dynamic.
    const result = data as
      | {
          ok?: unknown;
          signal_id?: unknown;
          event_type?: unknown;
          pair_delta?: unknown;
        }
      | null
      | undefined;

    if (!result || result.ok !== true) {
      console.error(
        "[style-memory-ingest] ingest_memory_event returned non-ok:",
        result,
      );
      return {
        ok: false,
        error: "rpc_failed",
        message: "RPC returned non-ok",
      };
    }

    return {
      ok: true,
      signalId: typeof result.signal_id === "string" ? result.signal_id : "",
      eventType: canonical,
      pairDelta:
        typeof result.pair_delta === "number" ? result.pair_delta : 0,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      "[style-memory-ingest] ingest_memory_event threw:",
      message,
    );
    return { ok: false, error: "rpc_failed", message };
  }
}
