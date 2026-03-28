import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { PullToRefresh } from '@/components/layout/PullToRefresh';
import { useAuth } from '@/contexts/AuthContext';
import { PaywallModal } from '@/components/PaywallModal';
import { useLanguage } from '@/contexts/LanguageContext';
import { WardrobeSmartAccess } from '@/components/wardrobe/WardrobeSmartAccess';
import { WardrobeOutfitsTab } from '@/components/wardrobe/WardrobeOutfitsTab';
import { AnimatedPage } from '@/components/ui/animated-page';
import { AnimatedTab } from '@/components/ui/animated-tab';
import { FilterSheet } from '@/components/wardrobe/FilterSheet';
import { GarmentGrid } from '@/components/wardrobe/GarmentGrid';
import { WardrobeToolbar } from '@/components/wardrobe/WardrobeToolbar';
import { buildWardrobeCollectionTiles, buildWardrobeCommandTopState, buildWardrobeInventoryState } from '@/components/wardrobe/wardrobeViewModels';
import { useWardrobeView } from '@/hooks/useWardrobeView';

export default function WardrobePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const location = useLocation();
  const { t } = useLanguage();

  const locationState = location.state as { tab?: string } | null;
  const initialTab = locationState?.tab === 'outfits' ? 'outfits' : 'garments';

  const {
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
  } = useWardrobeView({
    initialTab,
    userId: user?.id,
    t,
  });

  const hasHardFilters = selectedCategory !== 'all'
    || Boolean(selectedColor)
    || Boolean(selectedSeason)
    || sortBy !== 'created_at'
    || showLaundry
    || search.trim().length > 0;

  const displayCount = activeTab === 'garments' ? displayGarments.length : 0;
  const commandState = useMemo(() => buildWardrobeCommandTopState({
    activeTab,
    totalCount,
    displayCount,
    isSelecting,
    selectedIdsCount: selectedIds.size,
    hasActiveFilters,
    search,
    t,
  }), [activeTab, displayCount, hasActiveFilters, isSelecting, search, selectedIds.size, t, totalCount]);

  const inventoryState = useMemo(() => buildWardrobeInventoryState({
    activeTab,
    isLoading,
    isSelecting,
    selectedIdsCount: selectedIds.size,
    displayCount,
    hasActiveFilters,
    search,
  }), [activeTab, displayCount, hasActiveFilters, isLoading, isSelecting, search, selectedIds.size]);

  const smartCollectionTiles = useMemo(() => buildWardrobeCollectionTiles({
    smartFilter,
    smartFilterCounts,
    t,
  }), [smartFilter, smartFilterCounts, t]);

  const handleCommandAction = (action: 'style' | 'add' | 'scan' | 'plan') => {
    if (action === 'style') {
      navigate('/ai/generate');
      return;
    }
    if (action === 'add') {
      navigate('/wardrobe/add');
      return;
    }
    if (action === 'scan') {
      navigate('/wardrobe/scan');
      return;
    }
    navigate('/plan');
  };

  return (
    <AppLayout>
      <PullToRefresh onRefresh={handleRefresh}>
        <AnimatedPage className="page-shell !px-5 !pt-6 space-y-5">
          <WardrobeToolbar
            t={t}
            commandState={commandState}
            inventoryState={inventoryState}
            isGridView={isGridView}
            onToggleView={() => setIsGridView(!isGridView)}
            isSelecting={isSelecting}
            onStartSelecting={() => setIsSelecting(true)}
            onCancelSelecting={() => {
              setIsSelecting(false);
              setSelectedIds(new Set());
            }}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            search={search}
            onSearchChange={setSearch}
            onClearSearch={() => setSearch('')}
            onOpenFilterSheet={() => setShowFilterSheet(true)}
            hasActiveFilters={hasActiveFilters}
            activeFilterCount={activeFilterCount}
            selectedIdsCount={selectedIds.size}
            onBulkLaundry={handleBulkLaundry}
            onBulkDelete={handleBulkDelete}
            onAction={handleCommandAction}
            onClearFilters={clearFilters}
          />

          {activeTab === 'garments' && allGarments.length > 0 && !hasHardFilters && (
            <WardrobeSmartAccess
              tiles={smartCollectionTiles}
              onSelect={setSmartFilter}
            />
          )}

          <AnimatedTab tabKey={activeTab}>
            {activeTab === 'garments' ? (
              <section className="space-y-4" aria-label="Wardrobe inventory">
                <GarmentGrid
                  t={t}
                  isLoading={isLoading}
                  isGridView={isGridView}
                  isSelecting={isSelecting}
                  selectedIds={selectedIds}
                  displayGarments={displayGarments}
                  showGrouped={showGrouped}
                  garmentsByCategory={garmentsByCategory}
                  hasActiveFilters={hasActiveFilters}
                  search={search}
                  onSelect={toggleSelect}
                  onEdit={(id) => navigate(`/wardrobe/${id}/edit`)}
                  onLaundry={(garment) => updateGarment.mutate({ id: garment.id, updates: { in_laundry: !garment.in_laundry } })}
                  onDelete={(id) => deleteGarment.mutate(id)}
                  onLoadMore={() => {
                    if (hasNextPage && !isFetchingNextPage) {
                      fetchNextPage();
                    }
                  }}
                  hasNextPage={!!hasNextPage}
                  isFetchingNextPage={isFetchingNextPage}
                  onClearFilters={clearFilters}
                />
              </section>
            ) : (
              <section aria-label="Wardrobe outfits">
                <WardrobeOutfitsTab />
              </section>
            )}
          </AnimatedTab>
        </AnimatedPage>
      </PullToRefresh>

      <FilterSheet
        open={showFilterSheet}
        onOpenChange={setShowFilterSheet}
        category={selectedCategory}
        onCategoryChange={setSelectedCategory}
        color={selectedColor}
        onColorChange={setSelectedColor}
        season={selectedSeason}
        onSeasonChange={setSelectedSeason}
        sortBy={sortBy}
        onSortChange={setSortBy}
        showLaundry={showLaundry}
        onLaundryChange={setShowLaundry}
        onClear={clearFilters}
        categories={categories}
      />

      <PaywallModal isOpen={showPaywall} onClose={() => setShowPaywall(false)} reason="garments" />
    </AppLayout>
  );
}
