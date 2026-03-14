import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({ user: { id: 'u1' }, session: {}, loading: false })),
}));

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: vi.fn(() => ({ t: (k: string) => k, locale: 'en' })),
}));

vi.mock('@/hooks/useGarments', () => ({
  useGarments: vi.fn(() => ({
    data: { pages: [{ garments: [], nextCursor: null }] },
    isLoading: false,
    fetchNextPage: vi.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
  })),
  useGarmentCount: vi.fn(() => ({ data: 0 })),
  useUpdateGarment: vi.fn(() => ({ mutate: vi.fn() })),
  useDeleteGarment: vi.fn(() => ({ mutateAsync: vi.fn() })),
}));

vi.mock('@/hooks/useSubscription', () => ({
  useSubscription: vi.fn(() => ({ isPremium: false, canAddGarment: true, plan: 'free' })),
  PLAN_LIMITS: { free: { garments: 10, outfits: 10 }, premium: { garments: Infinity, outfits: Infinity } },
}));

vi.mock('@/hooks/useProfile', () => ({
  useProfile: vi.fn(() => ({ data: { preferences: { onboarding: { completed: true } } }, isLoading: false })),
}));

vi.mock('@/contexts/LocationContext', () => ({
  useLocation: vi.fn(() => ({ coords: null })),
}));

import WardrobePage from '../Wardrobe';

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

function renderWardrobe() {
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/wardrobe']}>
        <WardrobePage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Wardrobe page smoke', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders garments and outfits tabs', () => {
    renderWardrobe();
    expect(screen.getByText('wardrobe.garments')).toBeInTheDocument();
    expect(screen.getByText('wardrobe.outfits')).toBeInTheDocument();
  });

  it('shows empty state when no garments', () => {
    renderWardrobe();
    expect(screen.getByText('wardrobe.empty_title')).toBeInTheDocument();
  });
});
