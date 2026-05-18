// Resilient edge function invocation for mobile — adapted from
// `src/lib/edgeFunctionClient.ts` (web) but reshaped around raw `fetch`
// (every existing mobile hook already calls fetch directly), with
// AbortSignal threading, exponential backoff + jitter, a per-function
// circuit breaker, pre-flight session refresh, and a typed paywall
// surface (HTTP 402).
//
// Two return shapes:
//   - default: parsed JSON body typed as `T`. Throws on non-2xx after
//     retry budget is exhausted; throws synchronously for non-retryable
//     statuses (400/402/403/429).
//   - `{ stream: true }`: returns the raw `Response`. Used by SSE consumers
//     that need the byte stream — the caller is responsible for the body
//     reader. The wrapper still applies pre-flight refresh + auth + 402
//     classification before handing the response back.
//
// Subscription gating: a 402 (or a body with `error: 'subscription_required'`)
// throws `EdgeFunctionSubscriptionLockedError` so paywall surfaces can
// intercept without parsing HTTP details. 429 throws
// `EdgeFunctionRateLimitError` carrying `retryAfter` seconds.
//
// Wave M9. Web's call site uses `supabase.functions.invoke()`, but the
// mobile baseline (M0–M8) is all raw fetch — porting via fetch keeps the
// migration drop-in for every existing hook.

import * as Crypto from 'expo-crypto';

import { log } from './log';
import { supabase, supabaseUrl } from './supabase';

const DEFAULT_TIMEOUT_MS = 90_000;
export const SUBSCRIPTION_SENTINEL = 'subscription_required' as const;
const DEFAULT_RETRIES = 2;
const MAX_BACKOFF_MS = 8_000;
// Refresh the access token if it expires within this many seconds. Auto-
// refresh in supabase-js can lag behind a backgrounded app; the buffer
// catches stale-JWT 401 storms before the request leaves the device.
const TOKEN_EXPIRY_BUFFER_S = 60;

// Circuit-breaker thresholds — match the web client.
const CIRCUIT_FAILURE_THRESHOLD = 5;
const CIRCUIT_COOLDOWN_MS = 30_000;

export interface CallOpts {
  signal?: AbortSignal;
  retries?: number;
  timeoutMs?: number;
  /** When true, returns the raw `Response` instead of parsing JSON. Used by
   * SSE consumers that hand the byte stream off to a parser. */
  stream?: boolean;
  /** Extra headers merged on top of Content-Type / Authorization. */
  headers?: Record<string, string>;
  /** Request body. Strings pass through unchanged; objects get JSON.stringified. */
  body?: unknown;
  /**
   * When true, generates a UUID idempotency key for this logical request.
   * Reused across retries (sent as `X-Idempotency-Key`) so the server can
   * de-duplicate mutations.
   */
  idempotent?: boolean;
  /**
   * Optional `x-request-id` to pin onto this logical call. When omitted, a
   * fresh UUID is minted per call so every edge invocation gets traced.
   * Pair with the server-side `_shared/request-id.ts` helper for end-to-end
   * correlation across chained edge functions. Reused across retries.
   */
  requestId?: string;
}

// ─── typed errors ─────────────────────────────────────────────────────

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

export class EdgeFunctionSubscriptionLockedError extends Error {
  constructor(fnName: string) {
    super(`Subscription required for "${fnName}".`);
    this.name = 'EdgeFunctionSubscriptionLockedError';
  }
}

export class EdgeFunctionHttpError extends Error {
  status: number;
  bodyText: string;
  constructor(fnName: string, status: number, bodyText: string) {
    super(`Edge function "${fnName}" failed: ${status} ${bodyText}`);
    this.name = 'EdgeFunctionHttpError';
    this.status = status;
    this.bodyText = bodyText;
  }
}

export class EdgeFunctionCircuitOpenError extends Error {
  constructor(fnName: string) {
    super(`Service "${fnName}" is temporarily unavailable. Please try again shortly.`);
    this.name = 'EdgeFunctionCircuitOpenError';
  }
}

// ─── circuit breaker ──────────────────────────────────────────────────

