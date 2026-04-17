import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

type JobStatus = 'pending' | 'in_progress' | 'succeeded' | 'failed';

export interface RenderJobStatus {
  jobId: string;
  status: JobStatus;
  errorClass: string | null;
  resultPath: string | null;
  attempts: number;
}

interface Options {
  /** Poll interval in ms while the job is non-terminal. Default 3000. */
  pollIntervalMs?: number;
  /** Hard ceiling on total polling duration (ms). Default 5 minutes. Prevents
      a stuck-in-UI poll from running forever if the server-side job goes dark. */
  maxPollDurationMs?: number;
}

/**
 * Polls the latest `render_jobs` row for a garment every `pollIntervalMs`
 * while status ∈ {pending, in_progress}. Returns terminal state (succeeded |
 * failed) once reached.
 *
 * Used by garment card / detail page components to show the "Creating studio
 * version…" state and react when the render lands. Falls back gracefully when
 * no render job exists (returns null).
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
  const maxPollDurationMs = options.maxPollDurationMs ?? 5 * 60 * 1000;
  const [status, setStatus] = useState<RenderJobStatus | null>(null);

  useEffect(() => {
    if (!garmentId) {
      setStatus(null);
      return;
    }

    let cancelled = false;
    const startedAt = Date.now();

    async function fetchOnce(): Promise<boolean /* should keep polling */> {
      const { data, error } = await supabase
        .from('render_jobs')
        .select('id, status, error_class, result_path, attempts')
        .eq('garment_id', garmentId as string)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cancelled) return false;

      if (error || !data) {
        // No job yet — caller should decide whether to retry based on garment
        // render_status. Don't loop forever on missing rows.
        setStatus(null);
        return false;
      }

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
      if (shouldContinue && Date.now() - startedAt < maxPollDurationMs) {
        timer = setTimeout(tick, pollIntervalMs);
      }
    }

    void tick();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [garmentId, pollIntervalMs, maxPollDurationMs]);

  return status;
}
