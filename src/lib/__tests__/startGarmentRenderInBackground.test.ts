import { beforeEach, describe, expect, it, vi } from 'vitest';

// Track each supabase.from('garments').update(payload).eq('id', id) call.
// Each test can read this list to assert the garment state update sequence.
type GarmentUpdateCall = { table: string; payload: Record<string, unknown>; eqArg: unknown };
const garmentUpdateCalls: GarmentUpdateCall[] = [];

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
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
          limit: vi.fn(() => q),
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
          single: vi.fn().mockResolvedValue({ data: { ai_raw: null }, error: null }),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
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

  it('does NOT reset garment render_status on 402 (trial/insufficient) — upgrade flow will retry', async () => {
    // 402 is a business denial, not a transport failure. The user's
    // upgrade UX is expected to re-trigger enqueue after they purchase,
    // and preserving render_status='pending' preserves their intent
    // across that flow. Resetting to 'none' here would silently drop
    // the regenerate intent mid-upgrade.
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

    await vi.waitFor(() => {
      expect(vi.mocked(invokeEdgeFunction)).toHaveBeenCalledWith(
        'enqueue_render_job',
        expect.anything(),
      );
    });

    // Give the catch handler a tick to complete any state reset that
    // should NOT happen in this path.
    await new Promise((r) => setTimeout(r, 50));

    const resetsForTrialLocked = garmentUpdateCalls.filter(
      (c) => c.table === 'garments'
        && c.eqArg === 'garment-trial-locked'
        && c.payload.render_status === 'none',
    );
    expect(resetsForTrialLocked.length).toBe(0);
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
});
