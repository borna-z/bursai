import { beforeEach, describe, expect, it, vi } from 'vitest';

// Track each supabase.from('garments').update(payload).eq('id', id) call.
// Each test can read this list to assert the garment state update sequence.
type GarmentUpdateCall = { table: string; payload: Record<string, unknown>; eqArg: unknown };
const garmentUpdateCalls: GarmentUpdateCall[] = [];

// Round-16 Bug 1: the server-state check queries render_jobs by
// (user_id, garment_id, reserve_key LIKE '%nonce'). Tests toggle this
// to simulate "row exists server-side" vs "no row (genuine failure)".
type RenderJobsLookup = { data: { id: string; status: string } | null; error: { message: string } | null };
let mockRenderJobsLookup: RenderJobsLookup = { data: null, error: null };
let mockAuthUser: { id: string } | null = { id: 'test-user-id' };

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: mockAuthUser }, error: null })),
    },
    from: vi.fn((table: string) => ({
      update: vi.fn((payload: Record<string, unknown>) => ({
        eq: vi.fn(async (_column: string, value: unknown) => {
          garmentUpdateCalls.push({ table, payload, eqArg: value });
          return { error: null };
        }),
      })),
      select: vi.fn(() => {
        const q = {
          eq: vi.fn(() => q),
          like: vi.fn(() => q),
          limit: vi.fn(() => q),
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
          single: vi.fn().mockResolvedValue({ data: { ai_raw: null }, error: null }),
          // Round-16: the Bug-1 server-state check calls maybeSingle() on
          // render_jobs. Every other maybeSingle() consumer in this code
          // path (garment-record fetches in the reset helper, etc.)
          // tolerates a null result. Gating the configurable response on
          // the table name keeps this mock shape sane.
          maybeSingle: vi.fn().mockImplementation(() => {
            if (table === 'render_jobs') {
              return Promise.resolve(mockRenderJobsLookup);
            }
            return Promise.resolve({ data: null, error: null });
          }),
        };
        return q;
      }),
    })),
  },
}));

vi.mock('@/lib/edgeFunctionClient', async (importOriginal) => {
  // Keep the real getHttpStatus (pure helper used by enqueueRenderJob to
  // extract HTTP status from supabase-js FunctionsHttpError). Only the
  // network call is mocked.
  const actual = await importOriginal<typeof import('@/lib/edgeFunctionClient')>();
  return {
    ...actual,
    invokeEdgeFunction: vi.fn(),
  };
});

import { invokeEdgeFunction } from '@/lib/edgeFunctionClient';
import { triggerGarmentPostSaveIntelligence } from '@/lib/garmentIntelligence';

