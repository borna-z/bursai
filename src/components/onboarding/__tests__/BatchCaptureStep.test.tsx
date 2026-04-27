import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { BatchCaptureStep } from '@/components/onboarding/BatchCaptureStep';

// Mirror LanguageContext's no-provider safety net (humanized last segment of
// the key) so safeT() falls back to the component's explicit English strings.
function humanizedLastSegment(key: string): string {
  const segment = key.includes('.') ? key.slice(key.lastIndexOf('.') + 1) : key;
  const humanized = segment.replace(/[_-]/g, ' ');
  return humanized.charAt(0).toUpperCase() + humanized.slice(1);
}

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string) => humanizedLastSegment(key),
    locale: 'en',
  }),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1' }, loading: false }),
}));

// uploadGarmentImage is awaited inside processFile — return a stable path so
// the per-file pipeline can proceed past upload into the analyze + insert
// stages without hanging.
const uploadGarmentImageMock = vi.hoisted(() => vi.fn(async () => 'storage/u1/g.jpg'));
vi.mock('@/hooks/useStorage', () => ({
  useStorage: () => ({
    uploadGarmentImage: uploadGarmentImageMock,
    getGarmentSignedUrl: vi.fn(),
    deleteGarmentImage: vi.fn(),
  }),
}));

// analyzeGarment is awaited too. Return null analysis so the component
// falls back to the filename-derived title — keeps the mock surface small.
const analyzeGarmentMock = vi.hoisted(() => vi.fn(async () => ({ data: null, error: null })));
vi.mock('@/hooks/useAnalyzeGarment', () => ({
  useAnalyzeGarment: () => ({
    analyzeGarment: analyzeGarmentMock,
    isAnalyzing: false,
    analysisProgress: 0,
  }),
}));

// useProfile is the persisted-count source of truth — drive the test entirely
// through its mocked return value so the component reflects the count we set
// without needing a full Supabase fake.
const profileMock = vi.hoisted(() => ({
  data: { onboarding_garment_count: 0 } as { onboarding_garment_count: number } | null,
}));
vi.mock('@/hooks/useProfile', () => ({
  useProfile: () => profileMock,
}));

// supabase.from('garments').insert(...) returns { error: null } in the
// happy path. Keep the chain shallow — the component only reads `.error`.
const insertMock = vi.hoisted(() => vi.fn(async () => ({ error: null })));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({ insert: insertMock }),
    rpc: vi.fn(async () => ({ data: 1, error: null })),
  },
}));

vi.mock('@/lib/edgeFunctionClient', () => ({
  invokeEdgeFunction: vi.fn(async () => ({ data: null, error: null })),
}));

vi.mock('@/lib/garmentIntelligence', () => ({
  buildGarmentIntelligenceFields: vi.fn(() => ({})),
  standardizeGarmentAiRaw: vi.fn(() => null),
  triggerGarmentPostSaveIntelligence: vi.fn(),
}));

vi.mock('@/lib/imageCompression', () => ({
  // Force the catch branch in the component so the test doesn't depend on
  // OffscreenCanvas / createImageBitmap availability in jsdom.
  compressImage: vi.fn(async () => {
    throw new Error('jsdom compression unavailable');
  }),
}));

const incrementOnboardingGarmentCountMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/incrementOnboardingGarmentCount', () => ({
  incrementOnboardingGarmentCount: incrementOnboardingGarmentCountMock,
}));

vi.mock('@/lib/haptics', () => ({
  hapticLight: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const toastMock = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}));
vi.mock('sonner', () => ({
  toast: toastMock,
}));

// React Query — capture refetchQueries (failure path) AND invalidateQueries
// (success path; called inside the incrementOnboardingGarmentCount wrapper
// when a queryClient is passed in — Cluster B side effect).
const refetchQueriesMock = vi.hoisted(() => vi.fn());
const invalidateQueriesMock = vi.hoisted(() => vi.fn());
const queryClientMock = vi.hoisted(() => ({
  refetchQueries: refetchQueriesMock,
  invalidateQueries: invalidateQueriesMock,
}));
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => queryClientMock,
}));

// Helper: simulate the user picking one image via the hidden file input.
function pickFile() {
  const input = document.querySelector('input[type=file]') as HTMLInputElement;
  expect(input).toBeTruthy();
  const file = new File(['x'], 'shirt.jpg', { type: 'image/jpeg' });
  // jsdom rejects assigning to FileList directly; use Object.defineProperty.
  Object.defineProperty(input, 'files', {
    value: [file],
    writable: false,
    configurable: true,
  });
  fireEvent.change(input);
}

