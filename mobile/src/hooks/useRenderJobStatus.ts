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
// the garment caches as a SIDE EFFECT and reset the per-window budget; we
// do NOT mark the snapshot terminal on the first window. (Codex P2 round 5
// + round 7 on PR #728: an earlier revision used a `'not_found'` terminal
// snapshot on the very first window, but that latched the
// `['render_job', garmentId]` cache on a slow-but-not-failed enqueue — once
// the row finally appeared, refetchInterval was already false for that key
// and polling never resumed.) After the first-window invalidation:
//   • If the server has reset to `'none'`, `useGarment` refetches, the
//     screen's gate flips off, and the hook is disabled by the caller.
//   • If the server is still `'pending'` (slow enqueue), polling continues
//     and the next 30 s window may catch the inserted row normally.
//
// Cross-window terminal: after `maxEmptyPollWindows` consecutive full
// empty-poll windows (default 3 → ~90 s past `enqueue_render_job`), we DO
// emit a synthetic `'failed'` snapshot. By that point pg_cron's 60 s safety
// net AND the worker-kickoff retry budget have both passed; the row will
// not materialize. Without this, a rare server-side inconsistency (garments
// row stuck at `render_status='pending'` AND no render_jobs row) leaves the
// "Studio render…" pill spinning forever because the consumer's gate never
// flips off. The synthetic snapshot trips the existing terminal-status
// invalidation effect and reports `errorClass: 'enqueue_lost'` so consumers
// can show distinct copy from a worker-side failure.
//
// `render_jobs.status` enum is `pending | in_progress | succeeded | failed`;
// `garments.render_status` is the parallel column on the garment row that web
// surfaces flip to `'ready'` when the worker writes the rendered image. Mobile
// reads `rendered_image_path ?? original_image_path` everywhere, so flipping
// the cache is what swaps the picture — we don't need to read render_status
// directly here.

import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';

import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { bustSignedUrlCache } from './useSignedUrl';

export type RenderJobTerminalStatus = 'succeeded' | 'failed';
export type RenderJobStatus = 'pending' | 'in_progress' | RenderJobTerminalStatus;

// Sentinel `errorClass` value emitted by the synthetic-failed code path
// (cross-window empty-poll cutoff). Distinguishes a client-side give-up
// from a real worker-side failure so the terminal useEffect can skip the
// "refetch the garment row from server" step that would otherwise undo the
// local cache patch with the stuck-pending server state.
const SYNTHETIC_ENQUEUE_LOST = 'enqueue_lost';

// Minimal garment-row shape we touch when patching the cache locally. Matches
// the columns GarmentDetailScreen reads to derive `isStudioRendering` /
// `isStudioFailed`. Cast through `unknown` at the setQueryData boundary so
// we don't have to import the full Garment type just to write two fields.
interface GarmentRenderPatch {
  render_status: 'failed';
  render_error: string;
}

