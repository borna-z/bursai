import { useQueryClient } from '@tanstack/react-query';
import { logger } from '@/lib/logger';
import { useState, useMemo, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { useGarments, useGarmentSearch, useUpdateGarment, useDeleteGarment, useGarmentCount } from '@/hooks/useGarments';
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

  const queryResult = useGarments({
    category: selectedCategory === 'all' ? undefined : selectedCategory,
    color: selectedColor || undefined,
    season: selectedSeason || undefined,
    sortBy,
    inLaundry: showLaundry ? true : undefined,
  });

  const { data: infiniteData, isLoading: isInfiniteLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = queryResult;

  const searchResult = useGarmentSearch(debouncedSearch);
  const { data: searchData, isLoading: isSearchLoading } = searchResult;

  const isLoading = isSearching ? isSearchLoading : isInfiniteLoading;

  useSubscription();
  const { data: totalCount } = useGarmentCount();

  const allGarments = useMemo(() => {
    if (isSearching) return searchData ?? [];
    return infiniteData?.pages.flatMap(p => p.items) ?? [];
  }, [isSearching, searchData, infiniteData]);

  useEffect(() => {
    if (isLoading || allGarments.length === 0) return;
    const prefs = asPreferences(profile?.preferences);
    const computedAt = prefs.wardrobeDnaComputedAt as string | undefined;
    const lastKnownCount = Number(localStorage.getItem('burs_dna_garment_count') ?? '0');
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const shouldRecompute = !computedAt || computedAt < sevenDaysAgo || Math.abs(allGarments.length - lastKnownCount) >= 3;
    if (!shouldRecompute) return;

    (async () => {
      try {
        const { error } = await invokeEdgeFunction('compute_wardrobe_dna', {});
        if (error) throw error;
        localStorage.setItem('burs_dna_garment_count', String(allGarments.length));
        const currentPrefs = asPreferences(profile?.preferences);
        await updateProfile.mutateAsync({
          preferences: { ...currentPrefs, wardrobeDnaComputedAt: new Date().toISOString() } as unknown as Json,
        });
      } catch (err) {
        logger.error('[Wardrobe] compute_wardrobe_dna failed:', err);
      }
    })();
  }, [allGarments.length, profile?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const displayGarments = useMemo(() => {
    if (!smartFilter) return allGarments;
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const cutoff = thirtyDaysAgo.toISOString();

    switch (smartFilter) {
      case 'rarely_worn':
        return allGarments
          .filter(g => !g.last_worn_at || g.last_worn_at < cutoff)
          .sort((a, b) => (a.wear_count || 0) - (b.wear_count || 0));
      case 'most_worn':
        return [...allGarments]
          .filter(g => (g.wear_count || 0) > 0)
          .sort((a, b) => (b.wear_count || 0) - (a.wear_count || 0));
      case 'new':
        return [...allGarments]
          .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
      default:
        return allGarments;
    }
  }, [allGarments, smartFilter]);

  const smartFilterCounts = useMemo(() => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const cutoff = thirtyDaysAgo.toISOString();
    return {
      rarely_worn: allGarments.filter(g => !g.last_worn_at || g.last_worn_at < cutoff).length,
      most_worn: allGarments.filter(g => (g.wear_count || 0) > 0).length,
      new: allGarments.length,
    };
  }, [allGarments]);

  const garmentsByCategory = useMemo(() => {
    const groups: Record<string, typeof allGarments> = {};
    for (const g of displayGarments) {
      const cat = g.category || 'accessory';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(g);
    }
    return groups;
  }, [displayGarments]);

  const hasActiveFilters = selectedCategory !== 'all' || selectedColor || selectedSeason || sortBy !== 'created_at' || showLaundry || !!smartFilter;
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
    { id: 'underwear', label: t('wardrobe.underwear') },
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
    totalCount,
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
