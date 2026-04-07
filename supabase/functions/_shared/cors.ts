/**
 * Shared origin handling for Edge Functions.
 *
 * CORS remains permissive because authenticated Supabase endpoints rely on JWTs.
 * Redirect targets (for Stripe and OAuth flows) are stricter and only allow known
 * BURS app origins, current Vercel preview origins, plus optional environment-configured origins.
 */

const DEFAULT_APP_ORIGIN = "https://burs.me";
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

  if (!requestOrigin) return allowed || "*";

  if (isKnownAppOrigin(requestOrigin)) return requestOrigin;

  return allowed || "*";
}

export function resolveAppOrigin(requestOrigin: string | null): string {
  if (requestOrigin && isKnownAppOrigin(requestOrigin)) {
    return requestOrigin;
  }

  return Deno.env.get("BURS_APP_URL")
    || Deno.env.get("ALLOWED_ORIGIN")
    || DEFAULT_APP_ORIGIN;
}

export const allowedOrigin = "*";

/**
 * Shared CORS headers for all edge functions.
 *
 * The Allow-Headers list is a superset of every header any edge function needs
 * (Supabase client headers, Stripe signature, idempotency keys, etc.).
 * Listing extra allowed headers is harmless — the browser only sends headers
 * the client actually sets.
 */
export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": allowedOrigin,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, " +
    "x-idempotency-key, stripe-signature, " +
    "x-supabase-client-platform, x-supabase-client-platform-version, " +
    "x-supabase-client-runtime, x-supabase-client-runtime-version",
};