// Flip the local garment cache so the consumer's gate (which reads
// `garment.render_status`, NOT the hook's return) actually disables this
// hook. We intentionally do NOT invalidate the garment query afterwards —
// the server row is stuck at 'pending' (that's the whole reason we ended up
// here), so refetching would just overwrite this patch with the stale
// state. A future legitimate render attempt or pull-to-refresh resyncs.
function patchGarmentToEnqueueLost(
  qc: QueryClient,
  userId: string | undefined,
  garmentId: string,
): void {
  const patch: GarmentRenderPatch = {
    render_status: 'failed',
    render_error: 'enqueue_lost',
  };
  qc.setQueryData(
    ['garment', userId, garmentId],
    (prev: unknown) =>
      prev && typeof prev === 'object'
        ? { ...(prev as Record<string, unknown>), ...patch }
        : prev,
  );
  // List caches (wardrobe / laundry / search): patch the matching row in any
  // currently-cached page so the badge flips on remount. Structure mirrors
  // useGarments.patchGarmentInCaches.
  qc.setQueriesData<unknown>(
    { queryKey: ['garments', userId] },
    (prev: unknown) => {
      if (!prev || typeof prev !== 'object') return prev;
      const root = prev as { pages?: { items?: { id?: string }[] }[] };
      const pages = root.pages;
      if (!Array.isArray(pages)) return prev;
      let mutated = false;
      const nextPages = pages.map((page) => {
        const items = page?.items;
        if (!Array.isArray(items)) return page;
        let pageChanged = false;
        const nextItems = items.map((g) => {
          if (g?.id !== garmentId) return g;
          pageChanged = true;
          mutated = true;
          return { ...(g as Record<string, unknown>), ...patch };
        });
        return pageChanged ? { ...page, items: nextItems } : page;
      });
      return mutated ? { ...root, pages: nextPages } : prev;
    },
  );
}

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
  /** Consecutive empty-poll WINDOWS (each of `maxEmptyPolls` reads) before the
   *  hook emits a synthetic `'failed'` snapshot so the spinner doesn't stick
   *  forever. Default 3 — i.e. ~90 s of no `render_jobs` row past
   *  `enqueue_render_job`, which is past both pg_cron's 60 s safety net and
   *  the worker-kickoff retry budget. Test callers can lower this to force
   *  the synthetic-terminal path. */
  maxEmptyPollWindows?: number;
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
  const maxEmptyPollWindows = options.maxEmptyPollWindows ?? 3;

  // Track the previous terminal state so the invalidation effect only fires
  // once per success — not on every render after the snapshot lands.
  const lastTerminalRef = useRef<RenderJobStatus | null>(null);

  // Count consecutive empty polls within the current window so we can side-
  // effect-invalidate the garment cache. Reset on garmentId change AND on
  // the first sighting of a row (so a brief read-your-own-writes lag doesn't
  // poison the count for a row that does eventually appear).
  const emptyPollsRef = useRef<number>(0);

  // Count completed empty-poll windows so we can give up entirely after
  // `maxEmptyPollWindows` of them (~90 s by default). Past that point the
  // row truly will not appear and the consumer's gate needs a terminal
  // snapshot to flip off.
  const emptyPollWindowsRef = useRef<number>(0);

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
        // hook. Reset the per-window budget so polling continues — if the
        // row simply landed late, the next window catches it normally.
        // (Codex round 7.) After `maxEmptyPollWindows` such windows
        // (~90 s past pg_cron's 60 s safety net + the worker-kickoff retry
        // budget), give up: emit a synthetic `'failed'` snapshot so the
        // consumer's gate flips off and the spinner stops.
        emptyPollsRef.current += 1;
        if (emptyPollsRef.current >= maxEmptyPolls) {
          emptyPollsRef.current = 0;
          emptyPollWindowsRef.current += 1;
          const isFinalWindow = emptyPollWindowsRef.current >= maxEmptyPollWindows;
          if (isFinalWindow) {
            // SYNTHETIC-FAILED PATH — skip the per-window invalidation here.
            // invalidateQueries refetches active queries by default, and the
            // stuck-pending server row would overwrite the local patch we
            // are about to apply, leaving the spinner stuck while the poller
            // has already halted (Codex P1 round 2 on PR #835). The patch
            // below is the authoritative cache update for this terminal.
            //
            // The consumer (GarmentDetailScreen) gates the spinner off
            // `garment.render_status`, not this hook's return value, so
            // the patch must hit BEFORE we return the synthetic snapshot.
            if (garmentId) {
              patchGarmentToEnqueueLost(qc, user?.id, garmentId);
            }
            return {
              jobId: null,
              status: 'failed',
              errorClass: SYNTHETIC_ENQUEUE_LOST,
              resultPath: null,
              attempts: 0,
            };
          }
          // Non-final empty windows: keep the original behavior of
          // invalidating the garment caches so a server-side
          // `render_status='none'` reset (slow-enqueue failure path) gets
          // picked up by `useGarment` and the screen's gate disables this
          // hook on its own. (Codex round 7.)
          qc.invalidateQueries({ queryKey: ['garments'] });
          if (garmentId) {
            qc.invalidateQueries({ queryKey: ['garment', user?.id, garmentId] });
          }
        }
        return null;
      }

      // Row exists — clear both empty-poll latches so a transient mid-run
      // blip (impossible today, since rows aren't deleted, but defensive)
      // wouldn't count toward either budget for the rest of the session.
      emptyPollsRef.current = 0;
      emptyPollWindowsRef.current = 0;

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

    // Synthetic-failed (errorClass === 'enqueue_lost') already patched the
    // garment caches locally in queryFn. Refetching them here would just
    // overwrite the patch with the stuck-pending server row — exactly the
    // state we're giving up on. Real worker-side terminals still invalidate
    // so the rendered_image_path / render_error fields land on the row.
    if (query.data?.errorClass !== SYNTHETIC_ENQUEUE_LOST) {
      qc.invalidateQueries({ queryKey: ['garments'] });
      if (garmentId) {
        qc.invalidateQueries({ queryKey: ['garment', user?.id, garmentId] });
      }
    }
  }, [
    query.data?.status,
    query.data?.resultPath,
    query.data?.errorClass,
    qc,
    user?.id,
    garmentId,
  ]);

  // Reset the terminal + empty-poll latches whenever we switch garments so a
  // subsequent success / no-row on a different garmentId still triggers the
  // right branch. Without this, navigating between two pending garments in
  // the same hook instance would inherit the prior garment's empty count
  // (or windows count) and trip the synthetic-failed path prematurely.
  useEffect(() => {
    lastTerminalRef.current = null;
    emptyPollsRef.current = 0;
    emptyPollWindowsRef.current = 0;
  }, [garmentId]);

  return query.data ?? null;
}
