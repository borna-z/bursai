/**
 * Render credit-flow orchestration — extracted from
 * `supabase/functions/render_garment_image/index.ts` (Phase 5c, 2026-05-16).
 *
 * Encapsulates the reserve / consume / release lifecycle that wraps the
 * Gemini call and the validator. Behaviour is byte-for-byte preserved
 * from the pre-extraction handler — every console message, every
 * `recordError` call, and every return shape matches what the handler
 * emitted before.
 *
 * The handler still owns the higher-level decisions (replay branching,
 * garment-state restoration, response building). This module owns:
 *   - building the namespaced ledger keys
 *   - resolving the canonical jobId (worker-supplied vs derived)
 *   - the reserveCredit call + transport-error recording
 *   - the consumeCredit call + post-render warning logging
 *   - the finally-time release for external callers only
 *   - the already-ready healing consume for the worker path
 *
 * Redeploy blast radius (per CLAUDE.md): touching `_shared/` requires
 * redeploying every dependent function. This module is imported by
 * render_garment_image AND (transitively, via shared identity) the worker
 * orchestration in process_render_jobs — both must be redeployed when
 * this file changes.
 */

import { recordError } from "./scale-guard.ts";
import {
  reserveCredit,
  consumeCredit,
  releaseCredit,
  getBalance,
  type ReserveResult,
} from "./render-credits.ts";
import { deriveRenderJobId } from "./render-job-id.ts";

// ─── Keys ──────────────────────────────────────────────────

export interface RenderCreditKeys {
  baseKey: string;
  reserveKey: string;
  consumeKey: string;
  releaseKey: string;
}

/**
 * Build a base key that uniquely identifies a logical render request
 *   user × garment × presentation × prompt_version × clientNonce
 * and namespace the three ledger operations with explicit prefixes.
 *
 * The ':' separator can't appear in UUIDs or the underscored segments,
 * so an attacker can't craft a clientNonce like "abc_consume" that makes
 * their reserve key collide with another request's consume key.
 */
export function buildRenderCreditKeys(input: {
  userId: string;
  garmentId: string;
  presentation: string;
  promptVersion: string;
  clientNonce: string;
}): RenderCreditKeys {
  const baseKey =
    `${input.userId}_${input.garmentId}_${input.presentation}_${input.promptVersion}_${input.clientNonce}`;
  return {
    baseKey,
    reserveKey: `reserve:${baseKey}`,
    consumeKey: `consume:${baseKey}`,
    releaseKey: `release:${baseKey}`,
  };
}

/**
 * Resolve the canonical `render_jobs.id` for the three ledger ops.
 *
 * P5 internal invocations supply the row's id verbatim — this is the
 * value `reserve_credit_atomic` recorded at enqueue, so consume/release
 * resolve the reserve row by the same ID. External (legacy P4) callers
 * fall back to the deterministic SHA-256 derivation from `baseKey`;
 * reserve's replay flag keeps either path idempotent against retries.
 */
export async function resolveRenderJobId(input: {
  isInternalInvocation: boolean;
  internalJobId: string | null;
  baseKey: string;
}): Promise<string> {
  if (input.isInternalInvocation) {
    return input.internalJobId as string;
  }
  return deriveRenderJobId(input.baseKey);
}

// ─── Reserve ───────────────────────────────────────────────

/**
 * Run reserveCredit and record overload-counter pressure on transport
 * failures. The handler still owns the user-facing response (restoring
 * prior garment state, the 503 / 402 body), but the side-effect on
 * `rpc_error` belongs here so every credit-ledger entry point feeds the
 * overload signal consistently.
 */
export async function reserveRenderCredit(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- supabase-js
  supabase: any,
  userId: string,
  jobId: string,
  reserveKey: string,
  context: { garmentId: string; functionName: string },
): Promise<ReserveResult> {
  const result = await reserveCredit(supabase, userId, jobId, reserveKey);

  if (!result.ok && result.reason === "rpc_error") {
    recordError(context.functionName);
    console.error("render_garment_image credit reservation failed (transport)", {
      garmentId: context.garmentId,
      userId,
      error: result.error,
    });
  }

  return result;
}

// ─── Consume ───────────────────────────────────────────────

/**
 * Consume the reservation after a successful render+upload+state-write.
 *
 * The "extremely unlikely: reserve worked but consume failed" warning
 * stays here because the handler can't usefully act on it — the user
 * already got their render, the orphaned-reservation cron will heal the
 * ledger later. Returning the raw result lets the handler set
 * `consumed = true` regardless (matches pre-extraction behaviour).
 */
export async function consumeRenderCredit(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- supabase-js
  supabase: any,
  userId: string,
  jobId: string,
  consumeKey: string,
  context: { garmentId: string },
) {
  const consumeResult = await consumeCredit(supabase, userId, jobId, consumeKey);
  if (!consumeResult.ok) {
    console.error("render_garment_image consume failed after successful render", {
      garmentId: context.garmentId,
      userId,
      reason: consumeResult.reason,
      error: consumeResult.error,
    });
  }
  return consumeResult;
}

// ─── Release ───────────────────────────────────────────────

/**
 * Finally-time release for external (direct / P4 legacy) callers.
 *
 * Preserves the pre-P5 "release-on-failure" contract that
 * SwipeableGarmentCard / GarmentConfirmSheet relied on when there was no
 * worker queue — a failed single-shot render frees its own credit
 * because nothing else will.
 *
 * Internal (P5 worker) callers NEVER release here. Reserve-until-final-
 * failure means the reservation outlives transient failures and is only
 * released when process_render_jobs terminalizes the row at
 * attempts=max_attempts. Releasing on every failed attempt would cause
 * the next retry's consume to hit the terminal-uniqueness guard
 * (already_terminal) → the render succeeds but the user isn't charged →
 * free render (Codex round 7 Bug 1).
 *
 * Idempotent: the underlying RPC short-circuits when the idempotency
 * key has already been written, so callers may invoke this safely even
 * when a prior consume already settled the reservation.
 */
