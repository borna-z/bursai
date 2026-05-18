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
  /** Optional path prefix between host and /api/ — used by SaaS tenants.
      For DSN `https://key@host/prefix/42`, pathPrefix is `/prefix` and
      projectId is `42`. For a bare `https://key@host/42`, pathPrefix is "". */
  pathPrefix: string;
}

function parseDsn(dsn: string): ParsedDsn | null {
  try {
    const url = new URL(dsn);
    const publicKey = url.username;
    const pathParts = url.pathname.split("/").filter(Boolean);
    if (!publicKey || pathParts.length === 0) return null;
    const projectId = pathParts.pop() as string;
    const pathPrefix = pathParts.length ? "/" + pathParts.join("/") : "";
    return { publicKey, projectId, host: url.host, pathPrefix };
  } catch (_parseErr) {
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

/**
 * Normalize tag values to strings for the Sentry store endpoint.
 *
 * Any key passed in `tags` is forwarded — callers that want end-to-end
 * trace correlation pass `request_id` here (matching the
 * `_shared/logger.ts` log-line key) so Sentry events and Supabase Logs
 * collate on the same id. See `_shared/request-id.ts`.
 */
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
    `https://${PARSED_DSN.host}${PARSED_DSN.pathPrefix}/api/${PARSED_DSN.projectId}/store/` +
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
 * Structured step logger shared across edge functions. Mirrors the
 * inline `logStep` helper that several webhook functions
 * (`stripe_webhook`, `revenuecat_webhook`, `restore_subscription`,
 * `create_*_session`) defined locally — pulled here so a single
 * format ([PREFIX] step - {json}) is queryable across functions in
 * Supabase Logs.
 *
 * N2: first consumer is `stripe_webhook`. Function-local copies in
 * `revenuecat_webhook` etc. stay until a follow-up campaign migrates
 * them — converging callers in one PR risks a regression to the
 * RC-specific correlation-id formatting that's load-bearing for the
 * Codex-round-X out-of-order traces.
 */
export function logStep(prefix: string, step: string, details?: unknown): void {
  const detailsStr = details === undefined ? "" : ` - ${JSON.stringify(details)}`;
  console.log(`[${prefix}] ${step}${detailsStr}`);
}

/**
 * Convenience factory: returns a bound `logStep` that prepends a fixed
 * prefix. Lets callers replace `const logStep = (step, details) => ...`
 * with `const logStep = makeLogStep("STRIPE-WEBHOOK")` while keeping
 * the call shape identical at every call site.
 */
export function makeLogStep(prefix: string): (step: string, details?: unknown) => void {
  return (step: string, details?: unknown) => logStep(prefix, step, details);
}

/**
 * Capture an error event. Fire-and-forget like `captureWarning` but emits
 * a `console.error` + `level: "error"` to Sentry. Use for caught exceptions
 * that previously went into a silent `.catch(() => {})`. Pre-launch audit
 * issue #1: every catch must observe through this (or `captureWarning` for
 * intentionally non-fatal paths).
 *
 * Also mirrors the event into `public.edge_function_errors` using a
 * service-role client built from SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 * The insert is fire-and-forget and double-wrapped in try/catch — a DB
 * outage or row-level rejection must NEVER break the caller. The
 * `tags.fn_name` field is the canonical function name per existing
 * captureError call sites; `tags.user_id` / `tags.request_id` are also
 * propagated when present.
 */
export function captureError(
  event: string,
  error: unknown,
  tags: Record<string, TagValue> = {},
): void {
  const normalizedTags = normalizeTags(tags);
  const errMessage = error instanceof Error ? error.message : String(error);

  console.error(
    JSON.stringify({
      level: "error",
      observability_event: event,
      error: errMessage,
      tags: normalizedTags,
      ts: new Date().toISOString(),
    }),
  );

  // ─── Mirror into edge_function_errors (fire-and-forget) ───
  // We intentionally swallow ALL errors here. The user-facing request is
  // what matters; an observability outage must not propagate.
  try {
    mirrorErrorToDb(event, errMessage, normalizedTags);
  } catch {
    // swallowed
  }

  if (!PARSED_DSN) return;

  const url =
    `https://${PARSED_DSN.host}${PARSED_DSN.pathPrefix}/api/${PARSED_DSN.projectId}/store/` +
    `?sentry_version=7&sentry_client=burs-edge-fn/0.0.1&sentry_key=${PARSED_DSN.publicKey}`;

  const body = JSON.stringify({
    message: `${event}: ${errMessage}`,
    level: "error",
    platform: "javascript",
    environment: ENVIRONMENT,
    tags: normalizedTags,
    timestamp: Date.now() / 1000,
  });

  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  }).catch((err) => {
    // Structured local log only — transport already failed; do not loop.
    console.warn(
      JSON.stringify({
        level: "warn",
        observability_event: "sentry_transport_failed",
        original_event: event,
        error: err instanceof Error ? err.message : String(err),
        ts: new Date().toISOString(),
      }),
    );
  });
}

