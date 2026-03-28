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

  it('shows the locked preview state and still routes to /gaps', () => {
    useGarmentCountMock.mockReturnValue({ data: 7 });
    useWardrobeUnlocksMock.mockReturnValue({ isUnlocked: () => false });

    render(
      <MemoryRouter>
        <InsightsGapPreview />
      </MemoryRouter>,
    );

    expect(screen.getByText('Add a little more wardrobe depth first')).toBeInTheDocument();
    expect(screen.getByText('7 pieces')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Open gaps/i })).toHaveAttribute('href', '/gaps');
  });

  it('links to the dedicated gaps route when no snapshot exists', () => {
    render(
      <MemoryRouter>
        <InsightsGapPreview />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: /Run scan/i })).toHaveAttribute('href', '/gaps?autorun=1');
    expect(screen.getByRole('link', { name: /Open gaps/i })).toHaveAttribute('href', '/gaps');
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

    expect(screen.getByText(/Best next addition: Black loafers/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Open full scan/i })).toHaveAttribute('href', '/gaps');
    expect(screen.getByRole('link', { name: /Refresh/i })).toHaveAttribute('href', '/gaps?autorun=1');
    expect(screen.getByRole('link', { name: /Open full scan/i }).getAttribute('href')).not.toContain('/discover');
  });
});
