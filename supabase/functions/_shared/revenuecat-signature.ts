/**
 * RevenueCat webhook HMAC signature validation.
 *
 * Extracted from `supabase/functions/revenuecat_webhook/index.ts` so the
 * pure crypto + comparator pair is unit-testable without pulling in the
 * webhook entrypoint (which calls `serve()` at module load).
 *
 * Signature scheme (per the M31 wave file):
 *   HMAC SHA256 over the raw body, delivered via the
 *   `X-RevenueCat-Signature` header. The header value may be a bare hex
 *   digest or prefixed `sha256=<hex>` — both shapes are accepted.
 *   Comparison is constant-time via `timingSafeEqual`.
 */

import { timingSafeEqual } from "./timing-safe.ts";

export const SIGNATURE_HEADER = "x-revenuecat-signature";

export async function computeHmacHex(secret: string, body: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(body));
  const bytes = new Uint8Array(sig);
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, "0");
  }
  return out;
}

export function normalizeSignature(raw: string): string {
  const trimmed = raw.trim();
  const eq = trimmed.indexOf("=");
  if (eq > 0 && trimmed.slice(0, eq).toLowerCase() === "sha256") {
    return trimmed.slice(eq + 1).trim().toLowerCase();
  }
  return trimmed.toLowerCase();
}

export async function verifyRevenueCatSignature(
  secret: string,
  body: string,
  headerSignature: string,
): Promise<boolean> {
  const expectedHex = await computeHmacHex(secret, body);
  const provided = normalizeSignature(headerSignature);
  return timingSafeEqual(expectedHex, provided);
}
