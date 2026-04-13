import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { expires_at: Math.floor(Date.now() / 1000) + 3600 } }, error: null }),
      refreshSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    },
  },
}));

import { supabase } from '@/integrations/supabase/client';
import { invokeEdgeFunction, EdgeFunctionTimeoutError, EdgeFunctionRateLimitError } from '../edgeFunctionClient';

const mockInvoke = supabase.functions.invoke as ReturnType<typeof vi.fn>;

describe('invokeEdgeFunction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns data on success', async () => {
    mockInvoke.mockResolvedValue({ data: { result: 'ok' }, error: null });
    const { data, error } = await invokeEdgeFunction('test_fn');
    expect(data).toEqual({ result: 'ok' });
    expect(error).toBeNull();
  });

  it('retries on transient error and eventually succeeds', async () => {
    mockInvoke
      .mockResolvedValueOnce({ data: null, error: new Error('fail') })
      .mockResolvedValueOnce({ data: { result: 'ok' }, error: null });

    const { data, error } = await invokeEdgeFunction('test_fn', { retries: 1 });
    expect(data).toEqual({ result: 'ok' });
    expect(error).toBeNull();
    expect(mockInvoke).toHaveBeenCalledTimes(2);
  });

  it('returns error after all retries exhausted', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: new Error('persistent fail') });
    const { data, error } = await invokeEdgeFunction('test_fn', { retries: 1 });
    expect(data).toBeNull();
    expect(error?.message).toBe('persistent fail');
  });

  it('handles thrown exceptions', async () => {
    mockInvoke.mockRejectedValue(new Error('network error'));
    const { data, error } = await invokeEdgeFunction('test_fn', { retries: 0 });
    expect(data).toBeNull();
    expect(error?.message).toBe('network error');
  });

  it('does NOT retry rate limit (429) errors', async () => {
    mockInvoke.mockResolvedValue({
      data: { error: 'Rate limited', retryAfter: 60 },
      error: new Error('429 rate limit'),
    });
    const { data, error } = await invokeEdgeFunction('rate_limit_test', { retries: 2 });
    expect(error).toBeTruthy();
    // Should NOT have retried — only 1 call
    expect(mockInvoke).toHaveBeenCalledTimes(1);
  });

  it('retries 401 once after session refresh, then gives up', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: new Error('401 Unauthorized'),
    });
    const { error } = await invokeEdgeFunction('auth_test_fn', { retries: 2 });
    expect(error).toBeTruthy();
    // First attempt fails with 401 → refresh session → inline retry → still 401 → stop
    expect(mockInvoke).toHaveBeenCalledTimes(2);
  });

  it('retries 401 after refresh even when retries is 0', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: new Error('401 Unauthorized'),
    });
    const { error } = await invokeEdgeFunction('auth_zero_retry_fn', { retries: 0 });
    expect(error).toBeTruthy();
    // Auth recovery is inline — works even with retries: 0
    expect(mockInvoke).toHaveBeenCalledTimes(2);
  });

  it('recovers from 401 when refresh succeeds', async () => {
    mockInvoke
      .mockResolvedValueOnce({ data: null, error: new Error('401 Unauthorized') })
      .mockResolvedValueOnce({ data: { ok: true }, error: null });
    const { data, error } = await invokeEdgeFunction('auth_recover_fn', { retries: 0 });
    expect(error).toBeNull();
    expect(data).toEqual({ ok: true });
    expect(mockInvoke).toHaveBeenCalledTimes(2);
  });

  it('detects 401 from FunctionsHttpError context.status (real Supabase shape)', async () => {
    // Supabase FunctionsHttpError has a generic message + context with the Response
    const httpError = Object.assign(
      new Error('Edge Function returned a non-2xx status code'),
      { name: 'FunctionsHttpError', context: { status: 401 } },
    );
    mockInvoke.mockResolvedValue({ data: null, error: httpError });
    const { error } = await invokeEdgeFunction('context_401_fn', { retries: 0 });
    expect(error).toBeTruthy();
    // Should still attempt auth recovery via context.status detection
    expect(mockInvoke).toHaveBeenCalledTimes(2);
  });

  it('does NOT retry FunctionsHttpError 403 (non-retryable via context.status)', async () => {
    const httpError = Object.assign(
      new Error('Edge Function returned a non-2xx status code'),
      { name: 'FunctionsHttpError', context: { status: 403 } },
    );
    mockInvoke.mockResolvedValue({ data: null, error: httpError });
    const { error } = await invokeEdgeFunction('context_403_fn', { retries: 2 });
    expect(error).toBeTruthy();
    expect(mockInvoke).toHaveBeenCalledTimes(1);
  });

  it('detects rate limit from response data with retryAfter', async () => {
    mockInvoke.mockResolvedValue({
      data: { error: 'Too many requests', retryAfter: 30 },
      error: null,
    });
    const { error } = await invokeEdgeFunction('rate_data_test', { retries: 2 });
    expect(error).toBeInstanceOf(EdgeFunctionRateLimitError);
    expect((error as EdgeFunctionRateLimitError).retryAfter).toBe(30);
    expect(mockInvoke).toHaveBeenCalledTimes(1);
  });

  it('EdgeFunctionTimeoutError has correct name', () => {
    const err = new EdgeFunctionTimeoutError('my_fn');
    expect(err.name).toBe('EdgeFunctionTimeoutError');
    expect(err.message).toContain('my_fn');
  });

  it('EdgeFunctionRateLimitError has correct properties', () => {
    const err = new EdgeFunctionRateLimitError('my_fn', 60);
    expect(err.name).toBe('EdgeFunctionRateLimitError');
    expect(err.retryAfter).toBe(60);
    expect(err.message).toContain('my_fn');
  });

  it('circuit breaker opens after repeated failures', async () => {
    const fnName = `circuit_test_${Date.now()}`;
    // Fail the function 5+ times to trigger circuit breaker (threshold is 5)
    mockInvoke.mockResolvedValue({ data: null, error: new Error('server error') });

    for (let i = 0; i < 6; i++) {
      await invokeEdgeFunction(fnName, { retries: 0 });
    }

    // Next call should be blocked by circuit breaker without calling invoke
    mockInvoke.mockClear();
    const { error } = await invokeEdgeFunction(fnName, { retries: 0 });
    expect(error?.message).toContain('temporarily unavailable');
    expect(mockInvoke).toHaveBeenCalledTimes(0);
  });
});
