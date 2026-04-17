import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: vi.fn() },
}));

vi.mock('@/lib/edgeFunctionClient', () => ({
  invokeEdgeFunction: vi.fn(),
}));

import { invokeEdgeFunction } from '@/lib/edgeFunctionClient';
import { enqueueRenderJob, RenderEnqueueError } from '@/lib/garmentIntelligence';

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
    vi.mocked(invokeEdgeFunction).mockResolvedValue({
      data: null,
      error: Object.assign(new Error('trial_studio_locked'), { status: 402, code: 'trial_studio_locked' }),
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
      error: Object.assign(new Error('rpc_error'), { status: 503 }),
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
