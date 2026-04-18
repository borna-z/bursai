/**
 * Constant-time string equality check.
 *
 * JavaScript's native `===` short-circuits at the first differing byte,
 * leaking timing information when comparing secrets (service-role keys,
 * HMAC signatures, bearer tokens). An attacker with network access and
 * enough samples can iteratively brute-force the secret byte-by-byte.
 *
 * This helper compares by XOR'ing every byte and OR'ing the results,
 * so the total comparison time is proportional to the MAX(a.length,
 * b.length), not the position of the first mismatch.
 *
 * Length-mismatch is handled by comparing against a zero-padded copy of
 * the shorter string, then returning false — so the caller still knows
 * the strings differ, but the comparison itself doesn't leak length via
 * an early return.
 *
 * Used for:
 *   * Service-role Bearer token auth in process_render_jobs
 *   * internal-mode service-role check in render_garment_image
 *   * Any future webhook signature verification
 */
export function timingSafeEqual(a: string, b: string): boolean {
  const ua = new TextEncoder().encode(a);
  const ub = new TextEncoder().encode(b);

  // Allocate a max-length buffer to walk both in constant time without
  // bailing early on length mismatch.
  const length = Math.max(ua.length, ub.length);
  let diff = ua.length ^ ub.length;

  for (let i = 0; i < length; i++) {
    const byteA = i < ua.length ? ua[i] : 0;
    const byteB = i < ub.length ? ub[i] : 0;
    diff |= byteA ^ byteB;
  }

  return diff === 0;
}
