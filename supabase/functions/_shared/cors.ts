/**
 * Dynamic CORS origin for Edge Functions.
 *
 * Accepts the production domain (ALLOWED_ORIGIN secret) and
 * Lovable preview/published domains automatically.
 * Falls back to '*' for local dev.
 */

const LOVABLE_PREVIEW_RE = /^https:\/\/.*\.lovable\.app$/;
const LOVABLE_DEV_RE = /^https:\/\/.*\.lovableproject\.com$/;

const KNOWN_ORIGINS = new Set([
  "https://burs.me",
  "https://bursai-mu9m.vercel.app",
  "http://localhost:8080",
]);

/**
 * Returns the correct Access-Control-Allow-Origin for a given request origin.
 * Call this per-request when you have access to the Origin header.
 */
export function resolveOrigin(requestOrigin: string | null): string {
  const allowed = Deno.env.get("ALLOWED_ORIGIN");

  if (!requestOrigin) return allowed || "*";

  // Production domain match
  if (allowed && requestOrigin === allowed) return allowed;

  // Known origins (production, Vercel preview, local dev)
  if (KNOWN_ORIGINS.has(requestOrigin)) return requestOrigin;

  // Lovable preview & published domains
  if (LOVABLE_PREVIEW_RE.test(requestOrigin) || LOVABLE_DEV_RE.test(requestOrigin)) {
    return requestOrigin;
  }

  // Fallback: if no ALLOWED_ORIGIN set, allow all (dev mode)
  return allowed || "*";
}

/**
 * Static export used by all edge functions.
 *
 * We use "*" because JWT authentication is the real security boundary.
 * CORS origin restrictions on authenticated API endpoints provide minimal
 * additional security and cause issues with preview/staging domains.
 */
export const allowedOrigin = "*";
