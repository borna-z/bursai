import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { AchievementStep } from '@/components/onboarding/AchievementStep';

// Mirror LanguageContext's no-provider safety net (humanized last segment of
// the key) so safeT() falls back to the component's explicit English strings.
// Keeps the test independent of the live en.ts dict shape — same pattern as
// PhotoTutorialStep.test.tsx.
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

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1' }, loading: false }),
}));

// Mount-time grant_trial_gift call — mocked to return success by default.
// Individual tests override the mock when they need a different shape.
const invokeEdgeFunctionMock = vi.hoisted(() =>
  vi.fn(async () => ({
    data: { ok: true, amount: 3, duplicate: false },
    error: null,
  })),
);
vi.mock('@/lib/edgeFunctionClient', () => ({
  invokeEdgeFunction: invokeEdgeFunctionMock,
}));

// Cache invalidation surface — track that the success path bumps
// render_credits so P49 StudioSelection re-fetches.
const invalidateQueriesMock = vi.hoisted(() => vi.fn());
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    invalidateQueries: invalidateQueriesMock,
  }),
}));

describe('AchievementStep', () => {
  beforeEach(() => {
    invokeEdgeFunctionMock.mockClear();
    invalidateQueriesMock.mockClear();
    invokeEdgeFunctionMock.mockResolvedValue({
      data: { ok: true, amount: 3, duplicate: false },
      error: null,
    });
  });

  it('renders the celebratory title and gift body', () => {
    render(<AchievementStep onComplete={vi.fn()} />);

    expect(screen.getByText(/Your studio is ready\./i)).toBeInTheDocument();
    expect(screen.getByText(/Three studio renders, on us/i)).toBeInTheDocument();
    expect(screen.getByText(/three favourite pieces/i)).toBeInTheDocument();
  });

  it('calls onComplete when the primary CTA is pressed', () => {
    const onComplete = vi.fn();
    render(<AchievementStep onComplete={onComplete} />);

    const cta = screen.getByRole('button', { name: /Choose my 3 pieces/i });
    fireEvent.click(cta);

    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('fires grant_trial_gift on mount and invalidates render_credits on success', async () => {
    render(<AchievementStep onComplete={vi.fn()} />);

    // The mount-time effect calls the edge function with no body (server
    // derives the userId from the verified JWT — client cannot fabricate one).
    await waitFor(() => {
      expect(invokeEdgeFunctionMock).toHaveBeenCalledWith('grant_trial_gift', {
        body: {},
      });
    });

    // Success path invalidates the user-scoped render_credits cache so P49
    // (StudioSelection) sees the 3 credits without waiting for staleTime.
    await waitFor(() => {
      expect(invalidateQueriesMock).toHaveBeenCalledWith({
        queryKey: ['render_credits', 'u1'],
      });
    });
  });

  it('does NOT invalidate the cache when the grant fails (non-fatal)', async () => {
    invokeEdgeFunctionMock.mockResolvedValueOnce({
      data: null,
      error: new Error('network'),
    });

    render(<AchievementStep onComplete={vi.fn()} />);

    await waitFor(() => {
      expect(invokeEdgeFunctionMock).toHaveBeenCalledTimes(1);
    });
    // The CTA still works even though the grant didn't land — P49 detects
    // 0-credit state and surfaces a retry path.
    expect(invalidateQueriesMock).not.toHaveBeenCalled();
  });
});