const circuitState = new Map<string, { failures: number; openUntil: number }>();

function checkCircuit(fnName: string): boolean {
  const state = circuitState.get(fnName);
  if (!state) return true;
  if (state.openUntil > 0) {
    if (Date.now() > state.openUntil) {
      circuitState.delete(fnName);
      return true;
    }
    return false;
  }
  return true;
}

function recordCircuitFailure(fnName: string): void {
  const state = circuitState.get(fnName) ?? { failures: 0, openUntil: 0 };
  state.failures++;
  if (state.failures >= CIRCUIT_FAILURE_THRESHOLD) {
    state.openUntil = Date.now() + CIRCUIT_COOLDOWN_MS;
  }
  circuitState.set(fnName, state);
}

function recordCircuitSuccess(fnName: string): void {
  circuitState.delete(fnName);
}

// ─── helpers ──────────────────────────────────────────────────────────

async function ensureFreshSession(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  const session = data.session;
  if (!session) return null;
  const expiresAt = session.expires_at;
  if (expiresAt && expiresAt - TOKEN_EXPIRY_BUFFER_S < Date.now() / 1000) {
    try {
      const { data: refreshed } = await supabase.auth.refreshSession();
      return refreshed.session?.access_token ?? session.access_token;
    } catch (err) {
      log.error(err, { context: 'edgeFunctionClient.refresh_near_expiry_failed' });
      // Fall through with stale token — request will surface a 401 we
      // recover from inline.
    }
  }
  return session.access_token;
}

function backoffWithJitter(attempt: number): number {
  const base = Math.min(1000 * 2 ** (attempt - 1), MAX_BACKOFF_MS);
  const jitter = base * 0.25 * (Math.random() * 2 - 1);
  return Math.max(100, Math.round(base + jitter));
}

/** Sleep that resolves on timer OR rejects when the caller's signal aborts.
 * Used to keep retry backoff cancellable. */
