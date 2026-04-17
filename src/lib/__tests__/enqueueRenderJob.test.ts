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

  it('calls enqueue_render_job edge function with a fresh clientNonce and returns job metadata on success', async () => {
    vi.mocked(invokeEdgeFunction).mockResolvedValue({
      data: { jobId: 'job-123', status: 'pending', source: 'monthly', replay: false },
      error: null,
    });

    const result = await enqueueRenderJob('garment-1', 'add_photo');

    expect(result).toEqual({
      jobId: 'job-123',
      status: 'pending',
      source: 'monthly',
      replay: false,
    });

    expect(invokeEdgeFunction).toHaveBeenCalledWith(
      'enqueue_render_job',
      expect.objectContaining({
        retries: 0,
        body: expect.objectContaining({
          garmentId: 'garment-1',
          source: 'add_photo',
          clientNonce: expect.any(String),
        }),
      }),
    );

    const call = vi.mocked(invokeEdgeFunction).mock.calls[0];
    const body = (call[1] as { body: { clientNonce: string } }).body;
    expect(body.clientNonce).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  it('reuses a supplied clientNonce (idempotent enqueue retry)', async () => {
    vi.mocked(invokeEdgeFunction).mockResolvedValue({
      data: { jobId: 'job-123', status: 'pending', source: 'monthly', replay: true },
      error: null,
    });

    const stableNonce = 'fixed-nonce-for-replay-test';
    const result = await enqueueRenderJob('garment-1', 'retry', { clientNonce: stableNonce });

    expect(result.replay).toBe(true);
    expect(invokeEdgeFunction).toHaveBeenCalledWith(
      'enqueue_render_job',
      expect.objectContaining({
        body: expect.objectContaining({ clientNonce: stableNonce }),
      }),
    );
  });

  it('throws RenderEnqueueError with status when the edge function returns 402 (trial locked / insufficient)', async () => {
    vi.mocked(invokeEdgeFunction).mockResolvedValue({
      data: null,
      error: Object.assign(new Error('trial_studio_locked'), { status: 402, code: 'trial_studio_locked' }),
    });

    await expect(enqueueRenderJob('garment-1', 'add_photo')).rejects.toThrow(RenderEnqueueError);
    try {
      await enqueueRenderJob('garment-1', 'add_photo');
    } catch (e) {
      expect(e).toBeInstanceOf(RenderEnqueueError);
      expect((e as RenderEnqueueError).status).toBe(402);
      expect((e as RenderEnqueueError).code).toBe('trial_studio_locked');
    }
  });

  it('throws RenderEnqueueError when the edge function returns 5xx (transport/RPC failure)', async () => {
    vi.mocked(invokeEdgeFunction).mockResolvedValue({
      data: null,
      error: Object.assign(new Error('rpc_error'), { status: 503 }),
    });

    await expect(enqueueRenderJob('garment-1', 'add_photo')).rejects.toThrow(RenderEnqueueError);
  });

  it('throws when the edge function returns 200 but no jobId (defensive check)', async () => {
    vi.mocked(invokeEdgeFunction).mockResolvedValue({
      data: {} as never,
      error: null,
    });

    await expect(enqueueRenderJob('garment-1', 'add_photo')).rejects.toThrow(RenderEnqueueError);
  });
});
