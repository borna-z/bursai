/**
 * Resilient edge function invocation with timeout, retry, and exponential backoff.
 */
import { supabase } from '@/integrations/supabase/client';
import { EDGE_FUNCTION_DEFAULT_TIMEOUT_MS, EDGE_FUNCTION_MAX_BACKOFF_MS } from '@/config/constants';

interface InvokeOptions {
  /** Max time in ms before aborting (default: 25000) */
  timeout?: number;
  /** Number of retries on failure (default: 2) */
  retries?: number;
  /** Request body */
  body?: Record<string, unknown>;
  /**
   * When true, generates a UUID idempotency key for this logical request.
   * The same key is reused across retries to prevent duplicate server-side
   * mutations. Sent as the `X-Idempotency-Key` header.
   */
  idempotent?: boolean;
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
  const { timeout = EDGE_FUNCTION_DEFAULT_TIMEOUT_MS, retries = 2, body, idempotent } = opts;

  // Generate a single idempotency key for the entire logical request (shared
  // across retries) so the server can de-duplicate mutations.
  const idempotencyKey = idempotent ? crypto.randomUUID() : undefined;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, Math.min(1000 * 2 ** (attempt - 1), EDGE_FUNCTION_MAX_BACKOFF_MS)));
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const headers: Record<string, string> = {};
      if (idempotencyKey) {
        headers['X-Idempotency-Key'] = idempotencyKey;
      }

      const { data, error } = await supabase.functions.invoke(functionName, {
        body: body ?? undefined,
        headers,
        signal: controller.signal,
      });

      if (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        continue;
      }

      return { data: data as T, error: null };
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        lastError = new EdgeFunctionTimeoutError(functionName);
        // Allow one retry on timeout, then give up
        if (attempt >= retries) break;
      } else {
        lastError = err instanceof Error ? err : new Error(String(err));
      }
    } finally {
      clearTimeout(timer);
    }
  }

  return { data: null, error: lastError };
}
