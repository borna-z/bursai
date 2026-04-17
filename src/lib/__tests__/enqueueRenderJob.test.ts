import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: vi.fn() },
}));

vi.mock('@/lib/edgeFunctionClient', async (importOriginal) => {
  // Keep the real getHttpStatus (pure helper) so the error-shape assertions
  // exercise the actual extraction logic. Only invokeEdgeFunction is mocked.
  const actual = await importOriginal<typeof import('@/lib/edgeFunctionClient')>();
  return {
    ...actual,
    invokeEdgeFunction: vi.fn(),
  };
});

import { invokeEdgeFunction } from '@/lib/edgeFunctionClient';
import { enqueueRenderJob, RenderEnqueueError, isRenderEnqueueRetryable } from '@/lib/garmentIntelligence';

describe('enqueueRenderJob', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('generates a fresh clientNonce per call and returns job metadata on success', async () => {
    vi.mocked(invokeEdgeFunction).mockResolvedValue({
      data: { jobId: 'job-123', status: 'pending', source: 'monthly', replay: false },
      error: null,
    });

    const result = await enqueueRenderJob('garment-1', 'add_photo');

    expect(result).toEqual(expect.objectContaining({
      jobId: 'job-123',
      status: 'pending',
      source: 'monthly',
      replay: false,
    }));
    expect(result.clientNonce).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

    const call = vi.mocked(invokeEdgeFunction).mock.calls[0];
    const body = (call[1] as { body: { clientNonce: string } }).body;
    expect(body.clientNonce).toBe(result.clientNonce);
  });

  it('reuses a supplied clientNonce and returns it in the result (idempotent retry path)', async () => {
    vi.mocked(invokeEdgeFunction).mockResolvedValue({
      data: { jobId: 'job-123', status: 'pending', source: 'monthly', replay: true },
      error: null,
    });

    const stableNonce = 'fixed-nonce-for-replay-test';
    const result = await enqueueRenderJob('garment-1', 'retry', { clientNonce: stableNonce });

    expect(result.clientNonce).toBe(stableNonce);
    expect(result.replay).toBe(true);
    expect(invokeEdgeFunction).toHaveBeenCalledWith(
      'enqueue_render_job',
      expect.objectContaining({
        body: expect.objectContaining({ clientNonce: stableNonce }),
      }),
    );
  });

  it('throws RenderEnqueueError with the nonce attached on 402 so caller can display upgrade CTA', async () => {
    // supabase-js FunctionsHttpError stores HTTP status on `error.context.status`
    // (NOT directly on the error). Codex round 6 caught that we were reading
    // `error.status` → always `undefined` on real 4xx/5xx → RenderEnqueueError.status=0
    // → GarmentConfirmSheet's paywall never fired. Now routed through getHttpStatus.
    vi.mocked(invokeEdgeFunction).mockResolvedValue({
      data: null,
      error: Object.assign(new Error('trial_studio_locked'), {
        context: { status: 402 },
        code: 'trial_studio_locked',
      }),
    });

    try {
      await enqueueRenderJob('garment-1', 'add_photo');
      expect.fail('expected RenderEnqueueError');
    } catch (e) {
      expect(e).toBeInstanceOf(RenderEnqueueError);
      expect((e as RenderEnqueueError).status).toBe(402);
      expect((e as RenderEnqueueError).code).toBe('trial_studio_locked');
      // Nonce attached even on 402 so a later upgrade → retry flow can reuse it
      // rather than creating a second reservation.
      expect((e as RenderEnqueueError).clientNonce).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
    }
  });

  it('attaches the clientNonce to RenderEnqueueError on 5xx (transport failure) so caller can retry safely', async () => {
    vi.mocked(invokeEdgeFunction).mockResolvedValue({
      data: null,
      error: Object.assign(new Error('rpc_error'), { context: { status: 503 } }),
    });

    const nonce = 'nonce-that-must-survive-failure';
    try {
      await enqueueRenderJob('garment-1', 'add_photo', { clientNonce: nonce });
      expect.fail('expected RenderEnqueueError');
    } catch (e) {
      expect(e).toBeInstanceOf(RenderEnqueueError);
      expect((e as RenderEnqueueError).status).toBe(503);
      expect((e as RenderEnqueueError).clientNonce).toBe(nonce);
    }
  });

  it('status falls back to 0 when error has no context (transport-level failure, no HTTP response)', async () => {
    // Network error, fetch abort, DNS failure — supabase-js surfaces these as
    // a plain Error with no `context` field. isRenderEnqueueRetryable(0) must
    // return true so the call sites retry with the same nonce.
    vi.mocked(invokeEdgeFunction).mockResolvedValue({
      data: null,
      error: new Error('Failed to fetch'),
    });

    try {
      await enqueueRenderJob('garment-1', 'add_photo');
      expect.fail('expected RenderEnqueueError');
    } catch (e) {
      expect(e).toBeInstanceOf(RenderEnqueueError);
      expect((e as RenderEnqueueError).status).toBe(0);
    }
  });

  it('status falls back to 0 when context.status is not a number (malformed error)', async () => {
    // Defensive — an error shape with context but no numeric status should
    // still fall through to the transport-failure path, not crash.
    vi.mocked(invokeEdgeFunction).mockResolvedValue({
      data: null,
      error: Object.assign(new Error('weird'), { context: { status: '500' } }),
    });

    try {
      await enqueueRenderJob('garment-1', 'add_photo');
      expect.fail('expected RenderEnqueueError');
    } catch (e) {
      expect(e).toBeInstanceOf(RenderEnqueueError);
      expect((e as RenderEnqueueError).status).toBe(0);
    }
  });

  it('status reads 500 from context.status (server error retry path)', async () => {
    vi.mocked(invokeEdgeFunction).mockResolvedValue({
      data: null,
      error: Object.assign(new Error('Internal server error'), { context: { status: 500 } }),
    });

    try {
      await enqueueRenderJob('garment-1', 'add_photo', { clientNonce: 'keep-me' });
      expect.fail('expected RenderEnqueueError');
    } catch (e) {
      expect(e).toBeInstanceOf(RenderEnqueueError);
      expect((e as RenderEnqueueError).status).toBe(500);
      expect((e as RenderEnqueueError).clientNonce).toBe('keep-me');
    }
  });

  it('throws when the edge function returns 200 but no jobId (defensive check) and still attaches nonce', async () => {
    vi.mocked(invokeEdgeFunction).mockResolvedValue({
      data: {} as never,
      error: null,
    });

    const nonce = 'nonce-for-empty-response';
    try {
      await enqueueRenderJob('garment-1', 'add_photo', { clientNonce: nonce });
      expect.fail('expected RenderEnqueueError');
    } catch (e) {
      expect(e).toBeInstanceOf(RenderEnqueueError);
      expect((e as RenderEnqueueError).clientNonce).toBe(nonce);
    }
  });

  it('returns replay=true from server (row already existed under same reserve_key)', async () => {
    // Codex Bug 2/3 fix: server returns the ORIGINAL row's id + replay:true
    // when a retry with the same clientNonce hits the 23505 + SELECT path.
    // Client must trust the server-provided jobId, not infer from local state.
    vi.mocked(invokeEdgeFunction).mockResolvedValue({
      data: { jobId: 'original-job-id', status: 'in_progress', source: 'monthly', replay: true },
      error: null,
    });

    const result = await enqueueRenderJob('garment-1', 'retry', { clientNonce: 'retry-nonce' });

    expect(result.jobId).toBe('original-job-id');
    expect(result.status).toBe('in_progress');
    expect(result.replay).toBe(true);
  });
});

