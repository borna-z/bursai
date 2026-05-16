// usePhotoFeedback — verifies cleanup only fires after a successful
// edge-function fetch. We mock the resize, supabase upload + storage
// remove, the manipulator temp deletion, and the edge function call.

import { renderHook, act, waitFor } from '@testing-library/react-native';

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

jest.mock('expo-image-manipulator', () => ({
  __esModule: true,
  SaveFormat: { JPEG: 'jpeg' },
  manipulateAsync: jest.fn(async (uri: string) => ({
    uri: `${uri}.resized`,
    width: 1200,
    height: 1200,
  })),
}));

jest.mock('expo-file-system', () => ({
  __esModule: true,
  File: jest.fn().mockImplementation(() => ({
    exists: true,
    bytes: jest.fn(async () => new Uint8Array([1, 2, 3])),
    delete: jest.fn(),
  })),
}));

jest.mock('../../lib/supabase', () => {
  const mockRemove = jest.fn(async () => ({ error: null }));
  return {
    __esModule: true,
    __mockRemove: mockRemove,
    supabase: {
      storage: {
        from: jest.fn(() => ({
          upload: jest.fn(async () => ({ error: null })),
          remove: mockRemove,
        })),
      },
    },
  };
});

const supabaseMod = require('../../lib/supabase') as { __mockRemove: jest.Mock };
const removeMock = supabaseMod.__mockRemove;

jest.mock('../../lib/edgeFunctionClient', () => ({
  __esModule: true,
  callEdgeFunction: jest.fn(),
  EdgeFunctionHttpError: class EdgeFunctionHttpError extends Error {},
  EdgeFunctionSubscriptionLockedError: class EdgeFunctionSubscriptionLockedError extends Error {},
  SUBSCRIPTION_SENTINEL: 'subscription_required',
}));

const client = require('../../lib/edgeFunctionClient') as {
  callEdgeFunction: jest.Mock;
};

beforeEach(() => {
  __resetSupabaseMock();
  removeMock.mockClear();
  client.callEdgeFunction.mockReset();
});

describe('usePhotoFeedback', () => {
  it('removes the selfie blob after a successful fetch', async () => {
    client.callEdgeFunction.mockResolvedValueOnce({
      commentary: 'Looks great.',
      overall_score: 90,
    });
    const { usePhotoFeedback } = require('../usePhotoFeedback');
    const { result } = renderHook(() => usePhotoFeedback(), { wrapper: makeWrapper() });

    await act(async () => {
      await result.current.submitFeedback({
        outfitId: 'outfit-1',
        selfieUri: 'file://selfie.jpg',
      });
    });
    await waitFor(() => expect(result.current.feedback).not.toBeNull());

    expect(removeMock).toHaveBeenCalledTimes(1);
    expect(result.current.feedback?.fit_notes).toBe('Looks great.');
  });

  it('surfaces the error from a failed fetch AND removes the orphan selfie blob', async () => {
    // Audit regression: pre-fix the error branch returned without sweeping
    // the uploaded selfie, leaving the blob in Supabase storage until the
    // next submit or unmount. If the user navigated away mid-error the
    // object survived indefinitely. The fix always sweeps when the upload
    // succeeded, regardless of analyze outcome — `removeMock` must fire
    // on the error path now.
    client.callEdgeFunction.mockResolvedValueOnce({ error: 'analysis_failed' });
    const { usePhotoFeedback } = require('../usePhotoFeedback');
    const { result } = renderHook(() => usePhotoFeedback(), { wrapper: makeWrapper() });

    await act(async () => {
      await result.current.submitFeedback({
        outfitId: 'outfit-1',
        selfieUri: 'file://selfie.jpg',
      });
    });
    await waitFor(() => expect(result.current.error).toBe('analysis_failed'));
    expect(result.current.feedback).toBeNull();
    expect(removeMock).toHaveBeenCalledTimes(1);
  });

  it('removes the orphan selfie blob on the paywall path too', async () => {
    // Paywall path is the SUBSCRIPTION_SENTINEL error mapping — pre-fix it
    // shared the leak with the generic error branch. Mock the edge client
    // to throw the locked-subscription class so useFeedbackFetch maps it
    // to `result.kind = 'paywall'`.
    const { EdgeFunctionSubscriptionLockedError } = require('../../lib/edgeFunctionClient');
    client.callEdgeFunction.mockRejectedValueOnce(
      new EdgeFunctionSubscriptionLockedError('locked'),
    );
    const { usePhotoFeedback } = require('../usePhotoFeedback');
    const { result } = renderHook(() => usePhotoFeedback(), { wrapper: makeWrapper() });

    await act(async () => {
      await result.current.submitFeedback({
        outfitId: 'outfit-1',
        selfieUri: 'file://selfie.jpg',
      });
    });
    await waitFor(() => expect(result.current.error).toBe('subscription_required'));
    expect(result.current.feedback).toBeNull();
    expect(removeMock).toHaveBeenCalledTimes(1);
  });
});
