/**
 * Resilient edge function invocation with timeout, retry, and exponential backoff.
 *
 * Scale-hardened:
 * - Does NOT retry 429 (rate limited) or 402 (payment required) — returns immediately
 * - Adds jitter to backoff to prevent thundering herd
 * - Respects Retry-After header from server
 * - Distinguishes transient failures from overload/hard failures
 * - Client-side circuit breaker prevents hammering failing functions
 * - Pre-flight session refresh: checks token expiry before every call
 */
import { supabase } from '@/integrations/supabase/client';
import { EDGE_FUNCTION_DEFAULT_TIMEOUT_MS, EDGE_FUNCTION_MAX_BACKOFF_MS } from '@/config/constants';

interface InvokeOptions {
  /** Max time in ms before aborting (default: 25000) */
  timeout?: number;
  /** Number of retries on transient failure (default: 2) */
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

export class EdgeFunctionRateLimitError extends Error {
  retryAfter: number;
  constructor(fnName: string, retryAfter: number) {
    super(`Rate limit exceeded for "${fnName}". Try again in ${retryAfter}s.`);
    this.name = 'EdgeFunctionRateLimitError';
    this.retryAfter = retryAfter;
  }
}

// ── Client-side circuit breaker ──────────────────────────────────
// Prevents hammering a function that's consistently failing.
// Per-function, resets after the cooldown window.
const circuitState = new Map<string, { failures: number; openUntil: number }>();
const CIRCUIT_FAILURE_THRESHOLD = 5;
const CIRCUIT_COOLDOWN_MS = 30_000;

function checkCircuit(fnName: string): boolean {
  const state = circuitState.get(fnName);
  if (!state) return true; // closed, allow
  // Circuit is open (tripped) — check if cooldown has elapsed
  if (state.openUntil > 0) {
    if (Date.now() > state.openUntil) {
      circuitState.delete(fnName); // reset after cooldown
      return true;
    }
    return false; // still in cooldown — block
  }
  return true; // hasn't tripped yet, allow (failures are accumulating)
}

function recordCircuitFailure(fnName: string): void {
  const state = circuitState.get(fnName) || { failures: 0, openUntil: 0 };
  state.failures++;
  if (state.failures >= CIRCUIT_FAILURE_THRESHOLD) {
    state.openUntil = Date.now() + CIRCUIT_COOLDOWN_MS;
  }
  circuitState.set(fnName, state);
}

function recordCircuitSuccess(fnName: string): void {
  circuitState.delete(fnName);
}

// ── HTTP status extraction ───────────────────────────────────────
// supabase-js FunctionsHttpError stores the Response on `error.context`
// with a generic message ("Edge Function returned a non-2xx status code").
// We must inspect `context.status` to get the real HTTP status code.
function getHttpStatus(error: unknown): number | null {
  if (error && typeof error === 'object' && 'context' in error) {
    const ctx = (error as { context?: { status?: number } }).context;
    if (ctx && typeof ctx.status === 'number') return ctx.status;
  }
  return null;
}

// ── Non-retryable status codes ───────────────────────────────────
// These indicate the request itself is wrong or rate-limited — retrying won't help.
function isNonRetryableError(error: unknown): boolean {
  if (error instanceof EdgeFunctionRateLimitError) return true;
  const status = getHttpStatus(error);
  if (status === 429 || status === 402 || status === 403 || status === 400) return true;
  // 401 is NOT non-retryable — see isAuthError + inline recovery logic.
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (msg.includes('429') || msg.includes('rate limit')) return true;
    if (msg.includes('402') || msg.includes('payment')) return true;
    if (msg.includes('403') || msg.includes('forbidden')) return true;
    if (msg.includes('400') || msg.includes('bad request')) return true;
  }
  return false;
}

/** Detect 401/unauthorized so we can attempt a session refresh + retry. */
function isAuthError(error: unknown): boolean {
  if (getHttpStatus(error) === 401) return true;
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return msg.includes('401') || msg.includes('unauthorized');
  }
  return false;
}

// ── Pre-flight session refresh ───────────────────────────────────
// Supabase auto-refresh can lag behind, especially when the app has been
// backgrounded on mobile (Median.co wrapper, iOS/Android).  Before every
// edge function call, check if the access token is expired or about to
// expire within the next 60 seconds.  If so, force a refresh so the
// invoke call uses a fresh token.  This eliminates the 401 storms that
// occur when a user returns from background with a stale JWT.
const TOKEN_EXPIRY_BUFFER_S = 60;

