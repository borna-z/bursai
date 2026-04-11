import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';

const hoisted = vi.hoisted(() => {
  const updateMutate = vi.fn().mockResolvedValue({ id: 'g1' });
  const deleteMutate = vi.fn().mockResolvedValue(undefined);
  const updateProfileMutate = vi.fn().mockResolvedValue(undefined);

  return {
    useGarmentsMock: vi.fn(),
    useGarmentSearchMock: vi.fn(),
    useUpdateGarmentMock: vi.fn(),
    useDeleteGarmentMock: vi.fn(),
    useGarmentCountMock: vi.fn(),
    useSmartFilterCountsMock: vi.fn(),
    useSubscriptionMock: vi.fn(),
    useProfileMock: vi.fn(),
    useUpdateProfileMock: vi.fn(),
    invokeEdgeFunctionMock: vi.fn().mockResolvedValue({ data: null, error: null }),
    updateMutate,
    deleteMutate,
    updateProfileMutate,
  };
});

vi.mock('@/hooks/useGarments', () => ({
  useGarments: hoisted.useGarmentsMock,
  useGarmentSearch: hoisted.useGarmentSearchMock,
  useUpdateGarment: hoisted.useUpdateGarmentMock,
  useDeleteGarment: hoisted.useDeleteGarmentMock,
  useGarmentCount: hoisted.useGarmentCountMock,
  useSmartFilterCounts: hoisted.useSmartFilterCountsMock,
}));

vi.mock('@/hooks/useSubscription', () => ({
  useSubscription: hoisted.useSubscriptionMock,
}));

vi.mock('@/hooks/useProfile', () => ({
  useProfile: hoisted.useProfileMock,
  useUpdateProfile: hoisted.useUpdateProfileMock,
}));