// ─── edge_function_errors mirror ────────────────────────────────────────────
// Implemented as a lazy module-cached supabase-js client. Bare-fetch as a
// fallback when supabase-js isn't already on the import map (vitest etc.)
// would require duplicating PostgREST URL construction; we instead use the
// supabase-js client when available (production Deno) and fall back to a
// raw fetch() against the PostgREST /rest/v1/ endpoint otherwise. Both
// paths fire-and-forget.

let _mirrorClient: { insert: (row: Record<string, unknown>) => Promise<unknown> } | null = null;
let _mirrorClientResolved = false;

async function getMirrorInsert(): Promise<((row: Record<string, unknown>) => Promise<unknown>) | null> {
  if (_mirrorClientResolved) {
    return _mirrorClient ? _mirrorClient.insert.bind(_mirrorClient) : null;
  }
  _mirrorClientResolved = true;

  const url = typeof Deno !== "undefined" ? Deno.env.get("SUPABASE_URL") : undefined;
  const key = typeof Deno !== "undefined" ? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") : undefined;
  if (!url || !key) return null;

  try {
    // Dynamic import — only attempted under Deno (production). Under Node
    // tests this throws on the URL specifier and we fall through to null.
    const mod = await import("https://esm.sh/@supabase/supabase-js@2");
    // deno-lint-ignore no-explicit-any
    const client: any = mod.createClient(url, key);
    const table = client.from("edge_function_errors");
    _mirrorClient = {
      insert: (row: Record<string, unknown>) => table.insert(row),
    };
    return _mirrorClient.insert.bind(_mirrorClient);
  } catch {
    // Fallback: raw PostgREST POST. Service-role key in the Authorization
    // header. Bypasses RLS.
    _mirrorClient = {
      insert: async (row: Record<string, unknown>) => {
        const res = await fetch(`${url}/rest/v1/edge_function_errors`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": key,
            "Authorization": `Bearer ${key}`,
            "Prefer": "return=minimal",
          },
          body: JSON.stringify(row),
        });
        if (!res.ok) {
          throw new Error(`postgrest ${res.status}`);
        }
      },
    };
    return _mirrorClient.insert.bind(_mirrorClient);
  }
}

function mirrorErrorToDb(
  event: string,
  errMessage: string,
  tags: Record<string, string>,
): void {
  // Resolve function_name from (in order):
  //   1. explicit tag keys callers pass: fn_name / functionName / fn
  //   2. the event-string prefix before the first `.` — every captureError
  //      site in the codebase uses the convention `"<fn_name>.<sub_event>"`
  //      (e.g. `"style_chat.clarifier_call_failed"`,
  //       `"analyze_garment.base64_decode_failed"`). Without this fallback,
  //      `edge_function_errors.function_name` stores the full event string
  //      and alert_check's exact-match `.in("function_name", ["style_chat", ...])`
  //      filter never matches — making the AI error-rate rule blind.
  //   3. last resort: the raw event string.
  const fnTag = (tags.fn_name && tags.fn_name !== "unknown" && tags.fn_name)
    || (tags.functionName && tags.functionName !== "unknown" && tags.functionName)
    || (tags.fn && tags.fn !== "unknown" && tags.fn)
    || null;
  const eventPrefix = event.includes(".") ? event.split(".", 1)[0] : null;
  const resolvedFn = fnTag ?? eventPrefix ?? event;

  // Build the row.
  const row: Record<string, unknown> = {
    function_name: resolvedFn,
    error_class: tags.error_class && tags.error_class !== "unknown"
      ? tags.error_class
      : event,
    error_message: errMessage.slice(0, 2000),
    metadata: tags,
  };
  if (tags.user_id && tags.user_id !== "unknown" && isUuid(tags.user_id)) {
    row.user_id = tags.user_id;
  }
  if (tags.request_id && tags.request_id !== "unknown" && isUuid(tags.request_id)) {
    row.request_id = tags.request_id;
  }

  // Fire-and-forget; swallow ALL failures.
  getMirrorInsert()
    .then((insertFn) => {
      if (!insertFn) return;
      // .insert() returns a thenable; chain a .then/.catch (PostgrestBuilder
      // is then-able). Wrap in Promise.resolve to be safe.
      Promise.resolve(insertFn(row)).catch(() => {
        // swallowed — DB outage must not break the user request
      });
    })
    .catch(() => {
      // swallowed
    });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(v: string): boolean {
  return UUID_RE.test(v);
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