export async function releaseRenderCreditOnFailure(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- supabase-js
  supabase: any,
  userId: string,
  jobId: string,
  releaseKey: string,
  context: {
    isInternalInvocation: boolean;
    consumed: boolean;
    garmentIdForFailure: string | null;
  },
): Promise<void> {
  if (context.isInternalInvocation || context.consumed) {
    return;
  }

  try {
    const releaseResult = await releaseCredit(supabase, userId, jobId, releaseKey);
    if (!releaseResult.ok && !releaseResult.duplicate) {
      console.error("render_garment_image release failed in finally", {
        garmentId: context.garmentIdForFailure,
        userId,
        reason: releaseResult.reason,
        error: releaseResult.error,
      });
    }
  } catch (releaseError) {
    console.error("render_garment_image release crashed in finally", {
      garmentId: context.garmentIdForFailure,
      error: releaseError instanceof Error ? releaseError.message : String(releaseError),
    });
  }
}

// ─── Reserve-denial response ────────────────────────────────

/**
 * Build the 402 body for `insufficient` / `no_credit_row` /
 * `no_reservation` / `already_terminal` reserve denials.
 *
 * The trial branch is decided by the user's monthly_allowance — an
 * allowance of 0 means the user is not a paying subscriber right now
 * (trialing or canceled), and the client renders the trial-locked
 * upsell instead of the buy-credits upsell.
 *
 * Returns a JSON-serialisable object plus the trial flag so the caller
 * doesn't need to re-derive either side downstream.
 */
export async function buildInsufficientCreditsBody(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- supabase-js
  supabase: any,
  userId: string,
): Promise<{
  body: Record<string, unknown>;
  isTrial: boolean;
}> {
  const balance = await getBalance(supabase, userId);
  const isTrial = balance.monthly_allowance === 0;
  return {
    body: {
      error: isTrial ? "trial_studio_locked" : "insufficient_credits",
      remaining: balance.remaining,
      is_trial: isTrial,
      monthly_allowance: balance.monthly_allowance,
      period_end: balance.period_end,
    },
    isTrial,
  };
}

// ─── Replay classification ──────────────────────────────────

export type ReplayBranch =
  | { kind: "cached"; renderedImagePath: string; renderedAt: string | null }
  | { kind: "in_progress"; reason: string }
  | { kind: "terminal"; priorStatus: string | null };

/**
 * Decide which replay branch to take for an EXTERNAL (P4 legacy)
 * caller whose reserve returned `replay: true`.
 *
 * CRITICAL: must be called with the pre-claim snapshot of
 * `render_status`, NOT a live re-fetch. The handler's own claim flips
 * the row to 'rendering' a few lines earlier; reading it back would
 * falsely report a prior failed/terminal attempt as "in progress" and
 * strand the client polling a dead request.
 *
 * The renderedImagePath captured at the initial fetch is reliable
 * because any concurrent request that finished successfully would
 * have been short-circuited by the early-return at 'ready' state.
 */
export function classifyReplayBranch(input: {
  priorRenderStatus: string | null;
  renderedImagePath: string | null;
  renderedAt: string | null;
}): ReplayBranch {
  if (input.priorRenderStatus === "ready" && input.renderedImagePath) {
    return {
      kind: "cached",
      renderedImagePath: input.renderedImagePath,
      renderedAt: input.renderedAt,
    };
  }
  if (input.priorRenderStatus === "pending" || input.priorRenderStatus === "rendering") {
    return {
      kind: "in_progress",
      reason: `Render already in progress (status=${input.priorRenderStatus})`,
    };
  }
  return { kind: "terminal", priorStatus: input.priorRenderStatus };
}

// ─── Healing consume (already-ready worker path) ─────────────

/**
 * Ledger-healing consume for the narrow worker-crash-between-render-and-
 * consume scenario:
 *
 *   garments.render_status was flipped to 'ready' in a prior attempt, but
 *   the Deno isolate crashed before the consume RPC fired. Stale recovery
 *   reset the job, the worker re-claimed it, and we observe a rendered
 *   garment with a (possibly) un-consumed reservation.
 *
 * Calling consumeCredit with the operation-prefixed consume key is
 * idempotent: if the prior attempt did consume, this hits the
 * idempotency short-circuit (duplicate=true, balance untouched). If the
 * prior attempt crashed pre-consume, this writes the consume tx and
 * moves `reserved` → `used_this_period`. Either way the ledger
 * converges.
 *
 * Non-fatal — worst case the orphan-reservation cron eventually
 * releases. Callers still report the render as successful so the worker
 * can mark the job succeeded.
 */
export async function healRenderCreditOnAlreadyReady(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- supabase-js
  supabase: any,
  userId: string,
  jobId: string,
  healBaseKey: string,
  context: { garmentId: string },
): Promise<void> {
  try {
    const healResult = await consumeCredit(
      supabase,
      userId,
      jobId,
      `consume:${healBaseKey}`,
    );
    console.log("render_garment_image already-ready healing consume", {
      garmentId: context.garmentId,
      jobId,
      healed: healResult.ok && !healResult.duplicate,
      duplicate: Boolean(healResult.duplicate),
      reason: healResult.reason,
    });
  } catch (healErr) {
    console.warn("render_garment_image healing consume threw", {
      garmentId: context.garmentId,
      jobId,
      error: healErr instanceof Error ? healErr.message : String(healErr),
    });
  }
}
