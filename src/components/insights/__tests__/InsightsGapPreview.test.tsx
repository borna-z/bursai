import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { InsightsGapPreview } from '../InsightsGapPreview';

const useAuthMock = vi.fn();
const useGarmentCountMock = vi.fn();
const useWardrobeUnlocksMock = vi.fn();
const loadGapSnapshotMock = vi.fn();

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock('@/hooks/useGarments', () => ({
  useGarmentCount: () => useGarmentCountMock(),
}));

vi.mock('@/hooks/useWardrobeUnlocks', () => ({
  useWardrobeUnlocks: () => useWardrobeUnlocksMock(),
}));

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ locale: 'en', t: (key: string) => key }),
}));

vi.mock('@/components/gaps/gapRouteState', async () => {
  const actual = await vi.importActual<typeof import('@/components/gaps/gapRouteState')>('@/components/gaps/gapRouteState');
  return {
    ...actual,
    loadGapSnapshot: (...args: Parameters<typeof actual.loadGapSnapshot>) => loadGapSnapshotMock(...args),
  };
});

describe('InsightsGapPreview', () => {
  beforeEach(() => {
    useAuthMock.mockReturnValue({ user: { id: 'user-1' } });
    useGarmentCountMock.mockReturnValue({ data: 14 });
    useWardrobeUnlocksMock.mockReturnValue({ isUnlocked: () => true });
    loadGapSnapshotMock.mockReturnValue(null);
  });

  it('links to the dedicated gaps route when no snapshot exists', () => {
    render(
      <MemoryRouter>
        <InsightsGapPreview />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: /gaps\.run_scan/i })).toHaveAttribute('href', '/gaps?autorun=1');
    expect(screen.getByRole('link', { name: /gaps\.preview_open_tool/i })).toHaveAttribute('href', '/gaps');
  });

  it('shows the latest featured gap and uses only the gaps route when a snapshot exists', () => {
    loadGapSnapshotMock.mockReturnValue({
      analyzedAt: '2026-03-28T12:00:00.000Z',
      results: [
        {
          item: 'Black loafers',
          category: 'Shoes',
          color: 'Black',
          reason: 'Adds polish to work and evening outfits.',
          new_outfits: 6,
          price_range: '$120-$180',
          search_query: 'black loafers women',
        },
      ],
    });

    render(
      <MemoryRouter>
        <InsightsGapPreview />
      </MemoryRouter>,
    );

    expect(screen.getByText(/gaps\.preview_best_addition/i)).toBeInTheDocument();
    expect(screen.getByText(/Black loafers/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /gaps\.preview_open_full/i })).toHaveAttribute('href', '/gaps');
    expect(screen.getByRole('link', { name: /gaps\.refresh_scan/i })).toHaveAttribute('href', '/gaps?autorun=1');
    expect(screen.getByRole('link', { name: /gaps\.preview_open_full/i }).getAttribute('href')).not.toContain('/discover');
  });
});