vi.mock('@/lib/edgeFunctionClient', () => ({
  invokeEdgeFunction: hoisted.invokeEdgeFunctionMock,
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { useWardrobeView } from '../useWardrobeView';

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

function buildInfiniteQueryResult(items: Array<{ id: string; category?: string }> = []) {
  return {
    data: { pages: [{ items }], pageParams: [0] },
    isLoading: false,
    isFetching: false,
    fetchNextPage: vi.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
    refetch: vi.fn(),
    isError: false,
    error: null,
    isSuccess: true,
  };
}

function buildSearchResult(items: Array<{ id: string; category?: string }> = []) {
  return {
    data: items,
    isLoading: false,
    isFetching: false,
    isError: false,
    error: null,
    isSuccess: true,
    refetch: vi.fn(),
  };
}

const t = (key: string) => key;

describe('useWardrobeView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    hoisted.useGarmentsMock.mockReturnValue(
      buildInfiniteQueryResult([
        { id: 'g1', category: 'top' },
        { id: 'g2', category: 'bottom' },
      ]),
    );
    hoisted.useGarmentSearchMock.mockReturnValue(buildSearchResult([]));
    hoisted.useUpdateGarmentMock.mockReturnValue({
      mutateAsync: hoisted.updateMutate,
      isPending: false,
    });
    hoisted.useDeleteGarmentMock.mockReturnValue({
      mutateAsync: hoisted.deleteMutate,
      isPending: false,
    });
    hoisted.useGarmentCountMock.mockReturnValue({ data: 2, isLoading: false });
    hoisted.useSmartFilterCountsMock.mockReturnValue({
      data: { rarely_worn: 3, most_worn: 2, new: 1 },
      isLoading: false,
    });
    hoisted.useSubscriptionMock.mockReturnValue({ isPro: false, plan: 'free' });
    // Preferences includes a recent compute timestamp so the DNA effect stays quiet.
    const recent = new Date().toISOString();
    hoisted.useProfileMock.mockReturnValue({
      data: {
        id: 'profile-1',
        preferences: { wardrobeDnaComputedAt: recent },
      },
      isLoading: false,
    });
    hoisted.useUpdateProfileMock.mockReturnValue({
      mutateAsync: hoisted.updateProfileMutate,
      isPending: false,
    });
  });

  it('returns sensible defaults for a fresh wardrobe view', () => {
    const { result } = renderHook(
      () => useWardrobeView({ initialTab: 'garments', userId: 'user-1', t }),
      { wrapper },
    );

    expect(result.current.activeTab).toBe('garments');
    expect(result.current.search).toBe('');
    expect(result.current.selectedCategory).toBe('all');
    expect(result.current.selectedColor).toBeNull();
    expect(result.current.selectedSeason).toBeNull();
    expect(result.current.sortBy).toBe('created_at');
    expect(result.current.showLaundry).toBe(false);
    expect(result.current.smartFilter).toBeNull();
    expect(result.current.hasActiveFilters).toBe(false);
    expect(typeof result.current.hasActiveFilters).toBe('boolean');
    expect(result.current.isSearching).toBe(false);
    expect(result.current.showGrouped).toBe(true);
  });

  it('exposes the 7 categories without underwear', () => {
    const { result } = renderHook(
      () => useWardrobeView({ initialTab: 'garments', userId: 'user-1', t }),
      { wrapper },
    );
    const ids = result.current.categories.map((c) => c.id);
    expect(ids).toEqual(['all', 'top', 'bottom', 'shoes', 'outerwear', 'accessory', 'dress']);
    expect(ids).not.toContain('underwear');
    expect(ids).toHaveLength(7);
  });

  it('setSelectedCategory updates activeFilters passed to useGarments', () => {
    const { result } = renderHook(
      () => useWardrobeView({ initialTab: 'garments', userId: 'user-1', t }),
      { wrapper },
    );

    act(() => {
      result.current.setSelectedCategory('top');
    });

    expect(result.current.selectedCategory).toBe('top');
    expect(result.current.hasActiveFilters).toBe(true);
    const lastCall = hoisted.useGarmentsMock.mock.calls.at(-1)?.[0];
    expect(lastCall).toMatchObject({ category: 'top' });
  });

  it('setSelectedColor, setSelectedSeason, setShowLaundry, setSortBy all feed activeFilters', () => {
    const { result } = renderHook(
      () => useWardrobeView({ initialTab: 'garments', userId: 'user-1', t }),
      { wrapper },
    );

    act(() => {
      result.current.setSelectedColor('blue');
      result.current.setSelectedSeason('winter');
      result.current.setShowLaundry(true);
      result.current.setSortBy('wear_count');
    });

    const lastCall = hoisted.useGarmentsMock.mock.calls.at(-1)?.[0];
    expect(lastCall).toMatchObject({
      color: 'blue',
      season: 'winter',
      inLaundry: true,
      sortBy: 'wear_count',
    });
    expect(result.current.hasActiveFilters).toBe(true);
  });

  it('setSmartFilter sets smartFilter and passes it through to useGarments', () => {
    const { result } = renderHook(
      () => useWardrobeView({ initialTab: 'garments', userId: 'user-1', t }),
      { wrapper },
    );

    act(() => {
      result.current.setSmartFilter('rarely_worn');
    });

    expect(result.current.smartFilter).toBe('rarely_worn');
    expect(result.current.hasActiveFilters).toBe(true);
    const lastCall = hoisted.useGarmentsMock.mock.calls.at(-1)?.[0];
    expect(lastCall).toMatchObject({ smartFilter: 'rarely_worn' });
  });

  it('isSearching becomes true after the debounce window', async () => {
    vi.useFakeTimers();
    try {
      const { result } = renderHook(
        () => useWardrobeView({ initialTab: 'garments', userId: 'user-1', t }),
        { wrapper },
      );

      act(() => {
        result.current.setSearch('blue');
      });
      expect(result.current.isSearching).toBe(false);

      await act(async () => {
        vi.advanceTimersByTime(350);
      });

      expect(result.current.isSearching).toBe(true);
      expect(result.current.showGrouped).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('clearFilters resets every filter including smartFilter', () => {
    const { result } = renderHook(
      () => useWardrobeView({ initialTab: 'garments', userId: 'user-1', t }),
      { wrapper },
    );

    act(() => {
      result.current.setSelectedCategory('top');
      result.current.setSelectedColor('red');
      result.current.setSelectedSeason('summer');
      result.current.setSortBy('last_worn_at');
      result.current.setShowLaundry(true);
      result.current.setSmartFilter('most_worn');
    });
    expect(result.current.hasActiveFilters).toBe(true);

    act(() => {
      result.current.clearFilters();
    });

    expect(result.current.selectedCategory).toBe('all');
    expect(result.current.selectedColor).toBeNull();
    expect(result.current.selectedSeason).toBeNull();
    expect(result.current.sortBy).toBe('created_at');
    expect(result.current.showLaundry).toBe(false);
    expect(result.current.smartFilter).toBeNull();
    expect(result.current.hasActiveFilters).toBe(false);
  });

  it('displayGarments equals allGarments (server-side filter is the source of truth)', () => {
    const items = [
      { id: 'g1', category: 'top' },
      { id: 'g2', category: 'bottom' },
      { id: 'g3', category: 'shoes' },
    ];
    hoisted.useGarmentsMock.mockReturnValue(buildInfiniteQueryResult(items));

    const { result } = renderHook(
      () => useWardrobeView({ initialTab: 'garments', userId: 'user-1', t }),
      { wrapper },
    );

    expect(result.current.displayGarments).toEqual(items);
    expect(result.current.allGarments).toEqual(items);
  });

  it('toggleSelect adds and removes ids from the selection set', () => {
    const { result } = renderHook(
      () => useWardrobeView({ initialTab: 'garments', userId: 'user-1', t }),
      { wrapper },
    );

    act(() => {
      result.current.toggleSelect('g1');
    });
    expect(result.current.selectedIds.has('g1')).toBe(true);

    act(() => {
      result.current.toggleSelect('g2');
    });
    expect(result.current.selectedIds.size).toBe(2);

    act(() => {
      result.current.toggleSelect('g1');
    });
    expect(result.current.selectedIds.has('g1')).toBe(false);
    expect(result.current.selectedIds.size).toBe(1);
  });

  it('handleBulkLaundry calls updateGarment for every selected id and clears selection', async () => {
    const { result } = renderHook(
      () => useWardrobeView({ initialTab: 'garments', userId: 'user-1', t }),
      { wrapper },
    );

    act(() => {
      result.current.toggleSelect('g1');
      result.current.toggleSelect('g2');
      result.current.setIsSelecting(true);
    });

    await act(async () => {
      await result.current.handleBulkLaundry();
    });

    expect(hoisted.updateMutate).toHaveBeenCalledTimes(2);
    expect(hoisted.updateMutate).toHaveBeenCalledWith({ id: 'g1', updates: { in_laundry: true } });
    expect(hoisted.updateMutate).toHaveBeenCalledWith({ id: 'g2', updates: { in_laundry: true } });
    await waitFor(() => expect(result.current.selectedIds.size).toBe(0));
    expect(result.current.isSelecting).toBe(false);
  });

  it('handleBulkDelete calls deleteGarment for every selected id', async () => {
    const { result } = renderHook(
      () => useWardrobeView({ initialTab: 'garments', userId: 'user-1', t }),
      { wrapper },
    );

    act(() => {
      result.current.toggleSelect('g1');
      result.current.toggleSelect('g2');
      result.current.toggleSelect('g3');
    });

    await act(async () => {
      await result.current.handleBulkDelete();
    });

    expect(hoisted.deleteMutate).toHaveBeenCalledTimes(3);
    expect(hoisted.deleteMutate).toHaveBeenCalledWith('g1');
    expect(hoisted.deleteMutate).toHaveBeenCalledWith('g2');
    expect(hoisted.deleteMutate).toHaveBeenCalledWith('g3');
  });

  it('exposes filteredCount and smartFilterCounts from their respective queries', () => {
    const { result } = renderHook(
      () => useWardrobeView({ initialTab: 'garments', userId: 'user-1', t }),
      { wrapper },
    );

    expect(result.current.totalCount).toBe(2);
    expect(result.current.filteredCount).toBe(2);
    expect(result.current.smartFilterCounts).toEqual({ rarely_worn: 3, most_worn: 2, new: 1 });
  });
});
