import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { StudioSelectionStep } from '@/components/onboarding/StudioSelectionStep';

// Mirror LanguageContext's no-provider safety net (humanized last segment of
// the key) so safeT() falls back to the component's explicit English strings.
// Same pattern as AchievementStep.test.tsx.
function humanizedLastSegment(key: string): string {
  const segment = key.includes('.') ? key.slice(key.lastIndexOf('.') + 1) : key;
  const humanized = segment.replace(/[_-]/g, ' ');
  return humanized.charAt(0).toUpperCase() + humanized.slice(1);
}

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string) => humanizedLastSegment(key),
  }),
}));

// Wardrobe data — tests can override per-case via mockUseFlatGarments.
const mockUseFlatGarments = vi.hoisted(() =>
  vi.fn(() => ({ data: [] as unknown[], isLoading: false })),
);
vi.mock('@/hooks/useGarments', () => ({
  useFlatGarments: () => mockUseFlatGarments(),
}));

// LazyImage uses a signed-URL hook that touches Supabase storage. Stub it so
// the component renders inside JSDOM without a network round-trip.
vi.mock('@/hooks/useSignedUrlCache', () => ({
  useCachedSignedUrl: () => ({
    signedUrl: undefined,
    isLoading: false,
    hasError: false,
    setRef: vi.fn(),
  }),
}));

// Render-job enqueue surface — tracks calls + lets individual cases simulate
// success / 402 / generic failure. Real `RenderEnqueueError` is used so the
// component's `instanceof` check evaluates correctly.
const enqueueRenderJobMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/garmentIntelligence', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/garmentIntelligence')>(
      '@/lib/garmentIntelligence',
    );
  return {
    ...actual,
    enqueueRenderJob: enqueueRenderJobMock,
  };
});

// Toast used for the "max 3" + error paths.
const toastErrorMock = vi.hoisted(() => vi.fn());
const toastMessageMock = vi.hoisted(() => vi.fn());
vi.mock('sonner', () => ({
  toast: {
    error: toastErrorMock,
    message: toastMessageMock,
  },
}));

// Haptics: fire-and-forget, no need for a real implementation in JSDOM.
vi.mock('@/lib/haptics', () => ({
  hapticLight: vi.fn(),
}));

interface FakeGarment {
  id: string;
  title: string;
  image_path: string;
  render_status: string;
  rendered_image_path: string | null;
  original_image_path: string | null;
}

function makeGarments(count: number): FakeGarment[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `g${i + 1}`,
    title: `Garment ${i + 1}`,
    image_path: `garments/u1/g${i + 1}.jpg`,
    render_status: 'ready',
    rendered_image_path: `garments/u1/g${i + 1}-rendered.jpg`,
    original_image_path: `garments/u1/g${i + 1}.jpg`,
  }));
}

// Helper: build a successful enqueue response that echoes back the nonce the
// caller passed (matches the real edge-function contract — clientNonce in
// the response always matches what the caller sent).
function makeEnqueueSuccess(garmentId: string) {
  return (_id: string, _src: string, opts?: { clientNonce?: string }) =>
    Promise.resolve({
      jobId: `job-${garmentId}`,
      clientNonce: opts?.clientNonce ?? 'unset',
      status: 'pending',
      source: 'manual_enhance',
      replay: false,
    });
}

