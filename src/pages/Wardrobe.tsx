import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { PullToRefresh } from '@/components/layout/PullToRefresh';
import { Plus, Shirt } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { PaywallModal } from '@/components/PaywallModal';
import { useLanguage } from '@/contexts/LanguageContext';
import { WardrobeSmartAccess } from '@/components/wardrobe/WardrobeSmartAccess';
import { AnimatedPage } from '@/components/ui/animated-page';
import { FilterSheet } from '@/components/wardrobe/FilterSheet';
import { GarmentGrid } from '@/components/wardrobe/GarmentGrid';
import { WardrobeToolbar } from '@/components/wardrobe/WardrobeToolbar';
import { WardrobeOutfitsTab } from '@/components/wardrobe/WardrobeOutfitsTab';
import { hapticLight } from '@/lib/haptics';
import {
  buildWardrobeCollectionTiles,
  buildWardrobeCommandTopState,
} from '@/components/wardrobe/wardrobeViewModels';
import { useWardrobeView } from '@/hooks/useWardrobeView';

export default function WardrobePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();

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
    isSearching,
    totalCount,
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
  } = useWardrobeView({
    initialTab: 'garments',
    userId: user?.id,
    t,
  });

  const displayCount = displayGarments.length;
  const commandState = useMemo(() => buildWardrobeCommandTopState({
    activeTab,
    totalCount,
    filteredCount,
    displayCount,
    isSelecting,
    selectedIdsCount: selectedIds.size,
    hasActiveFilters,
    isSearching,
    search,
    t,
  }), [activeTab, displayCount, filteredCount, hasActiveFilters, isSearching, isSelecting, search, selectedIds.size, t, totalCount]);

  const smartCollectionTiles = useMemo(() => buildWardrobeCollectionTiles({
    smartFilter,
    smartFilterCounts,
    t,
  }), [smartFilter, smartFilterCounts, t]);

  return (
    <AppLayout>
      <PageHeader
        title={t('wardrobe.title') || 'Your Wardrobe'}
        titleClassName="text-[1.5rem] sm:text-[1.65rem]"
        sticky={false}
        actions={
          <button
            onClick={() => { hapticLight(); navigate('/wardrobe/add'); }}
            className="flex h-10.5 w-10.5 items-center justify-center rounded-full bg-accent text-white transition-transform cursor-pointer"
            aria-label={t('wardrobe.add_garment')}
          >
            <Plus className="h-4 w-4" strokeWidth={2.4} />
          </button>
        }
      />
      <PullToRefresh onRefresh={handleRefresh}>
        <AnimatedPage className="page-shell page-cluster">
          <WardrobeToolbar
            t={t}
            commandState={commandState}
            isGridView={isGridView}
            onToggleView={() => setIsGridView(!isGridView)}
            isSelecting={isSelecting}
            onStartSelecting={() => setIsSelecting(true)}
            onCancelSelecting={() => {
              setIsSelecting(false);
              setSelectedIds(new Set());
            }}
            activeTab={activeTab}
            onTabChange={(tab) => {
              hapticLight();
              setActiveTab(tab);
              if (isSelecting) {
                setIsSelecting(false);
                setSelectedIds(new Set());
              }
            }}
            search={search}
            onSearchChange={setSearch}
            onClearSearch={() => setSearch('')}
            onOpenFilterSheet={() => setShowFilterSheet(true)}
            hasActiveFilters={hasActiveFilters}
            activeFilterCount={activeFilterCount}
            selectedIdsCount={selectedIds.size}
            onBulkLaundry={handleBulkLaundry}
            onBulkDelete={handleBulkDelete}
            selectedCategory={selectedCategory}
            onCategoryChange={setSelectedCategory}
          />

          {activeTab === 'garments' ? (
            <>
              {allGarments.length > 0 && !(hasActiveFilters || isSearching) ? (
                <WardrobeSmartAccess
                  tiles={smartCollectionTiles}
                  onSelect={setSmartFilter}
                />
              ) : null}

              {totalCount !== undefined && totalCount >= 1 && totalCount <= 9 && (
                <button
                  type="button"
                  onClick={() => navigate('/wardrobe/add')}
                  className="flex w-full items-center gap-3 rounded-2xl border border-border/15 bg-primary/[0.04] px-4 py-3 text-left transition-colors active:bg-primary/[0.08]"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                    <Shirt className="h-4 w-4 text-primary/70" />
                  </div>
                  <p className="flex-1 text-[13px] leading-snug text-foreground/70">
                    {totalCount <= 2
                      ? t('wardrobe.guidance_low')
                      : t('wardrobe.guidance_growing')}
                  </p>
                  <span className="shrink-0 text-[12px] font-medium text-primary/70">
                    {t('wardrobe.guidance_cta')}
                  </span>
                </button>
              )}

              <section className="space-y-4" aria-label={t('wardrobe.inventory_label')}>
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
            </>
          ) : (
            <WardrobeOutfitsTab />
          )}
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
