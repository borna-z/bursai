import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { PullToRefresh } from '@/components/layout/PullToRefresh';
import { Plus } from 'lucide-react';
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
    initialTab: 'garments',
    userId: user?.id,
    t,
  });

  const hasHardFilters = selectedCategory !== 'all'
    || Boolean(selectedColor)
    || Boolean(selectedSeason)
    || sortBy !== 'created_at'
    || showLaundry
    || search.trim().length > 0;

  const displayCount = displayGarments.length;
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
          <section className="surface-secondary mb-2.5 rounded-[1.2rem] p-3.5">
            <div className="flex flex-wrap items-start justify-between gap-2.5">
              <div className="space-y-1">
                <p className="label-editorial text-muted-foreground/60">
                  {activeTab === 'garments'
                    ? (t('wardrobe.inventory_label') || 'Wardrobe inventory')
                    : (t('wardrobe.tab_outfits') || 'Outfits')}
                </p>
                <h2 className="text-[1.05rem] font-semibold tracking-[-0.04em] text-foreground">
                  {activeTab === 'garments'
                    ? (t('wardrobe.title') || 'Your Wardrobe')
                    : (t('wardrobe.outfits_caption') || 'Saved looks and stylable combinations')}
                </h2>
              </div>

              <div className="flex gap-2">
                <div className="premium-inline-stat min-w-[4.8rem] px-3 py-2 text-center">
                  <p className="label-editorial text-muted-foreground/60">
                    {t('wardrobe.pieces_count')?.replace('{count}', '') || 'Pieces'}
                  </p>
                  <p className="mt-0.5 text-[1rem] font-semibold tracking-[-0.04em] text-foreground">
                    {totalCount ?? 0}
                  </p>
                </div>
                <div className="premium-inline-stat min-w-[4.8rem] px-3 py-2 text-center">
                  <p className="label-editorial text-muted-foreground/60">
                    {t('wardrobe.filter') || 'Visible'}
                  </p>
                  <p className="mt-0.5 text-[1rem] font-semibold tracking-[-0.04em] text-foreground">
                    {displayCount}
                  </p>
                </div>
              </div>
            </div>
          </section>

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
              {allGarments.length > 0 && !hasHardFilters ? (
                <WardrobeSmartAccess
                  tiles={smartCollectionTiles}
                  onSelect={setSmartFilter}
                />
              ) : null}

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
