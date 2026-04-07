/**
 * Shared idempotency helpers for Edge Functions.
 *
 * Uses an in-memory TTL cache (per isolate) to deduplicate requests that share
 * the same `X-Idempotency-Key` header within a configurable window.
 *
 * Usage inside an edge function handler:
 *
 *   const cached = checkIdempotency(req);
 *   if (cached) return cached;         // duplicate request — return stored response
 *   ...process the request...
 *   const response = new Response(JSON.stringify(result), { ... });
 *   storeIdempotencyResult(req, response);
 *   return response;
 */

/** Default TTL for cached responses: 5 minutes. */
const DEFAULT_TTL_MS = 5 * 60 * 1000;

interface CacheEntry {
  body: string;
  status: number;
  headers: [string, string][];
  expiresAt: number;
}

// In-memory cache scoped to the Deno isolate lifetime.
const cache = new Map<string, CacheEntry>();

/** Periodic cleanup of expired entries (runs at most once per minute). */
let lastCleanup = 0;
function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < 60_000) return;
  lastCleanup = now;
  for (const [key, entry] of cache) {
    if (entry.expiresAt <= now) cache.delete(key);
  }
}

/**
 * Extract the idempotency key from the request.
 * Returns `null` when the header is absent (non-idempotent request).
 */
export function getIdempotencyKey(req: Request): string | null {
  return req.headers.get("x-idempotency-key");
}

/**
 * Check whether a response for this idempotency key has already been stored.
 * Returns a cloned `Response` if found (caller should return it immediately),
 * or `null` if the request should be processed normally.
 */
export function checkIdempotency(req: Request): Response | null {
  cleanup();

  const key = getIdempotencyKey(req);
  if (!key) return null;

  const entry = cache.get(key);
  if (!entry || entry.expiresAt <= Date.now()) {
    if (entry) cache.delete(key);
    return null;
  }

  // Reconstruct the response from the cached data.
  const headers = new Headers(entry.headers);
  return new Response(entry.body, { status: entry.status, headers });
}

/**
 * Store the response for a given idempotency key so that subsequent retries
 * receive the same answer without re-executing side-effects.
 *
 * Only stores if the request carried an idempotency key header.
 * The response body is consumed via `.clone()` so the original remains usable.
 */
export async function storeIdempotencyResult(
  req: Request,
  response: Response,
  ttlMs: number = DEFAULT_TTL_MS,
): Promise<void> {
  const key = getIdempotencyKey(req);
  if (!key) return;

  const clone = response.clone();
  const body = await clone.text();

  const headers: [string, string][] = [];
  clone.headers.forEach((value, name) => {
    headers.push([name, value]);
  });

  cache.set(key, {
    body,
    status: clone.status,
    headers,
    expiresAt: Date.now() + ttlMs,
  });
}