describe('BatchCaptureStep', () => {
  beforeEach(() => {
    profileMock.data = { onboarding_garment_count: 0 };
    uploadGarmentImageMock.mockClear();
    analyzeGarmentMock.mockClear();
    insertMock.mockClear();
    incrementOnboardingGarmentCountMock.mockReset();
    toastMock.success.mockClear();
    toastMock.error.mockClear();
    refetchQueriesMock.mockClear();
    invalidateQueriesMock.mockClear();
    if (!URL.createObjectURL) {
      Object.defineProperty(URL, 'createObjectURL', {
        value: vi.fn(() => 'blob:preview'),
        writable: true,
        configurable: true,
      });
    }
    if (!URL.revokeObjectURL) {
      Object.defineProperty(URL, 'revokeObjectURL', {
        value: vi.fn(),
        writable: true,
        configurable: true,
      });
    }
  });

  it('renders progress with Continue disabled at 0 captures', () => {
    profileMock.data = { onboarding_garment_count: 0 };
    render(<BatchCaptureStep onComplete={vi.fn()} />);

    expect(screen.getByText('0')).toBeInTheDocument();
    const continueBtn = screen.getByRole('button', { name: /Continue/i });
    expect(continueBtn).toBeDisabled();
    // "Done" button only appears once the recommended threshold is reached.
    expect(screen.queryByRole('button', { name: /done/i })).not.toBeInTheDocument();
  });

  it('enables Continue once the persisted count reaches 20', () => {
    profileMock.data = { onboarding_garment_count: 20 };
    const onComplete = vi.fn();
    render(<BatchCaptureStep onComplete={onComplete} />);

    expect(screen.getByText('20')).toBeInTheDocument();
    const continueBtn = screen.getByRole('button', { name: /Continue/i });
    expect(continueBtn).not.toBeDisabled();

    fireEvent.click(continueBtn);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('shows the Done button at recommended threshold (30)', () => {
    profileMock.data = { onboarding_garment_count: 30 };
    const onComplete = vi.fn();
    render(<BatchCaptureStep onComplete={onComplete} />);

    expect(screen.getByText('30')).toBeInTheDocument();
    const doneBtn = screen.getByRole('button', { name: /done/i });
    expect(doneBtn).not.toBeDisabled();

    fireEvent.click(doneBtn);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('RPC success path: optimistic bump rises while RPC is in flight, then drops back to 0 once it resolves', async () => {
    profileMock.data = { onboarding_garment_count: 0 };

    // Hold the RPC open so we can observe the optimistic +1 mid-flight.
    let resolveRpc: (count: number) => void = () => undefined;
    incrementOnboardingGarmentCountMock.mockImplementation(
      () =>
        new Promise<number>((resolve) => {
          resolveRpc = resolve;
        }),
    );

    render(<BatchCaptureStep onComplete={vi.fn()} />);

    await act(async () => {
      pickFile();
    });

    // While the RPC is pending, the counter should reflect the optimistic +1
    // (server still says 0).
    await waitFor(() => {
      expect(screen.getByText('1')).toBeInTheDocument();
    });

    // RPC resolves — component decrements optimisticBumps. Cache invalidation
    // (Cluster B's side effect) is what would refresh serverCount to the
    // canonical value in production; here `profileMock.data` stays at 0 so
    // we observe the decrement directly.
    await act(async () => {
      resolveRpc(1);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByText('0')).toBeInTheDocument();
    });

    // Garment was saved, RPC fired with queryClient (so the wrapper
    // invalidates the profile cache — code-reviewer P1), and no error
    // toast surfaced.
    expect(insertMock).toHaveBeenCalledTimes(1);
    expect(incrementOnboardingGarmentCountMock).toHaveBeenCalledWith('u1', queryClientMock);
    expect(toastMock.error).not.toHaveBeenCalled();
  });

  it('RPC failure path: optimistic bump rolls back, profile is refetched, error toast surfaces, garment stays saved', async () => {
    profileMock.data = { onboarding_garment_count: 0 };
    incrementOnboardingGarmentCountMock.mockRejectedValue(new Error('rpc failed'));

    render(<BatchCaptureStep onComplete={vi.fn()} />);

    await act(async () => {
      pickFile();
    });

    // Once the failure resolves, the optimistic bump drops back to 0 (server
    // count stays at 0; refetch is requested but the mock doesn't change the
    // underlying data — we assert the call was made).
    await waitFor(() => {
      expect(screen.getByText('0')).toBeInTheDocument();
    });

    // Garment row WAS saved (insert ran before the RPC).
    expect(insertMock).toHaveBeenCalledTimes(1);
    // RPC was attempted with queryClient (so the wrapper would invalidate
    // on success; failure path falls through to the explicit
    // refetchQueries call below).
    expect(incrementOnboardingGarmentCountMock).toHaveBeenCalledWith('u1', queryClientMock);
    // Profile cache was refetched so the counter snaps back to canonical.
    expect(refetchQueriesMock).toHaveBeenCalledWith({ queryKey: ['profile', 'u1'] });
    // User-friendly toast surfaces ("Your photo is saved.").
    expect(toastMock.error).toHaveBeenCalledTimes(1);
    expect(toastMock.error.mock.calls[0][0]).toMatch(/photo is saved/i);
  });
});
