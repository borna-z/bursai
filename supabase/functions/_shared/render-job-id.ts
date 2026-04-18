/**
 * Deterministic render-job ID derivation.
 *
 * Both `enqueue_render_job` (P5) and `render_garment_image` (P4 external
 * path) must produce the SAME job ID from the SAME base key so the credit
 * ledger's `render_job_id` stays consistent across:
 *   * enqueue retries with the same clientNonce after a transport/INSERT
 *     failure — reserve+INSERT both use the same ID, consume/release
 *     resolve the reservation correctly
 *   * P4 legacy external callers and P5 worker internal callers
 *     targeting the same garment × presentation × prompt_version ×
 *     clientNonce tuple
 *
 * SHA-256 of the seed → 32 hex chars → formatted as a canonical UUID.
 * Not a "real" UUID (v4), but stored/queried as one and unique per seed.
 *
 * The seed is the `baseKey` from both callers:
 *   `${user.id}_${garment.id}_${presentation}_${RENDER_PROMPT_VERSION}_${clientNonce}`
 */
export async function deriveRenderJobId(seed: string): Promise<string> {
  const bytes = new TextEncoder().encode(seed);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  const hex = Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return (
    hex.slice(0, 8) +
    "-" +
    hex.slice(8, 12) +
    "-" +
    hex.slice(12, 16) +
    "-" +
    hex.slice(16, 20) +
    "-" +
    hex.slice(20, 32)
  );
}
