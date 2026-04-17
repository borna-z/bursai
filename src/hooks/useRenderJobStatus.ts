import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

type JobStatus = 'pending' | 'in_progress' | 'succeeded' | 'failed' | 'not_found' | 'poll_timeout';

export interface RenderJobStatus {
  /** `null` before the first successful query. Not a terminal — poller is still
      warming up or the row hasn't committed yet. */
  jobId: string | null;
  status: JobStatus;
  errorClass: string | null;
  resultPath: string | null;
  attempts: number;
}

interface Options {
  /** Poll interval in ms while the job is non-terminal. Default 3000. */
  pollIntervalMs?: number;
  /** Hard ceiling on total polling duration (ms). Default 30 minutes —
      generous because renders can extend via retry × backoff. */
  maxPollDurationMs?: number;
  /** How many consecutive "no row found" responses before we give up on
      the enqueue-ever-landing and transition to `not_found`. Default 10
      (≈ 30s at the 3s poll interval). The row is normally visible on the
      first poll because enqueue returns after the commit, but there are
      rare races (read-your-own-writes cache lag, concurrent enqueue +
      immediate mount) where the first poll sees nothing. */
  maxEmptyPolls?: number;
}

/**
 * Polls the latest `render_jobs` row for a garment every `pollIntervalMs`
 * while status ∈ {pending, in_progress}. Returns terminal state (succeeded
 * | failed) once reached. If the row never appears within `maxEmptyPolls`,
 * emits `not_found`. If the overall duration exceeds `maxPollDurationMs`,
 * emits `poll_timeout`.
 *
 * Visual state note: callers should treat `pending` and `in_progress`
 * identically — both render the same "Creating studio version…" UI. The
 * distinction is for server-side worker coordination only.
 */
export function useRenderJobStatus(
  garmentId: string | null | undefined,
  options: Options = {},
): RenderJobStatus | null {
  const pollIntervalMs = options.pollIntervalMs ?? 3000;
  const maxPollDurationMs = options.maxPollDurationMs ?? 30 * 60 * 1000;
  const maxEmptyPolls = options.maxEmptyPolls ?? 10;
  const [status, setStatus] = useState<RenderJobStatus | null>(null);

  useEffect(() => {
    if (!garmentId) {
      setStatus(null);
      return;
    }

    let cancelled = false;
    let emptyPollCount = 0;
    const startedAt = Date.now();

    async function fetchOnce(): Promise<boolean /* should keep polling */> {
      if (Date.now() - startedAt >= maxPollDurationMs) {
        setStatus((prev) => ({
          jobId: prev?.jobId ?? null,
          status: 'poll_timeout',
          errorClass: prev?.errorClass ?? null,
          resultPath: prev?.resultPath ?? null,
          attempts: prev?.attempts ?? 0,
        }));
        return false;
      }

      const { data, error } = await supabase
        .from('render_jobs')
        .select('id, status, error_class, result_path, attempts')
        .eq('garment_id', garmentId as string)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cancelled) return false;

      if (error) {
        // Transient query error. Don't give up — the next tick may succeed.
        // Counts toward the empty-poll budget so a persistently broken
        // connection still terminates eventually.
        emptyPollCount += 1;
        if (emptyPollCount >= maxEmptyPolls) {
          setStatus({
            jobId: null,
            status: 'not_found',
            errorClass: null,
            resultPath: null,
            attempts: 0,
          });
          return false;
        }
        return true;
      }

      if (!data) {
        // Row not yet visible. Expected on the first poll or two when a
        // fresh enqueue is racing the read. Keep polling until the budget
        // exhausts — see maxEmptyPolls.
        emptyPollCount += 1;
        if (emptyPollCount >= maxEmptyPolls) {
          setStatus({
            jobId: null,
            status: 'not_found',
            errorClass: null,
            resultPath: null,
            attempts: 0,
          });
          return false;
        }
        return true;
      }

      // Got a row. Reset the empty-poll counter — any future empty reads
      // would be a genuine data loss, not a startup race.
      emptyPollCount = 0;

      const next: RenderJobStatus = {
        jobId: data.id,
        status: data.status as JobStatus,
        errorClass: data.error_class ?? null,
        resultPath: data.result_path ?? null,
        attempts: data.attempts ?? 0,
      };
      setStatus(next);

      return next.status === 'pending' || next.status === 'in_progress';
    }

    let timer: ReturnType<typeof setTimeout> | null = null;

    async function tick() {
      if (cancelled) return;
      const shouldContinue = await fetchOnce();
      if (cancelled) return;
      if (shouldContinue) {
        timer = setTimeout(tick, pollIntervalMs);
      }
    }

    void tick();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [garmentId, pollIntervalMs, maxPollDurationMs, maxEmptyPolls]);

  return status;
}
