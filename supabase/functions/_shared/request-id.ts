/**
 * Request-ID helper for end-to-end trace correlation across edge functions.
 *
 * Every entrypoint reads `x-request-id` from the inbound request; if absent
 * (cron tick, internal call missing the header), mint a fresh UUID. Pair
 * the returned id with `logger(fn, requestId)` so every log line carries
 * the same correlation id, and forward it as `x-request-id` on any
 * outbound `fetch()` to chained edge functions.
 *
 * Mobile clients inject `x-request-id` from `mobile/src/lib/edgeFunctionClient.ts`,
 * so a user-initiated render flow keeps the same id across
 * enqueue_render_job → process_render_jobs → render_garment_image.
 *
 * Trace a single request with:
 *   supabase functions logs --search 'request_id=<uuid>'
 *
 * UUID validation (Codex round 1 P2): the header value flows into
 * `render_jobs.request_id uuid` / `feedback_signals.request_id uuid`
 * columns. An upstream gateway, proxy, or test harness setting
 * `x-request-id` to a non-UUID string (e.g., "abc-123", trace IDs from
 * Cloudflare/Datadog, or any arbitrary token) would crash the insert with
 * `invalid input syntax for type uuid` — turning an observability nicety
 * into a hard 5xx on every authenticated enqueue. Mint a fresh UUID and
 * fall through silently when the header is missing OR malformed; the
 * caller's loss of cross-hop correlation is acceptable, the user-visible
 * outage is not.
 */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function getOrCreateRequestId(req: Request): string {
  // `Request.headers.get()` is case-insensitive per the Fetch spec, so the
  // single `x-request-id` read covers `X-Request-Id`, `X-REQUEST-ID`, etc.
  const fromHeader = req.headers.get("x-request-id");
  if (fromHeader && UUID_RE.test(fromHeader)) return fromHeader;
  return crypto.randomUUID();
}
