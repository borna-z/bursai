import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockInvoke = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: { invoke: mockInvoke },
  },
}));

import { invokeEdgeFunction, EdgeFunctionTimeoutError } from '../edgeFunctionClient';

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

  it('retries on error and eventually succeeds', async () => {
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

  it('EdgeFunctionTimeoutError has correct name', () => {
    const err = new EdgeFunctionTimeoutError('my_fn');
    expect(err.name).toBe('EdgeFunctionTimeoutError');
    expect(err.message).toContain('my_fn');
  });
});
