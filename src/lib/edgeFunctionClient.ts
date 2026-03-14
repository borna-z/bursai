/**
 * Resilient edge function invocation with timeout, retry, and exponential backoff.
 */
import { supabase } from '@/integrations/supabase/client';

interface InvokeOptions {
  /** Max time in ms before aborting (default: 25000) */
  timeout?: number;
  /** Number of retries on failure (default: 2) */
  retries?: number;
  /** Request body */
  body?: Record<string, unknown>;
}

export class EdgeFunctionTimeoutError extends Error {
  constructor(fnName: string) {
    super(`Edge function "${fnName}" timed out`);
    this.name = 'EdgeFunctionTimeoutError';
  }
}

/**
 * Invoke an edge function with automatic timeout and retry.
 */
export async function invokeEdgeFunction<T = unknown>(
  functionName: string,
  opts: InvokeOptions = {}
): Promise<{ data: T | null; error: Error | null }> {
  const { timeout = 25000, retries = 2, body } = opts;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      // Exponential backoff: 1s, 2s, 4s...
      await new Promise((r) => setTimeout(r, Math.min(1000 * 2 ** (attempt - 1), 8000)));
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: body ? JSON.stringify(body) : undefined,
        headers: { 'Content-Type': 'application/json' },
      });

      clearTimeout(timer);

      if (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        continue; // retry
      }

      return { data: data as T, error: null };
    } catch (err) {
      clearTimeout(timer);

      if (controller.signal.aborted) {
        lastError = new EdgeFunctionTimeoutError(functionName);
      } else {
        lastError = err instanceof Error ? err : new Error(String(err));
      }

      // Don't retry on timeout — likely the function is genuinely slow
      if (lastError instanceof EdgeFunctionTimeoutError && attempt >= 1) {
        break;
      }
    }
  }

  return { data: null, error: lastError };
}
