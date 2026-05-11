// Polls the latest `render_jobs` row for a garment until status is terminal
// (`succeeded` / `failed`). On any terminal flip we invalidate the cached
// `garments` lists and the single `['garment', user?.id, garmentId]` entry so
// the wardrobe + detail surfaces refetch and swap from `original_image_path`
// to `rendered_image_path` without a manual pull-to-refresh.
//
// Mobile differences vs `src/hooks/useRenderJobStatus.ts`:
//   • TanStack `useQuery` with `refetchInterval` instead of a hand-rolled
//     `setTimeout` loop. Cache, retry, and devtools fall out of the standard
//     primitive — same shape as `useGarment`, `useInsightsDashboard`, etc.
//   • `enabled: !!garmentId` plus `refetchInterval` returning `false` once the
//     row is terminal mean the query stops itself; no manual cancellation.
//
// No global timeout. An earlier revision short-circuited polling at 90 s with
// a synthetic `poll_timeout` snapshot, but that produced a real UX bug: if
// the worker completed *after* the local budget, the cached garment row was
// never invalidated and the hero stayed on the original photo until manual
// refresh or cache eviction. (Codex P2 round 4 on PR #728.) Polling stops
// naturally when:
//   • `render_jobs.status` reaches `succeeded` / `failed` server-side, OR
//   • the caller disables the hook by passing `null` for `garmentId` — which
//     `GarmentDetailScreen` does as soon as the garment row's `render_status`
//     leaves `pending` / `rendering`.
//
// Empty-poll handling: when no `render_jobs` row appears after `maxEmptyPolls`
// consecutive empty reads (~30 s default), the most plausible explanation is
// that `enqueue_render_job` failed before inserting the row (402, transport
// error, etc.) and `useAddGarment.resetRenderStatusOnEnqueueFailure` has
// since rewritten `garments.render_status` to `'none'` server-side — but the
// cached row may still hold the original `'pending'` write. We invalidate
// the garment caches as a SIDE EFFECT and reset the budget; we do NOT mark
// the snapshot terminal. (Codex P2 round 5 + round 7 on PR #728: an earlier
// revision used a `'not_found'` terminal snapshot, but that latched the
// `['render_job', garmentId]` cache on a slow-but-not-failed enqueue — once
// the row finally appeared, refetchInterval was already false for that key
// and polling never resumed.) After invalidation:
//   • If the server has reset to `'none'`, `useGarment` refetches, the
//     screen's gate flips off, and the hook is disabled by the caller.
//   • If the server is still `'pending'` (slow enqueue), polling continues
//     and the next 30 s window may catch the inserted row normally.
//
// `render_jobs.status` enum is `pending | in_progress | succeeded | failed`;
// `garments.render_status` is the parallel column on the garment row that web
// surfaces flip to `'ready'` when the worker writes the rendered image. Mobile
// reads `rendered_image_path ?? original_image_path` everywhere, so flipping
// the cache is what swaps the picture — we don't need to read render_status
// directly here.

import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { bustSignedUrlCache } from './useSignedUrl';

export type RenderJobTerminalStatus = 'succeeded' | 'failed';
export type RenderJobStatus = 'pending' | 'in_progress' | RenderJobTerminalStatus;

export interface RenderJobSnapshot {
  jobId: string | null;
  status: RenderJobStatus;
  errorClass: string | null;
  resultPath: string | null;
  attempts: number;
}

interface Options {
  /** Poll interval in ms while the job is non-terminal. Default 3000. */
  pollIntervalMs?: number;
  /** Consecutive empty reads (no `render_jobs` row for the garment) before the
   *  hook side-effect-invalidates the garment cache and resets the empty-poll
   *  budget. Default 10 (~30 s at the 3 s default poll interval). The hook
   *  keeps polling — the invalidation lets the screen pick up a server-side
   *  `render_status='none'` reset (slow-enqueue failure path) without
   *  latching the local poller against a row that lands a few seconds later. */
  maxEmptyPolls?: number;
}

const TERMINAL_STATUSES: ReadonlySet<RenderJobStatus> = new Set<RenderJobStatus>([
  'succeeded',
  'failed',
]);

export function isTerminalRenderStatus(status: RenderJobStatus | null | undefined): boolean {
  return !!status && TERMINAL_STATUSES.has(status);
}

/**
 * `garments.render_status` is the parallel column the worker writes alongside
 * the job row. Active states are `pending` (enqueued, not claimed) and
 * `rendering` (worker has claimed). Both must be treated as in-flight — the
 * web app does the same in 7+ places (`useGarments.ts`, `GarmentCardSystem`,
 * `RenderPendingOverlay`, etc.). Without this helper a mobile screen that
 * gates only on 'pending' will fail to show progress when the user opens
 * GarmentDetail after the worker has already advanced the row to 'rendering'.
 */
export function isActiveGarmentRenderStatus(renderStatus: string | null | undefined): boolean {
  return renderStatus === 'pending' || renderStatus === 'rendering';
}

/**
 * Hook returns:
 *   • `null` while the row hasn't been observed yet (first poll racing the
 *     `enqueue_render_job` insert) — caller should treat as "still warming up".
 *   • A `RenderJobSnapshot` with `status` once the row is visible. Polling
 *     continues until the snapshot is terminal.
 */
