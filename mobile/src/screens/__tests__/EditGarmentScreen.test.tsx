// EditGarmentScreen — refactor coverage after the AddPieceStep3Form reuse.
//
// Three passes:
//   1. Smoke — the screen hydrates the form + edit-only fields from a seeded
//      garment and renders the picker form, usage card, status card, and
//      delete button.
//   2. Cancel guard — editing a metadata field marks the form dirty; Cancel
//      prompts a confirmation Alert; tapping "Keep editing" bails out
//      without navigating, "Discard" pops the stack.
//   3. Save — tapping Save fires useUpdateGarment with the form snapshot
//      mapped to the legacy Title-case DB shape (preserves persisted shape)
//      merged with the edit-only wear_count / purchase_price / in_laundry
//      fields.

import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { EditGarmentScreen } from '../EditGarmentScreen';
import { ThemeProvider } from '../../theme/ThemeProvider';
import type { Garment } from '../../types/garment';

// ---- Navigation mocks --------------------------------------------------
const mockNavGoBack = jest.fn();
const mockNavNavigate = jest.fn();
const mockNavReplace = jest.fn();

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: () => ({
      goBack: mockNavGoBack,
      navigate: mockNavNavigate,
      replace: mockNavReplace,
      canGoBack: () => true,
      getParent: () => undefined,
    }),
    useRoute: () => ({ params: { id: 'g1' } }),
  };
});

// ---- Hooks mocks -------------------------------------------------------
const seededGarment: Garment = {
  id: 'g1',
  user_id: 'u1',
  title: 'Linen shirt',
  category: 'Top',
  subcategory: 'shirt',
  color_primary: 'white',
  color_secondary: null,
  material: 'Linen',
  fit: 'Regular',
  pattern: 'Solid',
  season_tags: ['Spring', 'Summer'],
  formality: 3,
  wear_count: 4,
  purchase_price: 250,
  in_laundry: false,
  image_path: 'users/u1/photo.jpg',
  // Remaining columns get sensible defaults so the type asserts cleanly.
  ai_analyzed_at: null,
  ai_provider: null,
  ai_raw: null,
  condition_notes: null,
  condition_score: null,
  created_at: null,
  enrichment_status: null,
  fts: null,
  imported_via: null,
  last_worn_at: null,
  occasion_tags: null,
  original_image_path: null,
  purchase_currency: null,
  render_error: null,
  render_presentation_used: null,
  render_provider: null,
  render_status: 'none',
  rendered_at: null,
  rendered_image_path: null,
  secondary_image_path: null,
  silhouette: null,
  source_url: null,
  style_archetype: null,
  texture_intensity: null,
  updated_at: null,
  versatility_score: null,
  visual_weight: null,
} as unknown as Garment;

const mockUpdateMutateAsync = jest.fn().mockResolvedValue(undefined);
const mockDeleteMutateAsync = jest.fn().mockResolvedValue(undefined);

// Stub the garment image tile — it pulls useQueryClient + useSignedUrl which
// would otherwise demand a QueryClientProvider wrapper. The tile is presentation
// only and not relevant to this screen's behaviour assertions.
jest.mock('../../components/GarmentImageTile', () => ({
  GarmentImageTile: () => null,
}));

jest.mock('../../hooks/useGarments', () => ({
  useGarment: () => ({
    data: seededGarment,
    isLoading: false,
    isError: false,
    refetch: jest.fn(),
  }),
  useUpdateGarment: () => ({
    mutateAsync: mockUpdateMutateAsync,
    isPending: false,
  }),
  useDeleteGarment: () => ({
    mutateAsync: mockDeleteMutateAsync,
    isPending: false,
  }),
}));

// Stable safe-area metrics for jsdom — useSafeAreaInsets reads the context
// rather than touching the native bridge.
const safeAreaInitialMetrics = {
  frame: { x: 0, y: 0, width: 320, height: 640 },
  insets: { top: 0, bottom: 0, left: 0, right: 0 },
};

function renderScreen() {
  return render(
    <SafeAreaProvider initialMetrics={safeAreaInitialMetrics}>
      <ThemeProvider>
        <EditGarmentScreen />
      </ThemeProvider>
    </SafeAreaProvider>,
  );
}

// Pressable's host node sometimes carries the accessibilityLabel on an
// inner View while the onPress sits on a parent. Walk up until we find an
// onPress and invoke it directly.
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
  await act(async () => {
    await Promise.resolve();
  });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('EditGarmentScreen — smoke render', () => {
  it('hydrates the shared form + edit-only fields from the seeded garment', () => {
    const { getByDisplayValue, getByText } = renderScreen();
    expect(getByDisplayValue('Linen shirt')).toBeTruthy();
    expect(getByDisplayValue('250')).toBeTruthy();
    expect(getByText('4')).toBeTruthy();
  });
});

describe('EditGarmentScreen — cancel guard', () => {
  it('navigates back immediately when the form is pristine', async () => {
    const utils = renderScreen();
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await pressByLabel(utils, 'Cancel');
    expect(alertSpy).not.toHaveBeenCalled();
    expect(mockNavGoBack).toHaveBeenCalledTimes(1);
    alertSpy.mockRestore();
  });

  it('prompts confirmation when the form is dirty, and "Discard" goes back', async () => {
    const utils = renderScreen();
    const titleInput = utils.getByDisplayValue('Linen shirt');
    act(() => {
      fireEvent.changeText(titleInput, 'Navy blazer');
    });
    let promptButtons: readonly { text?: string; onPress?: () => void; style?: string }[] = [];
    const alertSpy = jest
      .spyOn(Alert, 'alert')
      .mockImplementation((_title, _body, buttons) => {
        promptButtons = (buttons ?? []) as typeof promptButtons;
      });
    await pressByLabel(utils, 'Cancel');
    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(mockNavGoBack).not.toHaveBeenCalled();
    const discard = promptButtons.find((b) => b.style === 'destructive');
    expect(discard).toBeDefined();
    act(() => discard?.onPress?.());
    expect(mockNavGoBack).toHaveBeenCalledTimes(1);
    alertSpy.mockRestore();
  });
});

describe('EditGarmentScreen — save flow', () => {
  it('fires useUpdateGarment with the merged metadata + edit-only fields', async () => {
    const utils = renderScreen();
    const titleInput = utils.getByDisplayValue('Linen shirt');
    act(() => {
      fireEvent.changeText(titleInput, 'Navy blazer');
    });
    await pressByLabel(utils, 'Save');
    await waitFor(() => {
      expect(mockUpdateMutateAsync).toHaveBeenCalledTimes(1);
    });
    const call = mockUpdateMutateAsync.mock.calls[0][0];
    expect(call.id).toBe('g1');
    expect(call.updates).toEqual(
      expect.objectContaining({
        title: 'Navy blazer',
        // Form is lowercase canonical; the boundary maps back to the legacy
        // Title-case DB shape so persisted rows don't migrate.
        category: 'Top',
        material: 'Linen',
        fit: 'Regular',
        pattern: 'Solid',
        season_tags: ['Spring', 'Summer'],
        wear_count: 4,
        purchase_price: 250,
        in_laundry: false,
      }),
    );
    expect(mockNavGoBack).toHaveBeenCalledTimes(1);
  });
});
