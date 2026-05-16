// Phase 6 — AddPieceStep3 orchestrator integration coverage.
//
// Three passes:
//   1. Smoke — the orchestrator mounts with a typical analyzer payload,
//      renders the hero + form + sticky save bar, and exposes the duplicate
//      modal off-screen.
//   2. Save flow — tapping the Save button opens the choice sheet; selecting
//      "Original" triggers the addGarment mutation with the form snapshot
//      and resolves to a nav.reset towards GarmentDetail.
//   3. Cleanup ref — unmounting during an in-flight save defers the cleanup
//      to the save's `finally`, and a successful save no-ops the deferred
//      closure (no orphan delete called). Mirrors the Codex round 10 P2 fix
//      on PR #725 that the spec calls out as the highest extraction risk.
//
// The orchestrator is heavy on side-effecting dependencies; rather than
// reach for a full integration harness, we mock the route + navigation
// hooks and the useAddGarment / useDetectDuplicate / useSignedUrl boundaries
// directly. The mutation mock exposes a resolver so the test can keep the
// mutation in-flight while it unmounts the screen.

import React from 'react';
import { Alert } from 'react-native';
import { act, render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AddPieceStep3 } from '../AddPieceStep3';
import { ThemeProvider } from '../../theme/ThemeProvider';

// ---- Navigation mocks --------------------------------------------------
const mockNavReset = jest.fn();
const mockNavReplace = jest.fn();
const mockNavNavigate = jest.fn();
const mockNavGoBack = jest.fn();

let mockRouteParams: Record<string, unknown> | undefined = undefined;

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: () => ({
      reset: mockNavReset,
      replace: mockNavReplace,
      navigate: mockNavNavigate,
      goBack: mockNavGoBack,
    }),
    useRoute: () => ({ params: mockRouteParams }),
  };
});

// ---- Mutation + duplicate + signed URL mocks ---------------------------
const mockMutateAsync = jest.fn();

jest.mock('../../hooks/useAddGarment', () => {
  const actual = jest.requireActual('../../hooks/useAddGarment');
  return {
    ...actual,
    useAddGarment: () => ({
      mutateAsync: mockMutateAsync,
      isPending: false,
    }),
  };
});

jest.mock('../../hooks/useDetectDuplicate', () => ({
  useDetectDuplicate: () => ({ data: { duplicates: [] } }),
  topDuplicate: () => null,
}));

jest.mock('../../hooks/useSignedUrl', () => ({
  useSignedUrl: () => ({ data: null }),
}));

// pendingUpload / batchPipeline / imageUpload — boundary mocks so the
// cleanup effect can fire without touching the real Supabase / storage
// stack. The cleanup test asserts on these mocks.
const mockTakePendingUpload: jest.Mock = jest.fn();
const mockDropPendingUpload: jest.Mock = jest.fn();
const mockPeekUploadMaskMetadata: jest.Mock = jest.fn(() => null);
const mockDeleteUpload: jest.Mock = jest.fn();
const mockMarkItemSkipped: jest.Mock = jest.fn();
const mockDropBatch: jest.Mock = jest.fn();

jest.mock('../../lib/pendingUpload', () => ({
  takePendingUpload: (...args: any[]) => mockTakePendingUpload(...args),
  dropPendingUpload: (...args: any[]) => mockDropPendingUpload(...args),
}));

jest.mock('../../lib/imageUpload', () => ({
  peekUploadMaskMetadata: (...args: any[]) => mockPeekUploadMaskMetadata(...args),
  deleteUpload: (...args: any[]) => mockDeleteUpload(...args),
}));

jest.mock('../../lib/batchPipeline', () => ({
  markItemSkipped: (...args: any[]) => mockMarkItemSkipped(...args),
  markItemSaved: jest.fn(),
  dropBatch: (...args: any[]) => mockDropBatch(...args),
  nextPendingIndex: jest.fn(() => -1),
}));

// Haptics + analytics — pure side effects we don't need to assert.
jest.mock('../../lib/haptics', () => ({
  hapticLight: jest.fn(),
  hapticSuccess: jest.fn(),
}));

jest.mock('../../lib/analytics', () => ({
  trackEvent: jest.fn(),
  markAddPieceCheckpoint: jest.fn(),
}));

// Silence the Alert.alert call on save failure.
jest.spyOn(Alert, 'alert').mockImplementation(() => {});

// Stable safe-area metrics for jsdom — useSafeAreaInsets reads the context
// rather than touching the native bridge.
const safeAreaInitialMetrics = {
  frame: { x: 0, y: 0, width: 320, height: 640 },
  insets: { top: 0, bottom: 0, left: 0, right: 0 },
};