export function useRenderJobStatus(
  garmentId: string | null | undefined,
  options: Options = {},
): RenderJobSnapshot | null {
  const { user } = useAuth();
  const qc = useQueryClient();
  const pollIntervalMs = options.pollIntervalMs ?? 3000;
  const maxEmptyPolls = options.maxEmptyPolls ?? 10;

  // Track the previous terminal state so the invalidation effect only fires
  // once per success — not on every render after the snapshot lands.
  const lastTerminalRef = useRef<RenderJobStatus | null>(null);

  // Count consecutive empty polls so we can give up if the enqueue failed
  // before the row could commit. Reset on garmentId change AND on the first
  // sighting of a row (so a brief read-your-own-writes lag doesn't poison
  // the count for a row that does eventually appear).
  const emptyPollsRef = useRef<number>(0);

  const query = useQuery<RenderJobSnapshot | null>({
    // N14/F6 — user-scoped key for consistency with the rest of the mobile
    // cache (`['garment', user?.id, id]`). No callers read this key directly,
    // so the rename is internal-only.
    queryKey: ['render_job', user?.id, garmentId],
    queryFn: async () => {
      if (!garmentId) return null;

      const { data, error } = await supabase
        .from('render_jobs')
        .select('id, status, error_class, result_path, attempts')
        .eq('garment_id', garmentId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        // Row not yet visible. Expected on the first poll right after
        // `enqueue_render_job` returns — supabase-js's read-your-own-writes
        // window is tiny but non-zero. After `maxEmptyPolls` (~30 s default),
        // invalidate the garment cache so a server-side
        // `render_status='none'` reset (slow-enqueue failure path) gets
        // picked up by `useGarment` and the screen's gate disables this
        // hook. Reset the budget so polling continues — if the row simply
        // landed late, the next window catches it normally. (Codex round 7.)
        emptyPollsRef.current += 1;
        if (emptyPollsRef.current >= maxEmptyPolls) {
          emptyPollsRef.current = 0;
          qc.invalidateQueries({ queryKey: ['garments'] });
          if (garmentId) {
            qc.invalidateQueries({ queryKey: ['garment', user?.id, garmentId] });
          }
        }
        return null;
      }

      // Row exists — clear the empty-poll latch so a transient mid-run blip
      // (impossible today, since rows aren't deleted, but defensive) wouldn't
      // count toward the budget for the rest of the session.
      emptyPollsRef.current = 0;

      return {
        jobId: data.id,
        status: data.status as RenderJobStatus,
        errorClass: data.error_class ?? null,
        resultPath: data.result_path ?? null,
        attempts: data.attempts ?? 0,
      };
    },
    enabled: !!garmentId,
    // Returning `false` halts polling once the snapshot is terminal. While the
    // row is missing (snapshot === null) or non-terminal, keep ticking.
    refetchInterval: (q) => {
      const status = q.state.data?.status ?? null;
      if (isTerminalRenderStatus(status)) return false;
      return pollIntervalMs;
    },
    refetchIntervalInBackground: false,
    // Don't surface stale terminal snapshots on remount — re-poll the row.
    staleTime: 0,
    gcTime: 60_000,
  });

  // On any terminal status (`succeeded` / `failed`), refetch the garment +
  // every cached garments list. `succeeded` is the obvious case (image swaps
  // to rendered_image_path); `failed` also needs invalidation because the
  // worker writes `garments.render_status='failed'` on terminal failure, and
  // a force-retry path on the server can transition the row back to 'ready'.
  // Without an invalidate on the failed branch, the cached row stays at
  // 'pending' / 'rendering' indefinitely and the "Studio render…" pill spins
  // forever until pull-to-refresh. (Codex P2 round 2 on PR #728.)
  useEffect(() => {
    const status = query.data?.status ?? null;
    if (!status || !isTerminalRenderStatus(status)) return;
    if (lastTerminalRef.current === status) return;
    lastTerminalRef.current = status;

    // Drop the signed-URL cache entry for the worker's `result_path` before
    // refetching the garment row. `render_garment_image` upserts the rendered
    // image at a stable path (`${user_id}/${garment.id}/rendered.ext`); the
    // M2 module-scope cache is keyed on path alone, so without this bust the
    // next `useSignedUrl` read would hand `<Image>` the prior signed URL and
    // RN's native image cache could keep serving the old bytes after a
    // regenerated render. (Codex P2 round 1 on PR #729.)
    const resultPath = query.data?.resultPath ?? null;
    if (resultPath) {
      bustSignedUrlCache(qc, resultPath);
    }

    qc.invalidateQueries({ queryKey: ['garments'] });
    if (garmentId) {
      qc.invalidateQueries({ queryKey: ['garment', user?.id, garmentId] });
    }
  }, [query.data?.status, query.data?.resultPath, qc, user?.id, garmentId]);

  // Reset the terminal + empty-poll latches whenever we switch garments so a
  // subsequent success / no-row on a different garmentId still triggers the
  // right branch. Without this, navigating between two pending garments in
  // the same hook instance would inherit the prior garment's empty count.
  useEffect(() => {
    lastTerminalRef.current = null;
    emptyPollsRef.current = 0;
  }, [garmentId]);

  return query.data ?? null;
}