describe('isRenderEnqueueRetryable', () => {
  // Codex round 2 Bug A fix: transport failures (status 0/undefined) must
  // retry with the same nonce. Prior `status >= 500` check missed them.
  it('retries on transport-level failure (status 0)', () => {
    expect(isRenderEnqueueRetryable(0)).toBe(true);
  });

  it('retries on undefined status (network/abort surfaces as no status)', () => {
    expect(isRenderEnqueueRetryable(undefined)).toBe(true);
  });

  it('retries on 500-level server errors', () => {
    expect(isRenderEnqueueRetryable(500)).toBe(true);
    expect(isRenderEnqueueRetryable(502)).toBe(true);
    expect(isRenderEnqueueRetryable(503)).toBe(true);
    expect(isRenderEnqueueRetryable(504)).toBe(true);
  });

  it('does NOT retry on 4xx user-caused errors', () => {
    expect(isRenderEnqueueRetryable(400)).toBe(false);  // bad input
    expect(isRenderEnqueueRetryable(401)).toBe(false);  // auth
    expect(isRenderEnqueueRetryable(402)).toBe(false);  // credits
    expect(isRenderEnqueueRetryable(403)).toBe(false);  // forbidden
    expect(isRenderEnqueueRetryable(404)).toBe(false);  // not found
    expect(isRenderEnqueueRetryable(409)).toBe(false);  // conflict (replay_terminal)
    expect(isRenderEnqueueRetryable(429)).toBe(false);  // rate limit
  });

  it('does NOT retry on 2xx/3xx (defensive — never reached in practice but spec matters)', () => {
    expect(isRenderEnqueueRetryable(200)).toBe(false);
    expect(isRenderEnqueueRetryable(202)).toBe(false);
    expect(isRenderEnqueueRetryable(301)).toBe(false);
  });
});