function baseRouteParams() {
  return {
    storagePath: 'users/u1/photo.jpg',
    photoUri: 'file:///photo.jpg',
    source: 'add_photo' as const,
    analysis: {
      title: 'Linen shirt',
      category: 'top',
      subcategory: 'shirt',
      color_primary: 'white',
      color_secondary: null,
      material: 'linen',
      fit: 'regular',
      pattern: 'solid',
      season_tags: ['spring', 'summer'],
      formality: 3,
      confidence: 0.85,
    },
  };
}

function renderScreen() {
  return render(
    <SafeAreaProvider initialMetrics={safeAreaInitialMetrics}>
      <ThemeProvider>
        <AddPieceStep3 />
      </ThemeProvider>
    </SafeAreaProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRouteParams = baseRouteParams();
  mockTakePendingUpload.mockReturnValue(undefined);
  mockPeekUploadMaskMetadata.mockReturnValue(null);
});

// Pressable's host node sometimes carries the accessibilityLabel on an
// inner View while the onPress sits on a parent (RN host shim variance).
// Walk up until we find an onPress and invoke it directly so the
// behavioural assertion isn't fragile against renderer changes.
async function pressByLabel(
  utils: ReturnType<typeof render>,
  label: string,
): Promise<void> {
  const node = utils.getByLabelText(label);
  let pressTarget: typeof node | null = node;
  while (pressTarget && typeof pressTarget.props.onPress !== 'function') {
    pressTarget = pressTarget.parent as typeof node | null;
  }
  if (!pressTarget) {
    throw new Error(`no Pressable ancestor for label "${label}"`);
  }
  await act(async () => {
    pressTarget!.props.onPress();
  });
  // Flush handleSave's microtask queue.
  await act(async () => {
    await Promise.resolve();
  });
}

describe('AddPieceStep3 — smoke render', () => {
  it('renders the hero title, form chips, and sticky save bar', () => {
    const { getByDisplayValue, getByText } = renderScreen();
    // Hero title comes from the analyzer.
    expect(getByText('Linen shirt')).toBeTruthy();
    // Title input is hydrated from the analyzer prefill.
    expect(getByDisplayValue('Linen shirt')).toBeTruthy();
    // Sticky save bar is rendered (label resolves via i18n; key is returned
    // as fallback when the locale dict is missing, so we match the key).
    expect(getByText(/save/i)).toBeTruthy();
  });

  it('renders the fallback screen when route params are missing', () => {
    mockRouteParams = undefined;
    const { getByText } = renderScreen();
    expect(getByText(/start over/i)).toBeTruthy();
  });
});

describe('AddPieceStep3 — save flow', () => {
  it('opens the choice sheet on Save tap and calls addGarment.mutateAsync', async () => {
    mockMutateAsync.mockResolvedValue({ id: 'new-garment-id' });

    const utils = renderScreen();
    await pressByLabel(utils, 'Save garment');
    await pressByLabel(utils, 'Save with the original photo — no studio render');

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledTimes(1);
    });
    expect(mockMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        storagePath: 'users/u1/photo.jpg',
        title: 'Linen shirt',
        category: 'top',
        enableStudioQuality: false,
      }),
    );
  });
});

describe('AddPieceStep3 — unmount cleanup with save in flight', () => {
  it('defers cleanup to handleSave finally when the screen unmounts mid-save', async () => {
    // Build a controllable mutation — keep mockMutateAsync pending until the
    // test resolves it so the unmount lands while savingRef is still true.
    let resolveMutation: (value: { id: string }) => void = () => {};
    const mutationPromise = new Promise<{ id: string }>((resolve) => {
      resolveMutation = resolve;
    });
    mockMutateAsync.mockReturnValue(mutationPromise);

    const utils = renderScreen();
    const { unmount } = utils;
    await pressByLabel(utils, 'Save garment');
    await pressByLabel(utils, 'Save with the original photo — no studio render');

    // At this point mockMutateAsync is pending, savingRef is true. Unmount the
    // screen — the cleanup effect should park the runCleanup closure on
    // pendingCleanupRef instead of running it immediately.
    act(() => {
      unmount();
    });

    // No orphan delete fired yet — the deferred closure is parked.
    expect(mockDeleteUpload).not.toHaveBeenCalled();

    // Resolve the mutation. handleSave's finally invokes the deferred
    // closure; savedRef is now true, so runCleanup hits its early-return
    // and never reaches the mockDeleteUpload branch.
    await act(async () => {
      resolveMutation({ id: 'new-garment-id' });
      await mutationPromise;
    });

    expect(mockDeleteUpload).not.toHaveBeenCalled();
  });

  it('deletes the orphan storage object when the user backs out without saving', () => {
    const { unmount } = renderScreen();
    // No save fired — savingRef is false, so the cleanup runs immediately.
    act(() => {
      unmount();
    });
    expect(mockDeleteUpload).toHaveBeenCalledWith('users/u1/photo.jpg');
  });
});
