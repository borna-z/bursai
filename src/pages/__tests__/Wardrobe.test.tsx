import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/components/layout/AppLayout', () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/layout/PullToRefresh', () => ({
  PullToRefresh: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/animated-page', () => ({
  AnimatedPage: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/animated-tab', () => ({
  AnimatedTab: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

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

vi.mock('@/components/wardrobe/WardrobeOutfitsTab', () => ({
  WardrobeOutfitsTab: () => <div data-testid="wardrobe-outfits-tab">outfits</div>,
}));

vi.mock('@/components/wardrobe/WardrobeToolbar', () => ({
  WardrobeToolbar: () => (
    <div>
      <h1>wardrobe.title</h1>
      <button type="button" aria-label="wardrobe.tab_garments">wardrobe.tab_garments</button>
      <button type="button" aria-label="wardrobe.tab_outfits">wardrobe.tab_outfits</button>
      <button type="button" aria-label="wardrobe.live_scan">wardrobe.live_scan</button>
      <button type="button" aria-label="wardrobe.add">wardrobe.add</button>
    </div>
  ),
}));

vi.mock('@/components/wardrobe/WardrobeSmartAccess', () => ({
  WardrobeSmartAccess: () => (
    <div aria-label="Smart access">
      <button type="button" aria-label="wardrobe.rarely_worn">wardrobe.rarely_worn</button>
      <button type="button" aria-label="wardrobe.most_worn">wardrobe.most_worn</button>
      <button type="button" aria-label="wardrobe.recently_added">wardrobe.recently_added</button>
    </div>
  ),
}));

vi.mock('@/components/wardrobe/FilterSheet', () => ({
  FilterSheet: () => null,
}));

vi.mock('@/components/PaywallModal', () => ({
  PaywallModal: () => null,
}));

vi.mock('@/hooks/useWardrobeView', () => ({
  useWardrobeView: vi.fn(() => ({
    activeTab: 'garments',
    setActiveTab: vi.fn(),
    search: '',
    setSearch: vi.fn(),
    selectedCategory: 'all',
    setSelectedCategory: vi.fn(),
    selectedColor: '',
    setSelectedColor: vi.fn(),
    selectedSeason: '',
    setSelectedSeason: vi.fn(),
    isGridView: true,
    setIsGridView: vi.fn(),
    showPaywall: false,
    setShowPaywall: vi.fn(),
    isSelecting: false,
    setIsSelecting: vi.fn(),
    selectedIds: new Set(),
    setSelectedIds: vi.fn(),
    showFilterSheet: false,
    setShowFilterSheet: vi.fn(),
    sortBy: 'created_at',
    setSortBy: vi.fn(),
    showLaundry: false,
    setShowLaundry: vi.fn(),
    smartFilter: null,
    setSmartFilter: vi.fn(),
    isLoading: false,
    totalCount: 6,
    displayGarments: [{ id: 'g1', title: 'Blue shirt' }],
    garmentsByCategory: [{ category: 'Tops', garments: [{ id: 'g1', title: 'Blue shirt' }] }],
    smartFilterCounts: { rarely_worn: 2, most_worn: 2, recently_added: 2 },
    hasActiveFilters: false,
    activeFilterCount: 0,
    showGrouped: false,
    categories: ['all', 'top'],
    hasNextPage: false,
    isFetchingNextPage: false,
    fetchNextPage: vi.fn(),
    allGarments: [{ id: 'g1', title: 'Blue shirt' }],
    updateGarment: { mutate: vi.fn(), mutateAsync: vi.fn() },
    deleteGarment: { mutate: vi.fn(), mutateAsync: vi.fn() },
    toggleSelect: vi.fn(),
    handleBulkLaundry: vi.fn(),
    handleBulkDelete: vi.fn(),
    clearFilters: vi.fn(),
    handleRefresh: vi.fn(),
  })),
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

  it('renders the command top with garments and outfits tabs', () => {
    renderWardrobe();

    expect(screen.getByText('wardrobe.title')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'wardrobe.tab_garments' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'wardrobe.tab_outfits' })).toBeInTheDocument();
  });

  it('keeps add and scan in the command top instead of the old sticky footer', () => {
    renderWardrobe();

    expect(screen.getByRole('button', { name: 'wardrobe.live_scan' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'wardrobe.add' })).toBeInTheDocument();
    expect(screen.queryByText('+ Add')).not.toBeInTheDocument();
    expect(screen.queryByText('Scan')).not.toBeInTheDocument();
  });

  it('shows smart access when garments are available', () => {
    renderWardrobe();

    expect(screen.getByLabelText('Smart access')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /wardrobe\.rarely_worn/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /wardrobe\.most_worn/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /wardrobe\.recently_added/i })).toBeInTheDocument();
  });
});
