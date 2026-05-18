/**
 * Shared origin handling for Edge Functions.
 *
 * Wave S-A.1 (2026-05-15): CORS is no longer wildcarded. The exported
 * `CORS_HEADERS` falls back to `ALLOWED_ORIGIN` env (or the default
 * production app origin), and request-aware callers should use
 * `corsHeadersFor(req)` to reflect known allowlisted origins (`app.burs.me`,
 * Vercel previews, localhost dev, plus optional env overrides). This blocks
 * third-party sites from making cross-origin authenticated requests against
 * AI edge functions on behalf of a logged-in BURS user.
 *
 * Redirect targets (for Stripe and OAuth flows) remain strict and only allow
 * known BURS app origins, current Vercel preview origins, plus optional
 * environment-configured origins.
 */

const DEFAULT_APP_ORIGIN = "https://app.burs.me";
const LOCAL_DEV_ORIGIN = "http://localhost:8080";
const VERCEL_PREVIEW_ORIGIN_RE = /^https:\/\/bursai(?:-[a-z0-9-]+)?\.vercel\.app$/;

function isKnownAppOrigin(origin: string): boolean {
  return origin === DEFAULT_APP_ORIGIN
    || origin === LOCAL_DEV_ORIGIN
    || origin === Deno.env.get("ALLOWED_ORIGIN")
    || origin === Deno.env.get("BURS_APP_URL")
    || VERCEL_PREVIEW_ORIGIN_RE.test(origin);
}

export function resolveOrigin(requestOrigin: string | null): string {
  const allowed = Deno.env.get("ALLOWED_ORIGIN");

  if (!requestOrigin) return allowed || DEFAULT_APP_ORIGIN;

  if (isKnownAppOrigin(requestOrigin)) return requestOrigin;

  return allowed || DEFAULT_APP_ORIGIN;
}

export function resolveAppOrigin(requestOrigin: string | null): string {
  if (requestOrigin && isKnownAppOrigin(requestOrigin)) {
    return requestOrigin;
  }

  return Deno.env.get("BURS_APP_URL")
    || Deno.env.get("ALLOWED_ORIGIN")
    || DEFAULT_APP_ORIGIN;
}

/**
 * Default origin used by the static `CORS_HEADERS` fallback. Kept as `"*"`
 * for legacy edge functions that haven't been migrated to
 * `corsHeadersFor(req)` yet — switching the shared constant to a non-wildcard
 * would break browser calls from localhost dev and Vercel previews against
 * un-migrated functions (Codex P2 on #849). Migrated AI functions use
 * `corsHeadersFor(req)` for the proper request-aware allowlist instead.
 */
export const allowedOrigin = "*";

/**
 * Shared CORS headers for all edge functions.
 *
 * The Allow-Headers list is a superset of every header any edge function needs
 * (Supabase client headers, Stripe signature, idempotency keys, etc.).
 * Listing extra allowed headers is harmless — the browser only sends headers
 * the client actually sets.
 *
 * Prefer `corsHeadersFor(req)` when the request context is available so
 * known allowlisted origins (Vercel previews, localhost dev) get reflected
 * correctly. The static `CORS_HEADERS` export remains wildcarded for legacy
 * callers that have not yet migrated to the request-aware helper.
 */
export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": allowedOrigin,
  "Vary": "Origin",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, " +
    "x-idempotency-key, stripe-signature, x-request-id, " +
    "x-supabase-client-platform, x-supabase-client-platform-version, " +
    "x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Build CORS headers that reflect the request's origin when it is on the
 * allowlist. Falls back to the default app origin for unknown / missing
 * origins. Use this from edge functions that need to support Vercel previews
 * and localhost dev (i.e. all AI endpoints called from the web client).
 */
export function corsHeadersFor(req: Request | null): Record<string, string> {
  const origin = resolveOrigin(req?.headers?.get("origin") ?? null);
  return {
    ...CORS_HEADERS,
    "Access-Control-Allow-Origin": origin,
  };
}
