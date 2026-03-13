/**
 * Dynamic CORS origin for Edge Functions.
 *
 * Accepts the production domain (ALLOWED_ORIGIN secret) and
 * Lovable preview/published domains automatically.
 * Falls back to '*' for local dev.
 */

const LOVABLE_PREVIEW_RE = /^https:\/\/.*\.lovable\.app$/;
const LOVABLE_DEV_RE = /^https:\/\/.*\.lovableproject\.com$/;

/**
 * Returns the correct Access-Control-Allow-Origin for a given request origin.
 * Call this per-request when you have access to the Origin header.
 */
export function resolveOrigin(requestOrigin: string | null): string {
  const allowed = Deno.env.get("ALLOWED_ORIGIN");

  if (!requestOrigin) return allowed || "*";

  // Production domain match
  if (allowed && requestOrigin === allowed) return allowed;

  // Lovable preview & published domains
  if (LOVABLE_PREVIEW_RE.test(requestOrigin) || LOVABLE_DEV_RE.test(requestOrigin)) {
    return requestOrigin;
  }

  // Fallback: if no ALLOWED_ORIGIN set, allow all (dev mode)
  return allowed || "*";
}

/**
 * Legacy static export — kept for backward compatibility.
 * Prefer resolveOrigin(req.headers.get("origin")) for per-request CORS.
 */
export const allowedOrigin = Deno.env.get("ALLOWED_ORIGIN") || "*";