describe('StudioSelectionStep', () => {
  beforeEach(() => {
    enqueueRenderJobMock.mockReset();
    toastErrorMock.mockClear();
    toastMessageMock.mockClear();
    enqueueRenderJobMock.mockImplementation((id: string, src: string, opts?: { clientNonce?: string }) =>
      makeEnqueueSuccess(id)(id, src, opts),
    );
    mockUseFlatGarments.mockReturnValue({
      data: makeGarments(6),
      isLoading: false,
    });
  });

  it('shows the empty-wardrobe message when the wardrobe is empty', () => {
    mockUseFlatGarments.mockReturnValueOnce({ data: [], isLoading: false });
    render(<StudioSelectionStep onComplete={vi.fn()} />);

    expect(
      screen.getByText(/couldn't load your wardrobe/i),
    ).toBeInTheDocument();
  });

  it('disables the CTA until exactly 3 garments are selected and updates the counter', () => {
    render(<StudioSelectionStep onComplete={vi.fn()} />);

    const cta = screen.getByRole('button', { name: /Render my 3 pieces/i });
    expect(cta).toBeDisabled();

    // Pick first garment — 1 of 3, still disabled.
    fireEvent.click(screen.getByLabelText('Garment 1'));
    expect(screen.getByText('1 of 3')).toBeInTheDocument();
    expect(cta).toBeDisabled();

    // Pick second garment — 2 of 3, still disabled.
    fireEvent.click(screen.getByLabelText('Garment 2'));
    expect(screen.getByText('2 of 3')).toBeInTheDocument();
    expect(cta).toBeDisabled();

    // Pick third garment — 3 of 3 — perfect, CTA enabled.
    fireEvent.click(screen.getByLabelText('Garment 3'));
    expect(screen.getByText(/3 of 3 — perfect/i)).toBeInTheDocument();
    expect(cta).toBeEnabled();
  });

  it('rejects the 4th selection with a toast and does NOT call enqueue', () => {
    render(<StudioSelectionStep onComplete={vi.fn()} />);

    fireEvent.click(screen.getByLabelText('Garment 1'));
    fireEvent.click(screen.getByLabelText('Garment 2'));
    fireEvent.click(screen.getByLabelText('Garment 3'));

    // Attempt to add a 4th — should not flip count, should toast.
    fireEvent.click(screen.getByLabelText('Garment 4'));
    expect(toastMessageMock).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/3 of 3 — perfect/i)).toBeInTheDocument();
    expect(enqueueRenderJobMock).not.toHaveBeenCalled();
  });

  it('enqueues all 3 selections with per-garment clientNonces and fires onComplete on success', async () => {
    const onComplete = vi.fn();
    render(<StudioSelectionStep onComplete={onComplete} />);

    fireEvent.click(screen.getByLabelText('Garment 1'));
    fireEvent.click(screen.getByLabelText('Garment 2'));
    fireEvent.click(screen.getByLabelText('Garment 3'));

    fireEvent.click(screen.getByRole('button', { name: /Render my 3 pieces/i }));

    await waitFor(() => {
      expect(enqueueRenderJobMock).toHaveBeenCalledTimes(3);
    });
    // Each call uses 'manual_enhance' + a clientNonce. The nonce is generated
    // per-garment (see clientNoncesRef in StudioSelectionStep.tsx); under
    // the success path each garment gets a fresh UUIDv4 — so we assert the
    // shape rather than literal values.
    const uuidShape = /^[0-9a-f-]{36}$/i;
    for (let i = 0; i < 3; i++) {
      const call = enqueueRenderJobMock.mock.calls[i];
      expect(call[0]).toBe(`g${i + 1}`);
      expect(call[1]).toBe('manual_enhance');
      expect(call[2]).toMatchObject({ clientNonce: expect.stringMatching(uuidShape) });
    }
    // Each garment should have its OWN nonce — they must be 3 distinct values.
    const nonces = enqueueRenderJobMock.mock.calls.map((c) => c[2].clientNonce);
    expect(new Set(nonces).size).toBe(3);

    await waitFor(() => {
      expect(onComplete).toHaveBeenCalledTimes(1);
    });
  });

  it('shows an error toast when an enqueue call fails and does not advance', async () => {
    const onComplete = vi.fn();
    enqueueRenderJobMock.mockImplementationOnce(() =>
      Promise.reject(new Error('network')),
    );

    render(<StudioSelectionStep onComplete={onComplete} />);

    fireEvent.click(screen.getByLabelText('Garment 1'));
    fireEvent.click(screen.getByLabelText('Garment 2'));
    fireEvent.click(screen.getByLabelText('Garment 3'));
    fireEvent.click(screen.getByRole('button', { name: /Render my 3 pieces/i }));

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledTimes(1);
    });
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('reuses the same clientNonce per garmentId across transport-failure retries (no double-charge)', async () => {
    // Bring in the real RenderEnqueueError so the component's instanceof check
    // routes correctly + we can stamp the right `kind` on the simulated
    // transport failure.
    const { RenderEnqueueError } = await vi.importActual<
      typeof import('@/lib/garmentIntelligence')
    >('@/lib/garmentIntelligence');

    // First attempt: g1 throws a transport-flavored RenderEnqueueError; g2/g3
    // never get reached (sequential loop bails out).
    enqueueRenderJobMock.mockImplementationOnce((_id: string, _src: string, opts?: { clientNonce?: string }) =>
      Promise.reject(
        new RenderEnqueueError(
          'transport',
          0,
          undefined,
          opts?.clientNonce,
          'transport',
        ),
      ),
    );

    const onComplete = vi.fn();
    render(<StudioSelectionStep onComplete={onComplete} />);

    fireEvent.click(screen.getByLabelText('Garment 1'));
    fireEvent.click(screen.getByLabelText('Garment 2'));
    fireEvent.click(screen.getByLabelText('Garment 3'));

    fireEvent.click(screen.getByRole('button', { name: /Render my 3 pieces/i }));

    // First attempt rejected → toast surfaces.
    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledTimes(1);
    });
    expect(onComplete).not.toHaveBeenCalled();

    // Capture the nonce used on attempt 1 for g1.
    const firstAttempt = enqueueRenderJobMock.mock.calls[0];
    expect(firstAttempt[0]).toBe('g1');
    const g1NonceFirst = firstAttempt[2].clientNonce as string;
    expect(typeof g1NonceFirst).toBe('string');
    expect(g1NonceFirst.length).toBeGreaterThanOrEqual(8);

    // From now on, all calls succeed. Tap the CTA again to retry.
    enqueueRenderJobMock.mockImplementation((id: string, src: string, opts?: { clientNonce?: string }) =>
      makeEnqueueSuccess(id)(id, src, opts),
    );

    fireEvent.click(screen.getByRole('button', { name: /Render my 3 pieces/i }));

    await waitFor(() => {
      expect(onComplete).toHaveBeenCalledTimes(1);
    });

    // Total calls: 1 (failed g1) + 3 (retry: g1 + g2 + g3) = 4.
    expect(enqueueRenderJobMock).toHaveBeenCalledTimes(4);

    // Critical assertion: the SECOND call to enqueue (g1 retry) reuses the
    // SAME clientNonce as the first attempt. Reusing the nonce is what
    // prevents double-charge — the server's reserve_credit_atomic dedups on
    // the nonce-derived reserve_key.
    const g1NonceSecond = enqueueRenderJobMock.mock.calls[1][2].clientNonce;
    expect(enqueueRenderJobMock.mock.calls[1][0]).toBe('g1');
    expect(g1NonceSecond).toBe(g1NonceFirst);
  });

  it('surfaces the no_credits toast when enqueue throws insufficient credits (402)', async () => {
    const { RenderEnqueueError } = await vi.importActual<
      typeof import('@/lib/garmentIntelligence')
    >('@/lib/garmentIntelligence');

    enqueueRenderJobMock.mockImplementationOnce((_id: string, _src: string, opts?: { clientNonce?: string }) =>
      Promise.reject(
        new RenderEnqueueError(
          'insufficient_credits',
          402,
          undefined,
          opts?.clientNonce,
          'http',
        ),
      ),
    );

    const onComplete = vi.fn();
    render(<StudioSelectionStep onComplete={onComplete} />);

    fireEvent.click(screen.getByLabelText('Garment 1'));
    fireEvent.click(screen.getByLabelText('Garment 2'));
    fireEvent.click(screen.getByLabelText('Garment 3'));
    fireEvent.click(screen.getByRole('button', { name: /Render my 3 pieces/i }));

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledTimes(1);
    });
    // Component falls back to the explicit English copy when t() returns the
    // humanized last segment ('No credits').
    const toastArg = toastErrorMock.mock.calls[0][0] as string;
    expect(toastArg).toMatch(/no render credits/i);
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('surfaces no_credits toast when error.code === insufficient_credits even without 402 status', async () => {
    // Defensive case: a future transport that preserves error.code without
    // the HTTP status (e.g. a wrapper around supabase-js that surfaces the
    // body code) should still route to the no-credits message.
    const { RenderEnqueueError } = await vi.importActual<
      typeof import('@/lib/garmentIntelligence')
    >('@/lib/garmentIntelligence');

    enqueueRenderJobMock.mockImplementationOnce((_id: string, _src: string, opts?: { clientNonce?: string }) =>
      Promise.reject(
        new RenderEnqueueError(
          'insufficient_credits',
          0,
          'insufficient_credits',
          opts?.clientNonce,
          'http',
        ),
      ),
    );

    render(<StudioSelectionStep onComplete={vi.fn()} />);

    fireEvent.click(screen.getByLabelText('Garment 1'));
    fireEvent.click(screen.getByLabelText('Garment 2'));
    fireEvent.click(screen.getByLabelText('Garment 3'));
    fireEvent.click(screen.getByRole('button', { name: /Render my 3 pieces/i }));

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledTimes(1);
    });
    const toastArg = toastErrorMock.mock.calls[0][0] as string;
    expect(toastArg).toMatch(/no render credits/i);
  });

  it('locks selection during a partial batch and shows the partial_progress toast', async () => {
    const { RenderEnqueueError } = await vi.importActual<
      typeof import('@/lib/garmentIntelligence')
    >('@/lib/garmentIntelligence');

    // First two enqueues succeed, third fails — leaves us in partial-batch state.
    enqueueRenderJobMock.mockImplementationOnce(makeEnqueueSuccess('g1'));
    enqueueRenderJobMock.mockImplementationOnce(makeEnqueueSuccess('g2'));
    enqueueRenderJobMock.mockImplementationOnce((_id: string, _src: string, opts?: { clientNonce?: string }) =>
      Promise.reject(
        new RenderEnqueueError('transport', 0, undefined, opts?.clientNonce, 'transport'),
      ),
    );

    const onComplete = vi.fn();
    render(<StudioSelectionStep onComplete={onComplete} />);

    fireEvent.click(screen.getByLabelText('Garment 1'));
    fireEvent.click(screen.getByLabelText('Garment 2'));
    fireEvent.click(screen.getByLabelText('Garment 3'));
    fireEvent.click(screen.getByRole('button', { name: /Render my 3 pieces/i }));

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledTimes(1);
    });
    expect(onComplete).not.toHaveBeenCalled();

    // Now we're in partial batch (g1 + g2 succeeded, g3 didn't). Tapping ANY
    // garment — selected or unselected — should:
    //   1. Show the partial_progress toast (not max_reached, not silent)
    //   2. Leave selectedIds unchanged
    toastMessageMock.mockClear();

    fireEvent.click(screen.getByLabelText('Garment 1')); // already selected
    expect(toastMessageMock).toHaveBeenCalledTimes(1);
    const firstToastArg = toastMessageMock.mock.calls[0][0] as string;
    expect(firstToastArg).toMatch(/finishing your previous picks/i);
    // Counter should still read 3 of 3 (no deselect happened).
    expect(screen.getByText(/3 of 3 — perfect/i)).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Garment 4')); // unselected
    expect(toastMessageMock).toHaveBeenCalledTimes(2);
    expect(screen.getByText(/3 of 3 — perfect/i)).toBeInTheDocument();

    // Verify enqueue wasn't called again — selection didn't mutate so no
    // retry was triggered (CTA wasn't pressed).
    expect(enqueueRenderJobMock).toHaveBeenCalledTimes(3);
  });
});
