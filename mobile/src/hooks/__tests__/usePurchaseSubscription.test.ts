// usePurchaseSubscription smoke tests — N4.
//
// Validates the discriminated-union return contract of the hook for
// the two simplest paths (cancelled, package-unavailable). The
// success / pending paths require a 10s poll loop with timer control;
// covered indirectly by useRestorePurchases tests which exercise the
// same poll helper. Adding a 3rd here hits the 80-LOC ceiling.

import { renderHook, act } from '@testing-library/react-native';

import { __resetSupabaseMock } from '../../__mocks__/supabase';
import { makeWrapper } from './testUtils';

jest.mock('../../contexts/AuthContext', () => ({
  __esModule: true,
  useAuth: jest.fn(() => ({
    user: { id: 'user-1' },
    session: { access_token: 'tok' },
    profile: null,
  })),
}));

jest.mock('../../lib/revenuecat', () => ({
  __esModule: true,
  getOfferings: jest.fn(),
  isUserCancelled: (err: unknown) =>
    !!err && typeof err === 'object' && (err as { userCancelled?: boolean }).userCancelled === true,
  purchasePackage: jest.fn(),
}));

 
const revenuecat = require('../../lib/revenuecat') as {
  getOfferings: jest.Mock;
  purchasePackage: jest.Mock;
};

beforeEach(() => {
  __resetSupabaseMock();
  revenuecat.getOfferings.mockReset();
  revenuecat.purchasePackage.mockReset();
});

describe('usePurchaseSubscription', () => {
  it('returns "cancelled" when the user dismisses the StoreKit sheet', async () => {
    const fakePackage = { identifier: 'monthly' };
    revenuecat.getOfferings.mockResolvedValue({ monthly: fakePackage, annual: null, availablePackages: [] });
    revenuecat.purchasePackage.mockResolvedValue(null); // SDK returns null on dismissal
    const { usePurchaseSubscription } = require('../usePurchaseSubscription');
    const { result } = renderHook(() => usePurchaseSubscription(), {
      wrapper: makeWrapper(),
    });
    await act(async () => {
      const out = await result.current.mutateAsync({ packageType: 'monthly' });
      expect(out).toEqual({ status: 'cancelled' });
    });
  });

  it('throws when the requested package is unavailable (error path)', async () => {
    revenuecat.getOfferings.mockResolvedValue(null); // sandbox key gap
    const { usePurchaseSubscription } = require('../usePurchaseSubscription');
    const { result } = renderHook(() => usePurchaseSubscription(), {
      wrapper: makeWrapper(),
    });
    await act(async () => {
      await expect(
        result.current.mutateAsync({ packageType: 'monthly' }),
      ).rejects.toThrow('REVENUECAT_PACKAGE_UNAVAILABLE');
    });
    // purchasePackage must NEVER be reached on the package-unavailable path.
    expect(revenuecat.purchasePackage).not.toHaveBeenCalled();
  });

  it('returns "cancelled" when SDK throws a userCancelled error (edge case)', async () => {
    const fakePackage = { identifier: 'monthly' };
    revenuecat.getOfferings.mockResolvedValue({ monthly: fakePackage, annual: null, availablePackages: [] });
    const cancelErr: any = new Error('User cancelled');
    cancelErr.userCancelled = true;
    revenuecat.purchasePackage.mockRejectedValue(cancelErr);
    const { usePurchaseSubscription } = require('../usePurchaseSubscription');
    const { result } = renderHook(() => usePurchaseSubscription(), {
      wrapper: makeWrapper(),
    });
    await act(async () => {
      const out = await result.current.mutateAsync({ packageType: 'monthly' });
      expect(out).toEqual({ status: 'cancelled' });
    });
  });
});
