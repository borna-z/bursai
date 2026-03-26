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

vi.mock('@/hooks/useGarments', () => ({
  useGarments: vi.fn(() => ({
    data: { pages: [{ items: [], nextPage: undefined }] },
    isLoading: false,
    fetchNextPage: vi.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
  })),
  useGarmentSearch: vi.fn(() => ({
    data: [],
    isLoading: false,
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
  useUpdateProfile: vi.fn(() => ({ mutateAsync: vi.fn() })),
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
    expect(screen.getByText('wardrobe.tab_garments')).toBeInTheDocument();
    expect(screen.getByText('wardrobe.tab_outfits')).toBeInTheDocument();
  });

  it('renders page title', () => {
    renderWardrobe();
    expect(screen.getByText('wardrobe.title')).toBeInTheDocument();
  });
});
