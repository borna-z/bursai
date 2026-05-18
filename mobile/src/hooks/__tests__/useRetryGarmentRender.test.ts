// useRetryGarmentRender smoke tests.
//
// The hook wraps callEdgeFunction('enqueue_render_job') in a React Query
// mutation with the same paywall + Sentry shape as useGenerateGarmentImage.

import { renderHook, act } from '@testing-library/react-native';

import { __resetSupabaseMock } from '../../__mocks__/supabase';
import { makeWrapper } from './testUtils';

jest.mock('../../contexts/AuthContext', () => ({
  __esModule: true,
  useAuth: jest.fn(() => ({ user: { id: 'user-1' }, profile: null })),
}));

jest.mock('../../lib/edgeFunctionClient', () => {
  class EdgeFunctionSubscriptionLockedError extends Error {
    constructor(fnName: string) {
      super(`Subscription required for ${fnName}`);
      this.name = 'EdgeFunctionSubscriptionLockedError';
    }
  }
  class EdgeFunctionRateLimitError extends Error {
    retryAfter: number;
    constructor(fnName: string, retryAfter: number) {
      super(`Rate limit for ${fnName}`);
      this.name = 'EdgeFunctionRateLimitError';
      this.retryAfter = retryAfter;
    }
  }
  return {
    __esModule: true,
    callEdgeFunction: jest.fn(),
    EdgeFunctionSubscriptionLockedError,
    EdgeFunctionRateLimitError,
    SUBSCRIPTION_SENTINEL: 'subscription_required',
  };
});

jest.mock('expo-crypto', () => ({
  __esModule: true,
  randomUUID: jest.fn(() => 'test-nonce-uuid'),
}));

jest.mock('../../lib/sentry', () => ({
  __esModule: true,
  Sentry: {
    withScope: jest.fn((cb: (s: { setTag: jest.Mock }) => void) =>
      cb({ setTag: jest.fn() }),
    ),
    captureException: jest.fn(),
  },
}));

const edge = require('../../lib/edgeFunctionClient') as {
  callEdgeFunction: jest.Mock;
  EdgeFunctionSubscriptionLockedError: typeof Error;
  EdgeFunctionRateLimitError: new (fn: string, retryAfter: number) => Error;
  SUBSCRIPTION_SENTINEL: string;
};
const sentryMod = require('../../lib/sentry') as { Sentry: { captureException: jest.Mock } };

beforeEach(() => {
  __resetSupabaseMock();
  edge.callEdgeFunction.mockReset();
  sentryMod.Sentry.captureException.mockReset();
});

describe('useRetryGarmentRender', () => {
  it('calls enqueue_render_job with source=retry and a client_nonce', async () => {
    edge.callEdgeFunction.mockResolvedValue({ ok: true });
    const { useRetryGarmentRender } = require('../useRetryGarmentRender');
    const { result } = renderHook(() => useRetryGarmentRender(), {
      wrapper: makeWrapper(),
    });
    await act(async () => {
      await result.current.mutateAsync('garment-1');
    });
    expect(edge.callEdgeFunction).toHaveBeenCalledTimes(1);
    const [fnName, opts] = edge.callEdgeFunction.mock.calls[0];
    expect(fnName).toBe('enqueue_render_job');
    expect(opts.body.garment_id).toBe('garment-1');
    expect(opts.body.source).toBe('retry');
    expect(typeof opts.body.client_nonce).toBe('string');
    expect(opts.body.client_nonce.length).toBeGreaterThan(0);
  });

  it('throws SUBSCRIPTION_SENTINEL on 402', async () => {
    edge.callEdgeFunction.mockRejectedValue(
      new edge.EdgeFunctionSubscriptionLockedError('enqueue_render_job'),
    );
    const { useRetryGarmentRender } = require('../useRetryGarmentRender');
    const { result } = renderHook(() => useRetryGarmentRender(), {
      wrapper: makeWrapper(),
    });
    await act(async () => {
      await expect(result.current.mutateAsync('garment-1')).rejects.toThrow(
        edge.SUBSCRIPTION_SENTINEL,
      );
    });
    expect(sentryMod.Sentry.captureException).not.toHaveBeenCalled();
  });

  it('re-throws EdgeFunctionRateLimitError on 429', async () => {
    const rateErr = new edge.EdgeFunctionRateLimitError('enqueue_render_job', 30);
    edge.callEdgeFunction.mockRejectedValue(rateErr);
    const { useRetryGarmentRender } = require('../useRetryGarmentRender');
    const { result } = renderHook(() => useRetryGarmentRender(), {
      wrapper: makeWrapper(),
    });
    await act(async () => {
      await expect(result.current.mutateAsync('garment-1')).rejects.toBe(rateErr);
    });
  });

  it('captures unexpected errors to Sentry', async () => {
    edge.callEdgeFunction.mockRejectedValue(new Error('boom'));
    const { useRetryGarmentRender } = require('../useRetryGarmentRender');
    const { result } = renderHook(() => useRetryGarmentRender(), {
      wrapper: makeWrapper(),
    });
    await act(async () => {
      await expect(result.current.mutateAsync('garment-1')).rejects.toThrow('boom');
    });
    expect(sentryMod.Sentry.captureException).toHaveBeenCalledTimes(1);
  });

  it('throws Not authenticated when no user is signed in', async () => {
    const auth = require('../../contexts/AuthContext') as { useAuth: jest.Mock };
    auth.useAuth.mockReturnValueOnce({ user: null, profile: null });
    const { useRetryGarmentRender } = require('../useRetryGarmentRender');
    const { result } = renderHook(() => useRetryGarmentRender(), {
      wrapper: makeWrapper(),
    });
    await act(async () => {
      await expect(result.current.mutateAsync('garment-1')).rejects.toThrow(
        'Not authenticated',
      );
    });
    expect(edge.callEdgeFunction).not.toHaveBeenCalled();
  });
});
