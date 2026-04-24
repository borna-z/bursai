/**
 * Minimal observability helper for BURS Edge Functions.
 *
 * Ships a fire-and-forget Sentry capture primitive without pulling in the full
 * Sentry SDK. When `SENTRY_DSN` is unset the helper is a no-op beyond the
 * console.warn — edge function logs stay queryable in Supabase Logs regardless.
 *
 * Wave 4.9-C: first consumer is `render_garment_image` fail-open validator
 * branch. Expand to more sites as aggregate-visibility needs surface.
 *
 * DSN format:
 *   https://<public_key>@<host>/<project_id>
 *
 * Ingest endpoint used:
 *   POST https://<host>/api/<project_id>/store/?sentry_version=7&sentry_client=...&sentry_key=<public_key>
 *
 * The store endpoint accepts a JSON body and is simpler than the envelope
 * endpoint — acceptable for fire-and-forget warnings. If we later need
 * transactions or breadcrumbs, swap for envelope.
 */

interface ParsedDsn {
  publicKey: string;
  projectId: string;
  host: string;
}

function parseDsn(dsn: string): ParsedDsn | null {
  try {
    const url = new URL(dsn);
    const publicKey = url.username;
    const projectId = url.pathname.replace(/^\//, "");
    if (!publicKey || !projectId) return null;
    return { publicKey, projectId, host: url.host };
  } catch {
    return null;
  }
}

// Module-level env reads gated for non-Deno runtimes (vitest/Node) so this
// file can be imported under test without blowing up. The runtime-only
// guarded `fetch` below also stays safe.
const SENTRY_DSN = (typeof Deno !== "undefined" ? Deno.env.get("SENTRY_DSN") : undefined) ?? "";
const PARSED_DSN = SENTRY_DSN ? parseDsn(SENTRY_DSN) : null;
const ENVIRONMENT = (typeof Deno !== "undefined" ? Deno.env.get("SENTRY_ENVIRONMENT") : undefined) ?? "production";

type TagValue = string | number | boolean | null | undefined;

function normalizeTags(tags: Record<string, TagValue>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(tags)) {
    if (v === null || v === undefined) {
      out[k] = "unknown";
    } else {
      out[k] = String(v);
    }
  }
  return out;
}

/**
 * Capture a warning event. Fire-and-forget: the Promise is NOT returned
 * and any transport failure is swallowed (we prefer function continuation
 * over a Sentry outage stalling a user request).
 *
 * When `SENTRY_DSN` is unset, still emits a structured console.warn so
 * the event is queryable from Supabase Logs.
 */
export function captureWarning(
  event: string,
  tags: Record<string, TagValue> = {},
): void {
  const normalizedTags = normalizeTags(tags);

  // Structured local log — always emitted, discoverable in Supabase Logs.
  console.warn(
    JSON.stringify({
      level: "warn",
      observability_event: event,
      tags: normalizedTags,
      ts: new Date().toISOString(),
    }),
  );

  if (!PARSED_DSN) return;

  const url =
    `https://${PARSED_DSN.host}/api/${PARSED_DSN.projectId}/store/` +
    `?sentry_version=7&sentry_client=burs-edge-fn/0.0.1&sentry_key=${PARSED_DSN.publicKey}`;

  const body = JSON.stringify({
    message: event,
    level: "warning",
    platform: "javascript",
    environment: ENVIRONMENT,
    tags: normalizedTags,
    timestamp: Date.now() / 1000,
  });

  // Fire-and-forget. We intentionally do NOT await. A Sentry outage must
  // never block the user-facing render path.
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  }).catch(() => {
    // swallow — the structured console.warn above is our fallback signal
  });
}

/**
 * Narrow reason classifier for validator failures. Keeps Sentry tags
 * queryable without exposing raw error messages (which may contain URLs
 * or PII).
 */
export function classifyValidatorError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/timeout|timed out|aborted|abort/i.test(msg)) return "validator_timeout";
  if (/fetch|network|refused|unreachable|dns|econn/i.test(msg)) return "validator_fetch_failed";
  return "validator_bad_response";
}