async function ensureFreshSession(): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return; // not logged in — edge function will handle 401

  const expiresAt = session.expires_at; // unix seconds
  if (expiresAt && expiresAt - TOKEN_EXPIRY_BUFFER_S < Date.now() / 1000) {
    await supabase.auth.refreshSession();
  }
}

/** Add jitter to backoff to prevent thundering herd */
function backoffWithJitter(attempt: number): number {
  const base = Math.min(1000 * 2 ** (attempt - 1), EDGE_FUNCTION_MAX_BACKOFF_MS);
  // Add ±25% jitter
  const jitter = base * 0.25 * (Math.random() * 2 - 1);
  return Math.max(100, Math.round(base + jitter));
}

/**
 * Invoke an edge function with automatic timeout and retry.
 */
export async function invokeEdgeFunction<T = unknown>(
  functionName: string,
  opts: InvokeOptions = {}
): Promise<{ data: T | null; error: Error | null }> {
  const { timeout = EDGE_FUNCTION_DEFAULT_TIMEOUT_MS, retries = 2, body, idempotent } = opts;

  // Ensure the session token is fresh before calling any edge function.
  // This prevents the 401 storms that occur when the app returns from
  // background with an expired JWT (common on Median.co mobile wrapper).
  try {
    await ensureFreshSession();
  } catch {
    // Non-fatal — proceed with whatever token we have.
  }

  // Circuit breaker check
  if (!checkCircuit(functionName)) {
    return {
      data: null,
      error: new Error(`Service "${functionName}" is temporarily unavailable. Please try again shortly.`),
    };
  }

  // Generate a single idempotency key for the entire logical request (shared
  // across retries) so the server can de-duplicate mutations.
  const idempotencyKey = idempotent ? crypto.randomUUID() : undefined;

  let lastError: Error | null = null;
  let authRetried = false; // tracks whether we already attempted a session refresh on 401

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, backoffWithJitter(attempt)));
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

        // Check for rate limit in error response
        if (isNonRetryableError(lastError)) {
          recordCircuitFailure(functionName);
          break; // Do NOT retry
        }

        // 401 = likely stale token.  Refresh the session and re-invoke
        // once.  This is done inline (not via `continue`) so it works
        // even when `retries` is 0 — the auth recovery attempt does not
        // count against the caller's retry budget.
        if (isAuthError(lastError) && !authRetried) {
          authRetried = true;
          try { await supabase.auth.refreshSession(); } catch { /* proceed */ }
          const retryController = new AbortController();
          const retryTimer = setTimeout(() => retryController.abort(), timeout);
          try {
            const retry = await supabase.functions.invoke(functionName, {
              body: body ?? undefined,
              headers,
              signal: retryController.signal,
            });
            if (!retry.error) {
              recordCircuitSuccess(functionName);
              return { data: retry.data as T, error: null };
            }
            lastError = retry.error instanceof Error ? retry.error : new Error(String(retry.error));
          } catch { /* fall through to break */ }
          finally { clearTimeout(retryTimer); }
        }
        if (isAuthError(lastError)) {
          // Refresh + retry didn't help — genuine auth failure.
          recordCircuitFailure(functionName);
          break;
        }

        // Check if the data contains rate limit info
        if (data && typeof data === 'object' && 'retryAfter' in data) {
          lastError = new EdgeFunctionRateLimitError(functionName, (data as Record<string, unknown>).retryAfter as number);
          break; // Do NOT retry
        }

        recordCircuitFailure(functionName);
        continue; // Transient error — retry
      }

      // Check if successful response actually contains a rate limit error
      if (data && typeof data === 'object' && 'error' in data && 'retryAfter' in data) {
        lastError = new EdgeFunctionRateLimitError(functionName, (data as Record<string, unknown>).retryAfter as number);
        break;
      }

      recordCircuitSuccess(functionName);
      return { data: data as T, error: null };
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        lastError = new EdgeFunctionTimeoutError(functionName);
        recordCircuitFailure(functionName);
        // Allow one retry on timeout, then give up
        if (attempt >= retries) break;
      } else {
        lastError = err instanceof Error ? err : new Error(String(err));

        // Don't retry non-retryable errors
        if (isNonRetryableError(lastError)) {
          recordCircuitFailure(functionName);
          break;
        }

        recordCircuitFailure(functionName);
      }
    } finally {
      clearTimeout(timer);
    }
  }

  return { data: null, error: lastError };
}