function sleepWithSignal(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function isNonRetryableStatus(status: number): boolean {
  // Web parity per `src/lib/edgeFunctionClient.ts`: 400/401/402/403/404
  // are permanent client-side issues — retrying just burns budget. 401 is
  // handled separately above (one-shot session refresh); 402 + 429 surface
  // as their own typed errors before this check, but listing them here
  // keeps the predicate self-documenting for future readers.
  return (
    status === 400 ||
    status === 402 ||
    status === 403 ||
    status === 404
  );
}

function randomKey(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}-${Math.random()
    .toString(36)
    .slice(2, 12)}`;
}

// ─── public API ───────────────────────────────────────────────────────

/**
 * Invoke an edge function with timeout, retry, circuit-break, and 4xx
 * classification. Throws typed errors for the well-known failure modes
 * (paywall, rate limit, timeout, circuit open). All other non-2xx
 * statuses surface as `EdgeFunctionHttpError`.
 *
 * Returns `T | null` for JSON consumers — `null` is yielded when the 2xx
 * response body cannot be parsed as JSON (the wrapper swallows the parse
 * error). Callers MUST null-check the result and surface a real error
 * to the user; silently no-oping masks unparseable responses that point
 * at edge-function bugs. (PR fix(mobile + edge): null-safe edge calls.)
 *
 * For SSE consumers, pass `{ stream: true }` to get the raw `Response`
 * back so the caller can drive the byte reader.
 */
export async function callEdgeFunction<T = unknown>(
  fnName: string,
  opts?: CallOpts & { stream?: false },
): Promise<T | null>;
export async function callEdgeFunction(
  fnName: string,
  opts: CallOpts & { stream: true },
): Promise<Response>;
export async function callEdgeFunction<T>(
  fnName: string,
  opts: CallOpts = {},
): Promise<T | null | Response> {
  const {
    signal,
    retries = DEFAULT_RETRIES,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    stream = false,
    headers: extraHeaders,
    body,
    idempotent,
    requestId: callerRequestId,
  } = opts;

  if (!checkCircuit(fnName)) {
    throw new EdgeFunctionCircuitOpenError(fnName);
  }

  // Pre-flight: refresh near-expiry tokens so we don't burn a retry on a
  // predictable 401. Best-effort — if this throws we proceed with whatever
  // token we already have.
  let accessToken: string | null;
  try {
    accessToken = await ensureFreshSession();
  } catch (err) {
    log.error(err, { context: 'edgeFunctionClient.preflight_session_failed' });
    accessToken = null;
  }

  const idempotencyKey = idempotent ? randomKey() : null;
  // Always mint a UUID for `x-request-id` (or honor the caller-supplied
  // value) so every edge invocation is traceable end-to-end. The server
  // persists this into `render_jobs.request_id uuid` / `feedback_signals
  // .request_id uuid`, so the value MUST be a real UUID — using a real
  // randomUUID() (not the loose randomKey() shape) is load-bearing.
  // Reused across retries so a retried call collates with its first attempt.
  const requestIdHeader = callerRequestId ?? Crypto.randomUUID();

  let lastError: Error | null = null;
  let authRetried = false;

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      // Honor the caller's AbortSignal while we sleep — without this, a
      // late abort would still wait the full backoff window before the
      // next iteration's fast-fail. Codex P2 round 0.
      try {
        await sleepWithSignal(backoffWithJitter(attempt), signal);
      } catch (abortErr) {
        throw abortErr instanceof Error ? abortErr : new Error('Aborted');
      }
    }

    // Per-attempt controller honours the timeout budget AND a caller-
    // supplied AbortSignal. Aborting the latter aborts the underlying fetch
    // immediately; the timeout prevents wedged requests.
    const controller = new AbortController();
    const onAbort = () => controller.abort();
    if (signal) {
      if (signal.aborted) {
        controller.abort();
      } else {
        signal.addEventListener('abort', onAbort, { once: true });
      }
    }
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    // Stream returns hand the body reader off to the caller. The fetch
    // resolves as soon as headers arrive, but the SSE body lifetime can
    // be many minutes — the caller's abort needs to keep wiring through to
    // the underlying fetch even after we return. We flip this when we're
    // about to return a stream so the `finally` clause leaves the listener
    // and timer cleanup is handled inline. Codex P1 round 1 on PR #733.
    let cleanupAbortListener = true;

    try {
      const reqHeaders: Record<string, string> = {
        Accept: stream ? 'text/event-stream' : 'application/json',
        ...extraHeaders,
      };
      // Don't override caller-supplied Content-Type (matters for multipart),
      // but default to JSON when the body is an object/array.
      if (body !== undefined && body !== null) {
        if (typeof body !== 'string' && !reqHeaders['Content-Type']) {
          reqHeaders['Content-Type'] = 'application/json';
        }
      }
      if (accessToken) {
        reqHeaders.Authorization = `Bearer ${accessToken}`;
      }
      if (idempotencyKey) {
        reqHeaders['X-Idempotency-Key'] = idempotencyKey;
      }
      reqHeaders['x-request-id'] = requestIdHeader;

      const response = await fetch(`${supabaseUrl}/functions/v1/${fnName}`, {
        method: 'POST',
        headers: reqHeaders,
        body:
          body === undefined || body === null
            ? undefined
            : typeof body === 'string'
              ? body
              : JSON.stringify(body),
        signal: controller.signal,
      });

      if (response.ok) {
        if (stream) {
          recordCircuitSuccess(fnName);
          // Header-arrival timer: clear it manually since the body lifetime
          // isn't bounded by the 90s budget (an SSE stream can run for
          // minutes). Leave the abort listener attached so a late caller
          // abort still aborts the underlying fetch + body reader.
          clearTimeout(timer);
          cleanupAbortListener = false;
          return response;
        }
        // Some functions reply 200 with `{ error, retryAfter }` — honour the
        // body-level rate-limit shape too. Don't record circuit success
        // until we've verified the body isn't a rate-limit envelope (Codex
        // P2 round 0 — circuit accounting consistency).
        const data = (await response.json().catch(() => null)) as
          | { error?: string; retryAfter?: number }
          | T
          | null;
        if (
          data &&
          typeof data === 'object' &&
          'retryAfter' in (data as Record<string, unknown>) &&
          'error' in (data as Record<string, unknown>)
        ) {
          recordCircuitFailure(fnName);
          throw new EdgeFunctionRateLimitError(
            fnName,
            Number((data as { retryAfter?: number }).retryAfter ?? 0),
          );
        }
        recordCircuitSuccess(fnName);
        return data as T;
      }

      // Non-2xx — classify.
      const status = response.status;
      const bodyText = await response.text().catch(() => '');

      if (status === 402) {
        throw new EdgeFunctionSubscriptionLockedError(fnName);
      }
      if (status === 429) {
        const retryAfterHeader = response.headers.get('retry-after');
        const retryAfter = retryAfterHeader ? Number(retryAfterHeader) : 0;
        throw new EdgeFunctionRateLimitError(fnName, retryAfter);
      }
      if (status === 401 && !authRetried) {
        authRetried = true;
        try {
          const { data: refreshed } = await supabase.auth.refreshSession();
          accessToken = refreshed.session?.access_token ?? accessToken;
        } catch (err) {
          log.error(err, { context: 'edgeFunctionClient.401_refresh_failed' });
          // Refresh failed — continue with the next attempt; if the next
          // call also 401s we'll surface it.
        }
        // Don't count this as a retry tick — even callers with retries: 0
        // (start_trial, memory_ingest, detect_duplicate, SSE) need the
        // refreshed-token request to actually fire. Decrement so the next
        // iteration re-runs at the same budget slot. Codex P2 round 1.
        lastError = new EdgeFunctionHttpError(fnName, status, bodyText);
        attempt--;
        continue;
      }
      // Codex P2 round 3 on PR #733: a 401 AFTER the one-shot refresh has
      // run is a genuine auth failure — expired/revoked session, no point
      // retrying. Classifying as transient would burn the retry budget on
      // a known-bad outcome AND, with a default retries=2, accumulate enough
      // circuit failures across 5 calls to trip the per-function 30s
      // cooldown. Treat post-refresh 401 the same as the rest of the
      // permanent-client-error set.
      if (status === 401 && authRetried) {
        recordCircuitFailure(fnName);
        throw new EdgeFunctionHttpError(fnName, status, bodyText);
      }
      if (isNonRetryableStatus(status)) {
        recordCircuitFailure(fnName);
        throw new EdgeFunctionHttpError(fnName, status, bodyText);
      }

      // Transient error — retry path.
      recordCircuitFailure(fnName);
      lastError = new EdgeFunctionHttpError(fnName, status, bodyText);
      continue;
    } catch (err) {
      // Sentinel errors thrown in this function are typed and final — surface
      // them immediately rather than treating as transient.
      if (
        err instanceof EdgeFunctionRateLimitError ||
        err instanceof EdgeFunctionSubscriptionLockedError ||
        err instanceof EdgeFunctionHttpError ||
        err instanceof EdgeFunctionCircuitOpenError
      ) {
        throw err;
      }
      // AbortController.abort() throws DOMException('AbortError') in browsers
      // and an `Error` with `name === 'AbortError'` in RN's fetch polyfill.
      if (err && typeof err === 'object' && (err as { name?: string }).name === 'AbortError') {
        // Caller-initiated abort — propagate without retry.
        if (signal?.aborted) {
          throw err instanceof Error ? err : new Error('Aborted');
        }
        // Timeout abort — count it and fall through.
        lastError = new EdgeFunctionTimeoutError(fnName);
        recordCircuitFailure(fnName);
        if (attempt >= retries) break;
        continue;
      }
      lastError = err instanceof Error ? err : new Error(String(err));
      recordCircuitFailure(fnName);
      if (attempt >= retries) break;
    } finally {
      // Stream returns own the abort wiring for the body lifetime — the
      // success branch above already cleared the timer + flipped the flag.
      if (cleanupAbortListener) {
        clearTimeout(timer);
        if (signal) signal.removeEventListener('abort', onAbort);
      }
    }
  }

  throw lastError ?? new Error(`Edge function "${fnName}" failed without an error`);
}
