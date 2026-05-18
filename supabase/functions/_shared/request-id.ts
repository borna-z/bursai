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
 */
export function getOrCreateRequestId(req: Request): string {
  const fromHeader =
    req.headers.get("x-request-id") ?? req.headers.get("X-Request-Id");
  if (fromHeader && fromHeader.length > 0) return fromHeader;
  return crypto.randomUUID();
}
