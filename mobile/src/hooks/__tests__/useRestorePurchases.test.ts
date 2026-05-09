// useRestorePurchases smoke tests — N4.
//
// Mocks `../lib/revenuecat` so we control the SDK round-trip outcome
// without standing up the native module. Mocks AuthContext for the user
// id, and seeds the supabase `subscriptions` row to drive the poll loop.

import { renderHook, act, waitFor } from '@testing-library/react-native';

import { __resetSupabaseMock, __seedTable } from '../../__mocks__/supabase';
import { makeWrapper } from './testUtils';

jest.mock('../../contexts/AuthContext', () => ({
  __esModule: true,
  useAuth: jest.fn(() => ({ user: { id: 'user-1' }, profile: null })),
}));

jest.mock('../../lib/revenuecat', () => ({
  __esModule: true,
  restorePurchases: jest.fn(),
}));

 
const revenuecat = require('../../lib/revenuecat') as {
  restorePurchases: jest.Mock;
};

beforeEach(() => {
  __resetSupabaseMock();
  revenuecat.restorePurchases.mockReset();
  jest.useFakeTimers({ doNotFake: ['nextTick'] });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('useRestorePurchases', () => {
  it('resolves "no_purchases" when SDK returns empty entitlements', async () => {
    revenuecat.restorePurchases.mockResolvedValue({ entitlements: { active: {} } });
    const { useRestorePurchases } = require('../useRestorePurchases');
    const { result } = renderHook(() => useRestorePurchases(), {
      wrapper: makeWrapper(),
    });
    await act(async () => {
      const promise = result.current.mutateAsync();
      await jest.runAllTimersAsync();
      const out = await promise;
      expect(out).toEqual({ status: 'no_purchases' });
    });
  });

  it('resolves "restored" when SDK + DB row both confirm active entitlement', async () => {
    revenuecat.restorePurchases.mockResolvedValue({
      entitlements: { active: { premium: { isActive: true } } },
    });
    __seedTable('subscriptions', [
      { user_id: 'user-1', plan: 'monthly', status: 'active' },
    ]);
    const { useRestorePurchases } = require('../useRestorePurchases');
    const { result } = renderHook(() => useRestorePurchases(), {
      wrapper: makeWrapper(),
    });
    await act(async () => {
      const promise = result.current.mutateAsync();
      await jest.runAllTimersAsync();
      await waitFor(async () => {
        expect(revenuecat.restorePurchases).toHaveBeenCalled();
      });
      await jest.runAllTimersAsync();
      const out = await promise;
      expect(out).toEqual({ status: 'restored' });
    });
  });

  it('resolves "unsupported" when SDK returns null (web / simulator)', async () => {
    revenuecat.restorePurchases.mockResolvedValue(null);
    const { useRestorePurchases } = require('../useRestorePurchases');
    const { result } = renderHook(() => useRestorePurchases(), {
      wrapper: makeWrapper(),
    });
    await act(async () => {
      const promise = result.current.mutateAsync();
      await jest.runAllTimersAsync();
      const out = await promise;
      expect(out).toEqual({ status: 'unsupported' });
    });
  });
});
