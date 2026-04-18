import { describe, it, expect } from 'vitest';
import { RENDER_POLL_TIMEOUT_MS } from '@/components/garment/GarmentConfirmSheet';

describe('GarmentConfirmSheet render polling budget', () => {
  // Codex round 9 fix: the prior 60s budget was a P5 regression. Slow renders
  // (Gemini retry × backoff, worker max_attempts × 45s) exceed 60s routinely;
  // false-failing the UI at 60s invites the user to tap "Try again", which
  // generates a fresh clientNonce and a second reservation → double-charge.
  // 5 minutes covers server's retry budget with headroom.
  it('is 300_000 ms (5 minutes), not the pre-fix 60_000 ms', () => {
    expect(RENDER_POLL_TIMEOUT_MS).toBe(300_000);
    expect(RENDER_POLL_TIMEOUT_MS).not.toBe(60_000);
  });

  it('covers at least (max_attempts × invokeRender-timeout) server-side budget', () => {
    // Server-side budget math: max_attempts=3 × invokeRender 45s = 135s.
    // Client-side budget must equal or exceed so the UI doesn't false-fail
    // while the server is still legitimately retrying.
    const SERVER_RETRY_BUDGET_MS = 3 * 45_000;
    expect(RENDER_POLL_TIMEOUT_MS).toBeGreaterThanOrEqual(SERVER_RETRY_BUDGET_MS);
  });
});
