import { useQueryClient } from '@tanstack/react-query';
import { logger } from '@/lib/logger';
import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { useGarments, useGarmentSearch, useUpdateGarment, useDeleteGarment, useGarmentCount, useSmartFilterCounts } from '@/hooks/useGarments';
import { useSubscription } from '@/hooks/useSubscription';
import { invokeEdgeFunction } from '@/lib/edgeFunctionClient';
import { useProfile, useUpdateProfile } from '@/hooks/useProfile';
import { asPreferences } from '@/types/preferences';
import type { Json } from '@/integrations/supabase/types';

export type WardrobeTab = 'garments' | 'outfits';
export type WardrobeSort = 'created_at' | 'last_worn_at' | 'wear_count';
export type WardrobeSmartFilter = 'rarely_worn' | 'most_worn' | 'new' | null;

export function useWardrobeView({
  initialTab,
  userId,
  t,
}: {
  initialTab: WardrobeTab;
  userId?: string;
  t: (key: string) => string;
}) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<WardrobeTab>(initialTab);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [selectedSeason, setSelectedSeason] = useState<string | null>(null);
  const [isGridView, setIsGridView] = useState(true);
  const [showPaywall, setShowPaywall] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortBy, setSortBy] = useState<WardrobeSort>('created_at');
  const [showLaundry, setShowLaundry] = useState(false);
  const [smartFilter, setSmartFilter] = useState<WardrobeSmartFilter>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const updateGarment = useUpdateGarment();
  const deleteGarment = useDeleteGarment();
  const { data: profile } = useProfile();
  const updateProfile = useUpdateProfile();

  const isSearching = debouncedSearch.trim().length > 0;

  const activeFilters = useMemo(() => ({
    category: selectedCategory === 'all' ? undefined : selectedCategory,
    color: selectedColor || undefined,
    season: selectedSeason || undefined,
    sortBy,
    inLaundry: showLaundry ? true : undefined,
    // Smart filter is applied server-side so pagination and counts stay
    // consistent with Smart Access tile counts.
    smartFilter: smartFilter ?? undefined,
  }), [selectedCategory, selectedColor, selectedSeason, sortBy, showLaundry, smartFilter]);

  const queryResult = useGarments(activeFilters);

  const { data: infiniteData, isLoading: isInfiniteLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = queryResult;

  const searchResult = useGarmentSearch(debouncedSearch);
  const { data: searchData, isLoading: isSearchLoading } = searchResult;

  const isLoading = isSearching ? isSearchLoading : isInfiniteLoading;

  useSubscription();
  // Unfiltered total — used as the baseline for the wardrobe-empty guidance banner.
  const { data: unfilteredTotalCount } = useGarmentCount();
  // Count that mirrors the current filters (including smartFilter) so the
  // header label matches what the infinite query actually returns.
  const { data: filteredCount } = useGarmentCount(activeFilters);

  const allGarments = useMemo(() => {
    if (isSearching) return searchData ?? [];
    return infiniteData?.pages.flatMap(p => p.items) ?? [];
  }, [isSearching, searchData, infiniteData]);

  const isComputingRef = useRef(false);

  useEffect(() => {
    if (isLoading || allGarments.length === 0) return;
    if (isComputingRef.current) return;
    const prefs = asPreferences(profile?.preferences);
    const computedAt = prefs.wardrobeDnaComputedAt as string | undefined;
    const lastKnownCount = Number(localStorage.getItem('burs_dna_garment_count') ?? '0');
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const shouldRecompute = !computedAt || computedAt < sevenDaysAgo || Math.abs(allGarments.length - lastKnownCount) >= 3;
    if (!shouldRecompute) return;

    isComputingRef.current = true;
    (async () => {
      try {
        const { error } = await invokeEdgeFunction('compute_wardrobe_dna', {});
        if (error) throw error;
        localStorage.setItem('burs_dna_garment_count', String(allGarments.length));
        await updateProfile.mutateAsync({
          preferences: { ...prefs, wardrobeDnaComputedAt: new Date().toISOString() } as unknown as Json,
        });
      } catch (err) {
        logger.error('[Wardrobe] compute_wardrobe_dna failed:', err);
      } finally {
        isComputingRef.current = false;
      }
    })();
  }, [allGarments.length, profile?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Smart filter and all other filters run server-side via useGarments/useGarmentCount,
  // so the infinite-query result is already correctly filtered + sorted. The displayed
  // list, the filtered count, and the Smart Access tile counts all agree.
  const displayGarments = allGarments;

  const { data: smartFilterCountsData } = useSmartFilterCounts();
  const smartFilterCounts = smartFilterCountsData ?? { rarely_worn: 0, most_worn: 0, new: 0 };

  const garmentsByCategory = useMemo(() => {
    const groups: Record<string, typeof allGarments> = {};
    for (const g of displayGarments) {
      const cat = g.category || 'accessory';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(g);
    }
    return groups;
  }, [displayGarments]);

  const hasActiveFilters = Boolean(
    selectedCategory !== 'all' ||
    selectedColor ||
    selectedSeason ||
    sortBy !== 'created_at' ||
    showLaundry ||
    smartFilter
  );
  const activeFilterCount = [selectedCategory !== 'all', !!selectedColor, !!selectedSeason, sortBy !== 'created_at', showLaundry].filter(Boolean).length;
  const showGrouped = !hasActiveFilters && !search;

  const categories = [
    { id: 'all', label: t('wardrobe.all') },
    { id: 'top', label: t('wardrobe.top') },
    { id: 'bottom', label: t('wardrobe.bottom') },
    { id: 'shoes', label: t('wardrobe.shoes') },
    { id: 'outerwear', label: t('wardrobe.outerwear') },
    { id: 'accessory', label: t('wardrobe.accessory') },
    { id: 'dress', label: t('wardrobe.dress') },
  ];

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleBulkLaundry = async () => {
    try {
      await Promise.all(Array.from(selectedIds).map(id => updateGarment.mutateAsync({ id, updates: { in_laundry: true } })));
      toast.success(`${selectedIds.size} ${t('wardrobe.in_laundry_toast')}`);
      setSelectedIds(new Set());
      setIsSelecting(false);
    } catch {
      toast.error(t('common.something_wrong'));
    }
  };

  const handleBulkDelete = async () => {
    try {
      await Promise.all(Array.from(selectedIds).map(id => deleteGarment.mutateAsync(id)));
      toast.success(`${selectedIds.size} ${t('wardrobe.removed')}`);
      setSelectedIds(new Set());
      setIsSelecting(false);
    } catch {
      toast.error(t('common.something_wrong'));
    }
  };

  const clearFilters = () => {
    setSelectedCategory('all');
    setSelectedColor(null);
    setSelectedSeason(null);
    setSortBy('created_at');
    setShowLaundry(false);
    setSmartFilter(null);
  };

  const handleRefresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['garments', userId] });
    await queryClient.invalidateQueries({ queryKey: ['garments-count', userId] });
  }, [queryClient, userId]);

  return {
    activeTab,
    setActiveTab,
    search,
    setSearch,
    selectedCategory,
    setSelectedCategory,
    selectedColor,
    setSelectedColor,
    selectedSeason,
    setSelectedSeason,
    isGridView,
    setIsGridView,
    showPaywall,
    setShowPaywall,
    isSelecting,
    setIsSelecting,
    selectedIds,
    setSelectedIds,
    showFilterSheet,
    setShowFilterSheet,
    sortBy,
    setSortBy,
    showLaundry,
    setShowLaundry,
    smartFilter,
    setSmartFilter,
    isLoading,
    isSearching,
    totalCount: unfilteredTotalCount,
    filteredCount,
    displayGarments,
    garmentsByCategory,
    smartFilterCounts,
    hasActiveFilters,
    activeFilterCount,
    showGrouped,
    categories,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    allGarments,
    updateGarment,
    deleteGarment,
    toggleSelect,
    handleBulkLaundry,
    handleBulkDelete,
    clearFilters,
    handleRefresh,
  };
}
