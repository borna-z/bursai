import { motion } from 'framer-motion';
import { TAP_TRANSITION } from '@/lib/motion';
import { useLocation, useNavigate } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PullToRefresh } from '@/components/layout/PullToRefresh';
import { useAuth } from '@/contexts/AuthContext';
import { PaywallModal } from '@/components/PaywallModal';
import { useLanguage } from '@/contexts/LanguageContext';
import { WardrobeOutfitsTab } from '@/components/wardrobe/WardrobeOutfitsTab';
import { AnimatedPage } from '@/components/ui/animated-page';
import { AnimatedTab } from '@/components/ui/animated-tab';
import { FilterSheet } from '@/components/wardrobe/FilterSheet';
import { useFirstRunCoach } from '@/hooks/useFirstRunCoach';
import { GarmentGrid } from '@/components/wardrobe/GarmentGrid';
import { WardrobeToolbar } from '@/components/wardrobe/WardrobeToolbar';
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

  const coach = useFirstRunCoach();

  return (
    <AppLayout>
      <PullToRefresh onRefresh={handleRefresh}>
        <AnimatedPage className="px-5 pb-36 pt-6 space-y-6">
          <WardrobeToolbar
            t={t}
            totalCount={totalCount}
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
            allGarmentsLength={allGarments.length}
            smartFilter={smartFilter}
            onSmartFilterChange={setSmartFilter}
            smartFilterCounts={smartFilterCounts}
            selectedIdsCount={selectedIds.size}
            onBulkLaundry={handleBulkLaundry}
            onBulkDelete={handleBulkDelete}
          />

          <AnimatedTab tabKey={activeTab}>
            {activeTab === 'garments' ? (
              <div className="space-y-6">
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
              </div>
            ) : (
              <div>
                <WardrobeOutfitsTab />
              </div>
            )}
          </AnimatedTab>
        </AnimatedPage>
      </PullToRefresh>

      {activeTab === 'garments' && (
        <div
          style={{
            position: 'sticky',
            bottom: 0,
            left: 0,
            right: 0,
            background: '#1C1917',
            display: 'flex',
            height: 52,
            zIndex: 40,
          }}
        >
          <button
            onClick={() => navigate('/wardrobe/scan')}
            style={{
              flex: 1,
              height: '100%',
              border: 'none',
              borderRadius: 0,
              background: 'rgba(245,240,232,0.09)',
              borderRight: '0.5px solid rgba(245,240,232,0.1)',
              color: '#F5F0E8',
              fontFamily: 'DM Sans, ui-sans-serif, sans-serif',
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Scan
          </button>
          <button
            onClick={() => navigate('/wardrobe/add')}
            style={{
              flex: 1,
              height: '100%',
              border: 'none',
              borderRadius: 0,
              background: '#F5F0E8',
              color: '#1C1917',
              fontFamily: 'DM Sans, ui-sans-serif, sans-serif',
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            + Add
          </button>
        </div>
      )}

      {activeTab === 'outfits' && (
        <div className="fixed bottom-24 right-4 z-50">
          <motion.button
            whileTap={{ scale: 0.92 }}
            transition={TAP_TRANSITION}
            onClick={() => navigate('/')}
            className="h-14 w-14 rounded-full shadow-lg shadow-accent/25 bg-accent text-accent-foreground flex items-center justify-center"
          >
            <Sparkles className="w-6 h-6" />
          </motion.button>
        </div>
      )}

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
