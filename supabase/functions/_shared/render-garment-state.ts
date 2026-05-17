// Phase 5e — `render_garment_image` lifecycle DB helpers.
//
// Extracted from `render_garment_image/index.ts` to bring the orchestrator
// below the spec's 1100-line ceiling AND make the contention / idempotency
// guards unit-testable without a full edge-function harness.
//
// Behaviour is a verbatim port of the inline helpers — no new transactions,
// no semantic changes. The orchestrator owns HTTP/CORS/auth, eligibility,
// credit consumption, Gemini calls, validation, retry orchestration, and
// response shaping; this module owns ONLY the four `garments`-table writes
// that gate concurrent invocations.

import type { MannequinPresentation } from './render-prompt-builder.ts';

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error ?? 'Unknown error');
}

/**
 * Unconditional `garments` row update. Throws (with `context` prefix) on
 * DB error so the orchestrator can route through its standard try/catch.
 * No status guard — the caller decides which transition is valid.
 */
export async function updateGarmentRenderState(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- supabase-js
  // generic narrowing (same as calendar.ts + prefetch_suggestions). `.update()`
  // / `.from()` narrow to `never` here when the caller passes the real
  // service-role client, breaking deno-check on every write. Runtime
  // behaviour is unchanged.
  supabase: any,
  garmentId: string,
  updates: Record<string, unknown>,
  context: string,
): Promise<void> {
  const { error } = await supabase.from('garments').update(updates).eq('id', garmentId);
  if (error) {
    throw new Error(`${context}: ${error.message}`);
  }
}

/**
 * Atomic claim — flips `render_status` to `'rendering'` IFF the row is in
 * one of the allowed prior states. Returns true when the row was claimed,
 * false when another invocation already won the race (or the row was in a
 * state the caller did not authorise for transition).
 *
 * Contention is enforced by the `.eq('id', ...).in('render_status', ...)`
 * filter — Postgres applies the WHERE clause atomically against the UPDATE,
 * so two concurrent callers cannot both write `'rendering'`. The `.select`
 * + `.maybeSingle` returns the row's id only when the UPDATE actually
 * matched a row.
 *
 * Contract: this signature returns `Promise<boolean>` (not `{ ok, row }`) —
 * the orchestrator's callers use the return value directly as the
 * if-claimed gate. Don't refactor into a value object without updating all
 * call sites in render_garment_image/index.ts.
 */
export async function claimGarmentRender(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  garmentId: string,
  mannequinPresentation: MannequinPresentation,
  force?: boolean,
): Promise<boolean> {
  const allowedStatuses = force
    ? ['pending', 'failed', 'none', 'skipped', 'ready']
    : ['pending', 'failed', 'none'];

  const { data, error } = await supabase
    .from('garments')
    .update({
      render_status: 'rendering',
      render_presentation_used: mannequinPresentation,
      render_error: null,
      render_provider: 'gemini',
    })
    .eq('id', garmentId)
    .in('render_status', allowedStatuses)
    .select('id')
    .maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data?.id);
}

/**
 * Terminal failure write. Writes `render_status='failed'` plus any caller
 * updates to the garment row. Normal-path success produces NO log entry —
 * marking failed is the expected terminal state for several legitimate
 * paths (rate limit, validator reject, transient error after retries),
 * not an observability event. Logs only when persisting the failure state
 * ITSELF errors or throws — those are the operational concerns.
 */
export async function safeMarkRenderFailed(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  garmentId: string,
  updates: Record<string, unknown>,
  context: string,
): Promise<void> {
  try {
    const { error } = await supabase.from('garments').update({
      render_status: 'failed',
      render_provider: 'gemini',
      ...updates,
    }).eq('id', garmentId);

    if (error) {
      console.error('render_garment_image failed to persist failure state', {
        garmentId,
        context,
        updateError: error.message,
        attemptedRenderError: updates.render_error,
      });
    }
  } catch (updateError) {
    console.error('render_garment_image failure-state update crashed', {
      garmentId,
      context,
      updateError: getErrorMessage(updateError),
      attemptedRenderError: updates.render_error,
    });
  }
}

/**
 * Idempotent retry-path terminal: when a force re-render fails AND a prior
 * good render exists, restore the prior image so the user's wardrobe is
 * not left in a degraded state. Falls back to `safeMarkRenderFailed` when
 * there is no prior image to restore (regular non-force failure, or force
 * with no prior render).
 *
 * Calling twice in succession with the same arguments converges to the
 * same row state — both branches issue an unconditional update that the
 * caller can safely retry.
 */
export async function safeRestoreOrFailRender(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  garmentId: string,
  updates: Record<string, unknown>,
  context: string,
  priorRenderedPath: string | null,
  isForce: boolean,
): Promise<void> {
  if (isForce && priorRenderedPath) {
    console.warn('render_garment_image force-render failed; restoring prior render', {
      garmentId,
      context,
      priorRenderedPath,
      renderError: updates.render_error,
    });
    try {
      const { error } = await supabase.from('garments').update({
        render_status: 'ready',
        render_provider: 'gemini',
        rendered_image_path: priorRenderedPath,
        image_path: priorRenderedPath,
        render_error: null,
      }).eq('id', garmentId);
      if (error) {
        console.error('render_garment_image failed to restore prior render', {
          garmentId,
          context,
          updateError: error.message,
        });
      }
    } catch (restoreError) {
      console.error('render_garment_image prior-render restore crashed', {
        garmentId,
        context,
        restoreError: getErrorMessage(restoreError),
      });
    }
  } else {
    await safeMarkRenderFailed(supabase, garmentId, updates, context);
  }
}

export interface PriorRenderState {
  render_status: string | null;
  render_error: string | null;
  render_presentation_used: string | null;
  render_provider: string | null;
}

/**
 * Best-effort restore of the pre-claim render-state snapshot. Used on paths
 * where claim succeeded but a subsequent step (reserve, replay) failed and
 * we need to release the row without destroying the user's prior 'ready'
 * render or a queued 'pending'/'skipped' intent.
 *
 * Preserves prior state verbatim when it was:
 *   - 'ready'   : successful prior render the client still sees
 *   - 'skipped' : eligibility gate decided no render was needed
 *   - 'pending' : a queued render intent kicked off elsewhere that
 *                 we haven't yet executed — resetting to 'none' would
 *                 silently drop the queue entry for that garment
 * All other prior states (failed, none, rendering) get reset to 'none'
 * so the user (or a retry) can re-attempt cleanly.
 *
 * Errors are logged but never thrown — this runs on unhappy paths where the
 * caller's primary failure mode has already produced the user-visible
 * response.
 */
export async function restorePriorRenderState(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  garmentId: string,
  priorState: PriorRenderState,
  reason: string,
): Promise<void> {
  const restoredStatus = (
    priorState.render_status === 'ready'
    || priorState.render_status === 'skipped'
    || priorState.render_status === 'pending'
  )
    ? priorState.render_status
    : 'none';
  const { error: unclaimError } = await supabase
    .from('garments')
    .update({
      render_status: restoredStatus,
      render_error: priorState.render_error,
      render_presentation_used: priorState.render_presentation_used,
      render_provider: priorState.render_provider,
    })
    .eq('id', garmentId);
  if (unclaimError) {
    console.error('render_garment_image prior-state restore failed', {
      garmentId,
      reason,
      restoredStatus,
      priorStatus: priorState.render_status,
      error: unclaimError.message,
    });
  }
}
