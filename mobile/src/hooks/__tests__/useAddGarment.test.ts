// useAddGarment smoke tests — N4.
//
// The hook is a thin React Query wrapper around
// `persistGarmentWithOfflineFallback`. Mock that module so we exercise
// the hook's auth gate, success-invalidation, and offline-queue branch
// without standing up the full storage / edge-fn round-trip.

import { renderHook, act } from '@testing-library/react-native';

import { __resetSupabaseMock } from '../../__mocks__/supabase';
import { makeWrapper } from './testUtils';

jest.mock('../../contexts/AuthContext', () => ({
  __esModule: true,
  useAuth: jest.fn(() => ({ user: { id: 'user-1' }, profile: null })),
}));

jest.mock('../../lib/garmentSave', () => {
  class OfflineQueuedError extends Error {
    constructor() {
      super('Saved offline');
      this.name = 'OfflineQueuedError';
    }
  }
  return {
    __esModule: true,
    OfflineQueuedError,
    persistGarmentWithOfflineFallback: jest.fn(),
    surfaceRenderEnqueueFailureToast: jest.fn(),
  };
});


const garmentSave = require('../../lib/garmentSave') as {
  persistGarmentWithOfflineFallback: jest.Mock;
  surfaceRenderEnqueueFailureToast: jest.Mock;
  OfflineQueuedError: typeof Error;
};

beforeEach(() => {
  __resetSupabaseMock();
  garmentSave.persistGarmentWithOfflineFallback.mockReset();
});

const baseParams = {
  storagePath: 'user-1/abc.jpg',
  analysis: { title: 'T', category: 'top', confidence: 0.9 } as any,
  source: 'add_photo' as const,
  enableStudioQuality: true,
};

describe('useAddGarment', () => {
  it('happy path: returns the inserted garment row', async () => {
    garmentSave.persistGarmentWithOfflineFallback.mockResolvedValue({
      id: 'g-1',
      title: 'T',
    });
    const { useAddGarment } = require('../useAddGarment');
    const { result } = renderHook(() => useAddGarment(), {
      wrapper: makeWrapper(),
    });
    await act(async () => {
      const out = await result.current.mutateAsync(baseParams);
      expect(out).toEqual({ id: 'g-1', title: 'T' });
    });
    expect(garmentSave.persistGarmentWithOfflineFallback).toHaveBeenCalledWith(
      baseParams,
      { onRenderEnqueueFailure: garmentSave.surfaceRenderEnqueueFailureToast },
    );
  });

  it('offline branch: rethrows OfflineQueuedError so the screen can branch', async () => {
    garmentSave.persistGarmentWithOfflineFallback.mockRejectedValue(
      new garmentSave.OfflineQueuedError(),
    );
    const { useAddGarment } = require('../useAddGarment');
    const { result } = renderHook(() => useAddGarment(), {
      wrapper: makeWrapper(),
    });
    await act(async () => {
      await expect(result.current.mutateAsync(baseParams)).rejects.toBeInstanceOf(
        garmentSave.OfflineQueuedError,
      );
    });
  });

  it('throws auth error when no user is signed in (edge case)', async () => {
     
    const auth = require('../../contexts/AuthContext') as { useAuth: jest.Mock };
    auth.useAuth.mockReturnValueOnce({ user: null, profile: null });
    const { useAddGarment } = require('../useAddGarment');
    const { result } = renderHook(() => useAddGarment(), {
      wrapper: makeWrapper(),
    });
    await act(async () => {
      await expect(result.current.mutateAsync(baseParams)).rejects.toThrow(
        'Not authenticated',
      );
    });
    expect(garmentSave.persistGarmentWithOfflineFallback).not.toHaveBeenCalled();
  });
});