describe('startGarmentRenderInBackground enqueue failure recovery (Codex round 11 Bug 2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    garmentUpdateCalls.length = 0;
    // Default: no server-side row (simulates genuine enqueue failure).
    // Round-16 server-state-check tests override per-case.
    mockRenderJobsLookup = { data: null, error: null };
    mockAuthUser = { id: 'test-user-id' };
  });

  it('resets garment render_status to "none" when enqueue fails after nonce-preserving retry', async () => {
    // Simulates a Supabase Edge Functions 503 blip during a network-flaky
    // moment. Pre-round-11, the garment was INSERTed with
    // render_status='pending' by buildGarmentIntelligenceFields, and if
    // both enqueue attempts failed we'd leave it at 'pending' forever —
    // no render_jobs row existed, resumePendingGarmentRenders was a
    // no-op under P5, so nothing recovers this garment.
    vi.mocked(invokeEdgeFunction).mockImplementation((fn: string) => {
      if (fn === 'analyze_garment') {
        return Promise.resolve({ data: { enrichment: { refined_title: 'Test' } }, error: null });
      }
      if (fn === 'enqueue_render_job') {
        return Promise.resolve({
          data: null,
          error: Object.assign(new Error('rpc_error'), { context: { status: 503 } }),
        } as never);
      }
      return Promise.resolve({ data: {}, error: null });
    });

    triggerGarmentPostSaveIntelligence({
      garmentId: 'garment-stuck-pending',
      storagePath: 'user-1/photo.jpg',
      source: 'add_photo',
      imageProcessing: { mode: 'skip' },
    });

    // Wait for enqueue (first call + retry) + the recovery update.
    await vi.waitFor(
      () => {
        const enqueueCalls = vi
          .mocked(invokeEdgeFunction)
          .mock.calls.filter((call) => call[0] === 'enqueue_render_job');
        expect(enqueueCalls.length).toBeGreaterThanOrEqual(2);
        const garmentResets = garmentUpdateCalls.filter(
          (c) => c.table === 'garments'
            && c.eqArg === 'garment-stuck-pending'
            && c.payload.render_status === 'none',
        );
        expect(garmentResets.length).toBe(1);
      },
      { timeout: 5000 },
    );
  });

  it('resets garment render_status to "none" on 402 (trial/insufficient) — round 14 fix', async () => {
    // Round 11 initially skipped the reset on 402, reasoning the upgrade
    // flow would re-trigger enqueue after purchase. That was wrong under
    // P5: enqueue_render_job returns 402 BEFORE any render_jobs row is
    // written, so the durable worker has nothing to pick up; and
    // resumePendingGarmentRenders is a P5 no-op. Result pre-round-14:
    // garment stranded at render_status='pending' forever, UI showed
    // "Refining…" even after the user upgraded. Round 14: 402 must
    // reset the garment to 'none' so the Studio photo CTA reappears
    // and the user can retry from the wardrobe after upgrading.
    vi.mocked(invokeEdgeFunction).mockImplementation((fn: string) => {
      if (fn === 'analyze_garment') {
        return Promise.resolve({ data: { enrichment: { refined_title: 'Test' } }, error: null });
      }
      if (fn === 'enqueue_render_job') {
        return Promise.resolve({
          data: null,
          error: Object.assign(new Error('trial_studio_locked'), {
            context: { status: 402 },
            code: 'trial_studio_locked',
          }),
        } as never);
      }
      return Promise.resolve({ data: {}, error: null });
    });

    triggerGarmentPostSaveIntelligence({
      garmentId: 'garment-trial-locked',
      storagePath: 'user-1/photo.jpg',
      source: 'add_photo',
      imageProcessing: { mode: 'skip' },
    });

    await vi.waitFor(
      () => {
        const resetsForTrialLocked = garmentUpdateCalls.filter(
          (c) => c.table === 'garments'
            && c.eqArg === 'garment-trial-locked'
            && c.payload.render_status === 'none',
        );
        expect(resetsForTrialLocked.length).toBe(1);
      },
      { timeout: 5000 },
    );

    // 402 is non-retryable (isRenderEnqueueRetryable(402) === false), so
    // the enqueue should fire exactly once — no same-nonce retry.
    const enqueueCalls = vi
      .mocked(invokeEdgeFunction)
      .mock.calls.filter((call) => call[0] === 'enqueue_render_job');
    expect(enqueueCalls.length).toBe(1);
  });

  it('does NOT reset garment when the retry succeeds (happy-path retry does not pollute state)', async () => {
    let callCount = 0;
    vi.mocked(invokeEdgeFunction).mockImplementation((fn: string) => {
      if (fn === 'analyze_garment') {
        return Promise.resolve({ data: { enrichment: { refined_title: 'Test' } }, error: null });
      }
      if (fn === 'enqueue_render_job') {
        callCount += 1;
        if (callCount === 1) {
          return Promise.resolve({
            data: null,
            error: Object.assign(new Error('rpc_error'), { context: { status: 503 } }),
          } as never);
        }
        return Promise.resolve({
          data: { jobId: 'j-retry-success', status: 'pending', source: 'monthly', replay: false },
          error: null,
        });
      }
      return Promise.resolve({ data: {}, error: null });
    });

    triggerGarmentPostSaveIntelligence({
      garmentId: 'garment-retry-succeeds',
      storagePath: 'user-1/photo.jpg',
      source: 'add_photo',
      imageProcessing: { mode: 'skip' },
    });

    await vi.waitFor(
      () => {
        const enqueueCalls = vi
          .mocked(invokeEdgeFunction)
          .mock.calls.filter((call) => call[0] === 'enqueue_render_job');
        expect(enqueueCalls.length).toBeGreaterThanOrEqual(2);
      },
      { timeout: 5000 },
    );

    await new Promise((r) => setTimeout(r, 50));

    const resetsForRetrySuccess = garmentUpdateCalls.filter(
      (c) => c.table === 'garments' && c.eqArg === 'garment-retry-succeeds' && c.payload.render_status === 'none',
    );
    expect(resetsForRetrySuccess.length).toBe(0);
  });

  it('server-state check (round 16): DOES NOT reset when a render_jobs row exists despite client retry failure', async () => {
    // Bug 1 scenario: first enqueue returns 5xx → retry with same nonce
    // also returns 5xx → but server actually INSERTed the row on one of
    // the two attempts before 5xx was returned (or before the TCP
    // connection was reset). Pre-round-16, client reset garment to
    // 'none' → user sees "re-trigger" UI → fresh clientNonce on retry
    // → second reservation + second render_jobs row = double-charge.
    // Round-16: before resetting, client queries render_jobs for a row
    // matching (user_id, garment_id, reserve_key suffix=clientNonce).
    // If found: leave the worker to drive garment state, skip reset.
    mockRenderJobsLookup = {
      data: { id: 'job-that-landed-server-side', status: 'pending' },
      error: null,
    };

    vi.mocked(invokeEdgeFunction).mockImplementation((fn: string) => {
      if (fn === 'analyze_garment') {
        return Promise.resolve({ data: { enrichment: { refined_title: 'Test' } }, error: null });
      }
      if (fn === 'enqueue_render_job') {
        return Promise.resolve({
          data: null,
          error: Object.assign(new Error('rpc_error'), { context: { status: 503 } }),
        } as never);
      }
      return Promise.resolve({ data: {}, error: null });
    });

    triggerGarmentPostSaveIntelligence({
      garmentId: 'garment-row-landed-server-side',
      storagePath: 'user-1/photo.jpg',
      source: 'add_photo',
      imageProcessing: { mode: 'skip' },
    });

    // Wait for the retry to finish (2 enqueue calls) + enough time for
    // the post-retry server-state check to run.
    await vi.waitFor(
      () => {
        const enqueueCalls = vi
          .mocked(invokeEdgeFunction)
          .mock.calls.filter((call) => call[0] === 'enqueue_render_job');
        expect(enqueueCalls.length).toBeGreaterThanOrEqual(2);
      },
      { timeout: 5000 },
    );
    await new Promise((r) => setTimeout(r, 100));

    // Assertion: NO reset of render_status to 'none' for this garment,
    // because the server-state check found the row.
    const resets = garmentUpdateCalls.filter(
      (c) => c.table === 'garments'
        && c.eqArg === 'garment-row-landed-server-side'
        && c.payload.render_status === 'none',
    );
    expect(resets.length).toBe(0);
  });

  it('server-state check (round 16): DOES reset when no render_jobs row is found (genuine enqueue failure)', async () => {
    // Counterfactual to the test above. Same 5xx-then-5xx pattern, but
    // the server-state lookup returns null (no row landed on the
    // server). The pre-round-16 reset behavior is preserved — garment
    // flips to 'none' so the user can retry from the Studio photo CTA.
    // This is the normal transport-failure recovery path.
    mockRenderJobsLookup = { data: null, error: null };

    vi.mocked(invokeEdgeFunction).mockImplementation((fn: string) => {
      if (fn === 'analyze_garment') {
        return Promise.resolve({ data: { enrichment: { refined_title: 'Test' } }, error: null });
      }
      if (fn === 'enqueue_render_job') {
        return Promise.resolve({
          data: null,
          error: Object.assign(new Error('rpc_error'), { context: { status: 503 } }),
        } as never);
      }
      return Promise.resolve({ data: {}, error: null });
    });

    triggerGarmentPostSaveIntelligence({
      garmentId: 'garment-genuine-enqueue-fail',
      storagePath: 'user-1/photo.jpg',
      source: 'add_photo',
      imageProcessing: { mode: 'skip' },
    });

    await vi.waitFor(
      () => {
        const resets = garmentUpdateCalls.filter(
          (c) => c.table === 'garments'
            && c.eqArg === 'garment-genuine-enqueue-fail'
            && c.payload.render_status === 'none',
        );
        expect(resets.length).toBe(1);
      },
      { timeout: 5000 },
    );
  });
});
