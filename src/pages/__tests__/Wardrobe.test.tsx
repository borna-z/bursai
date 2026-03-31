import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/contexts/ThemeContext', () => ({
  useTheme: vi.fn(() => ({ theme: 'light', accentColor: 'blue', setTheme: vi.fn(), setAccentColor: vi.fn() })),
}));

vi.mock('@/contexts/SeedContext', () => ({
  useSeed: vi.fn(() => ({ seeding: false, progress: 0 })),
  useSeedMaybe: vi.fn(() => null),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({ user: { id: 'u1' }, session: {}, loading: false })),
}));

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: vi.fn(() => ({ t: (k: string) => k, locale: 'en' })),
}));

vi.mock('@/components/wardrobe/GarmentGrid', () => ({
  GarmentGrid: () => <div data-testid="garment-grid">grid</div>,
}));

vi.mock('@/hooks/useGarments', () => ({
  useGarments: vi.fn(() => ({
    data: {
      pages: [{
        items: [
          { id: 'g1', title: 'Blue shirt', category: 'top', wear_count: 0, last_worn_at: null, created_at: '2026-03-27T10:00:00Z' },
          { id: 'g2', title: 'Grey tee', category: 'top', wear_count: 4, last_worn_at: '2026-03-24', created_at: '2026-03-20T10:00:00Z' },
          { id: 'g3', title: 'Black trousers', category: 'bottom', wear_count: 1, last_worn_at: '2026-02-10', created_at: '2026-03-19T10:00:00Z' },
          { id: 'g4', title: 'Derbies', category: 'shoes', wear_count: 5, last_worn_at: '2026-03-20', created_at: '2026-03-18T10:00:00Z' },
          { id: 'g5', title: 'Coat', category: 'outerwear', wear_count: 0, last_worn_at: null, created_at: '2026-03-17T10:00:00Z' },
          { id: 'g6', title: 'Scarf', category: 'accessory', wear_count: 0, last_worn_at: null, created_at: '2026-03-16T10:00:00Z' },
        ],
        nextPage: undefined,
      }],
    },
    isLoading: false,
    fetchNextPage: vi.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
  })),
  useGarmentSearch: vi.fn(() => ({
    data: [],
    isLoading: false,
  })),
  useGarmentCount: vi.fn(() => ({ data: 6 })),
  useUpdateGarment: vi.fn(() => ({ mutate: vi.fn(), mutateAsync: vi.fn() })),
  useDeleteGarment: vi.fn(() => ({ mutate: vi.fn(), mutateAsync: vi.fn() })),
}));

vi.mock('@/hooks/useSubscription', () => ({
  useSubscription: vi.fn(() => ({ isPremium: false, canAddGarment: true, plan: 'free' })),
  PLAN_LIMITS: { free: { garments: 10, outfits: 10 }, premium: { garments: Infinity, outfits: Infinity } },
}));

vi.mock('@/hooks/useProfile', () => ({
  useProfile: vi.fn(() => ({ data: { preferences: { onboarding: { completed: true } } }, isLoading: false })),
  useUpdateProfile: vi.fn(() => ({ mutateAsync: vi.fn() })),
}));

vi.mock('@/contexts/LocationContext', () => ({
  useLocation: vi.fn(() => ({ coords: null })),
}));

import WardrobePage from '../Wardrobe';

function renderWardrobe() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/wardrobe']}>
        <WardrobePage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Wardrobe page', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders the V4 wardrobe with tabs and garment grid', () => {
    renderWardrobe();

    expect(screen.getAllByText('wardrobe.title').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('button', { name: 'wardrobe.tab_garments' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'wardrobe.tab_outfits' })).toBeInTheDocument();
    expect(screen.getByTestId('garment-grid')).toBeInTheDocument();
  }, 10000);

  it('shows smart access when garments are available', () => {
    renderWardrobe();

    expect(screen.getByLabelText('wardrobe.smart_access')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /wardrobe\.rarely_worn/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /wardrobe\.most_worn/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /wardrobe\.recently_added/i })).toBeInTheDocument();
  }, 10000);
});
