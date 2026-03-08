import { useState, useMemo, useEffect, useRef, useCallback, Fragment } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { TAP_TRANSITION } from '@/lib/motion';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Search, X, Trash2, Shirt, ScanLine, Camera,
  SlidersHorizontal, Grid3X3, List, WashingMachine, Loader2,
} from 'lucide-react';
import { SwipeableGarmentCard } from '@/components/wardrobe/SwipeableGarmentCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { GarmentGridSkeleton } from '@/components/ui/skeletons';
import { useGarments, useUpdateGarment, useDeleteGarment, useGarmentCount, type GarmentFilters, type Garment } from '@/hooks/useGarments';
import { useSubscription, PLAN_LIMITS } from '@/hooks/useSubscription';
import { PaywallModal } from '@/components/PaywallModal';
import { AppLayout } from '@/components/layout/AppLayout';
import { EmptyState } from '@/components/layout/EmptyState';
import { LazyImageSimple } from '@/components/ui/lazy-image';
import { useLanguage } from '@/contexts/LanguageContext';
import { WardrobeOutfitsTab } from '@/components/wardrobe/WardrobeOutfitsTab';
import { AnimatedPage } from '@/components/ui/animated-page';
import { AnimatedTab } from '@/components/ui/animated-tab';
import { SmartGroupings } from '@/components/wardrobe/SmartGroupings';
import { FilterSheet } from '@/components/wardrobe/FilterSheet';
import { SectionHeader } from '@/components/ui/section-header';

// ── Garment Card ──

interface GarmentCardProps {
  garment: Garment;
  isGridView: boolean;
  isSelecting: boolean;
  isSelected: boolean;
  onSelect: () => void;
}

function GarmentCard({ garment, isGridView, isSelecting, isSelected, onSelect }: GarmentCardProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (isSelecting) { onSelect(); } else { navigate(`/wardrobe/${garment.id}`); }
  };

  if (!isGridView) {
    return (
      <motion.button
        whileTap={{ scale: 0.975 }}
        transition={TAP_TRANSITION}
        onClick={handleClick}
        className={cn(
          'w-full flex items-center gap-3 p-3 rounded-xl transition-colors text-left will-change-transform',
          garment.in_laundry && 'opacity-60',
          isSelected && 'ring-2 ring-accent'
        )}
      >
        {isSelecting && <Checkbox checked={isSelected} className="shrink-0" />}
        <LazyImageSimple
          imagePath={garment.image_path}
          alt={garment.title}
          className="w-16 h-16 rounded-xl shrink-0"
          fallbackIcon={<Shirt className="w-5 h-5 text-muted-foreground/30" />}
        />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{garment.title}</p>
          <p className="text-xs text-muted-foreground capitalize">{garment.category} · {garment.color_primary}</p>
        </div>
      </motion.button>
    );
  }

  // Grid view — clean gallery, name on tap only
  return (
    <motion.button
      whileTap={{ scale: 0.97, y: -2 }}
      transition={TAP_TRANSITION}
      onClick={handleClick}
      className={cn(
        'w-full rounded-2xl overflow-hidden transition-colors text-left will-change-transform relative group',
        garment.in_laundry && 'opacity-60',
        isSelected && 'ring-2 ring-accent'
      )}
    >
      <div className="aspect-[3/4] bg-muted relative overflow-hidden">
        <LazyImageSimple
          imagePath={garment.image_path}
          alt={garment.title}
          className="w-full h-full"
          fallbackIcon={<Shirt className="w-8 h-8 text-muted-foreground/50" />}
        />
        {isSelecting && (
          <div className="absolute top-2 left-2">
            <Checkbox checked={isSelected} className="bg-background/80" />
          </div>
        )}
        {/* Usage badge */}
        {(garment.wear_count || 0) > 0 && (
          <span className="absolute top-2 right-2 text-[10px] font-medium bg-background/70 backdrop-blur-sm px-1.5 py-0.5 rounded-full text-foreground/80">
            {garment.wear_count}×
          </span>
        )}
      </div>
    </motion.button>
  );
}

// ── Virtualization ──

const VIRTUALIZE_THRESHOLD = 30;
const GRID_ROW_HEIGHT = 220;
const LIST_ROW_HEIGHT = 74;
const GAP = 12;

interface VirtualizedGarmentListProps {
  garments: Garment[];
  isGridView: boolean;
  isSelecting: boolean;
  selectedIds: Set<string>;
  onSelect: (id: string) => void;
  onEdit: (id: string) => void;
  onLaundry: (garment: Garment) => void;
  onDelete: (id: string) => void;
  onLoadMore: () => void;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
}

function GarmentListContent({
  garments, isGridView, isSelecting, selectedIds,
  onSelect, onEdit, onLaundry, onDelete, onLoadMore, hasNextPage, isFetchingNextPage,
}: VirtualizedGarmentListProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          onLoadMore();
        }
      },
      { rootMargin: '200px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, onLoadMore]);

  const useVirtual = garments.length >= VIRTUALIZE_THRESHOLD;

  if (useVirtual) {
    return (
      <VirtualGarmentGrid
        garments={garments}
        isGridView={isGridView}
        isSelecting={isSelecting}
        selectedIds={selectedIds}
        onSelect={onSelect}
        onEdit={onEdit}
        onLaundry={onLaundry}
        onDelete={onDelete}
        isFetchingNextPage={isFetchingNextPage}
        sentinelRef={sentinelRef}
      />
    );
  }

  return (
    <>
      <div className={cn(isGridView ? 'grid grid-cols-2 gap-2.5' : 'flex flex-col gap-1')}>
        {garments.map((garment, index) => (
          <div key={garment.id} className="animate-drape-in" style={{ animationDelay: `${Math.min(index, 12) * 40}ms`, animationFillMode: 'both' }}>
            {!isGridView && !isSelecting ? (
              <SwipeableGarmentCard
                garment={garment}
                onEdit={() => onEdit(garment.id)}
                onLaundry={() => onLaundry(garment)}
                onDelete={() => onDelete(garment.id)}
              />
            ) : (
              <GarmentCard
                garment={garment}
                isGridView={isGridView}
                isSelecting={isSelecting}
                isSelected={selectedIds.has(garment.id)}
                onSelect={() => onSelect(garment.id)}
              />
            )}
          </div>
        ))}
      </div>
      <div ref={sentinelRef} className="h-1" />
      {isFetchingNextPage && <LoadingSkeletons isGridView={isGridView} />}
    </>
  );
}

function LoadingSkeletons({ isGridView }: { isGridView: boolean }) {
  return isGridView ? (
    <div className="grid grid-cols-2 gap-3">
      {[1, 2].map(i => (
        <Skeleton key={i} className="aspect-[3/4] w-full rounded-2xl" />
      ))}
    </div>
  ) : (
    <div className="flex flex-col gap-2">
      {[1, 2].map(i => (
        <div key={i} className="flex items-center gap-3 p-3">
          <Skeleton className="w-16 h-16 rounded-xl shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

interface VirtualGarmentGridProps {
  garments: Garment[];
  isGridView: boolean;
  isSelecting: boolean;
  selectedIds: Set<string>;
  onSelect: (id: string) => void;
  onEdit: (id: string) => void;
  onLaundry: (garment: Garment) => void;
  onDelete: (id: string) => void;
  isFetchingNextPage: boolean;
  sentinelRef: React.RefObject<HTMLDivElement | null>;
}

function VirtualGarmentGrid({
  garments, isGridView, isSelecting, selectedIds,
  onSelect, onEdit, onLaundry, onDelete, isFetchingNextPage, sentinelRef,
}: VirtualGarmentGridProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const cols = isGridView ? 2 : 1;
  const rowCount = Math.ceil(garments.length / cols);
  const estimateSize = isGridView ? GRID_ROW_HEIGHT : LIST_ROW_HEIGHT;

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize + GAP,
    overscan: 5,
  });

  return (
    <div ref={parentRef} className="w-full overflow-auto" style={{ maxHeight: 'calc(100vh - 200px)' }}>
      <div style={{ height: virtualizer.getTotalSize(), width: '100%', position: 'relative' }}>
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const startIdx = virtualRow.index * cols;
          const rowGarments = garments.slice(startIdx, startIdx + cols);
          return (
            <div
              key={virtualRow.index}
              style={{ position: 'absolute', top: virtualRow.start, left: 0, width: '100%', height: virtualRow.size, paddingBottom: GAP }}
            >
              <div className={cn(isGridView ? 'grid grid-cols-2 gap-2.5 h-full' : 'flex flex-col gap-1')}>
                {rowGarments.map((garment) => (
                  <Fragment key={garment.id}>
                    {!isGridView && !isSelecting ? (
                      <SwipeableGarmentCard garment={garment} onEdit={() => onEdit(garment.id)} onLaundry={() => onLaundry(garment)} onDelete={() => onDelete(garment.id)} />
                    ) : (
                      <GarmentCard garment={garment} isGridView={isGridView} isSelecting={isSelecting} isSelected={selectedIds.has(garment.id)} onSelect={() => onSelect(garment.id)} />
                    )}
                  </Fragment>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <div ref={sentinelRef} className="h-1" />
      {isFetchingNextPage && <LoadingSkeletons isGridView={isGridView} />}
    </div>
  );
}

// ── FAB Menu ──

function AddFAB({ onPhoto, onScan, isOverLimit }: { onPhoto: () => void; onScan: () => void; isOverLimit: boolean }) {
  const [open, setOpen] = useState(false);
  const { t } = useLanguage();

  return (
    <div className="fixed bottom-24 right-4 z-30">
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-20"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.9 }}
              transition={{ duration: 0.15 }}
              className="absolute bottom-16 right-0 flex flex-col gap-2 items-end z-30"
            >
              <button
                onClick={() => { setOpen(false); onScan(); }}
                className="flex items-center gap-2.5 bg-card border border-border/40 rounded-xl px-4 py-3 shadow-lg text-sm font-medium"
              >
                <ScanLine className="w-4 h-4 text-accent" />
                BURS Live Scan
              </button>
              <button
                onClick={() => { setOpen(false); onPhoto(); }}
                className={cn(
                  "flex items-center gap-2.5 bg-card border border-border/40 rounded-xl px-4 py-3 shadow-lg text-sm font-medium",
                  isOverLimit && "opacity-50"
                )}
              >
                <Camera className="w-4 h-4 text-accent" />
                {t('wardrobe.add') || 'Lägg till'}
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      <Button
        size="lg"
        className="h-14 w-14 rounded-full shadow-lg shadow-primary/20 bg-primary text-primary-foreground hover:bg-primary/90 relative z-30"
        onClick={() => setOpen(!open)}
      >
        <Plus className={cn("w-6 h-6 transition-transform duration-200", open && "rotate-45")} />
      </Button>
    </div>
  );
}

// ── Main Page ──

export default function WardrobePage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'garments' | 'outfits'>('garments');
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
  const [sortBy, setSortBy] = useState<'created_at' | 'last_worn_at' | 'wear_count'>('created_at');
  const [showLaundry, setShowLaundry] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const updateGarment = useUpdateGarment();
  const deleteGarment = useDeleteGarment();

  const queryResult = useGarments({
    search: debouncedSearch,
    category: selectedCategory === 'all' ? undefined : selectedCategory,
    color: selectedColor || undefined,
    season: selectedSeason || undefined,
    sortBy,
    inLaundry: showLaundry ? true : undefined,
  });
  const { data: infiniteData, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = queryResult;
  const { canAddGarment, isPremium } = useSubscription();
  const { data: totalCount } = useGarmentCount();

  const displayGarments = useMemo(() => {
    return infiniteData?.pages.flatMap(p => p.items) ?? [];
  }, [infiniteData]);

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

  const handleAddGarment = () => {
    if (canAddGarment()) { navigate('/wardrobe/add'); } else { setShowPaywall(true); }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  };

  const handleBulkLaundry = async () => {
    try {
      await Promise.all(Array.from(selectedIds).map(id => updateGarment.mutateAsync({ id, updates: { in_laundry: true } })));
      toast.success(`${selectedIds.size} ${t('wardrobe.in_laundry_toast')}`);
      setSelectedIds(new Set()); setIsSelecting(false);
    } catch { toast.error(t('common.something_wrong')); }
  };

  const handleBulkDelete = async () => {
    try {
      await Promise.all(Array.from(selectedIds).map(id => deleteGarment.mutateAsync(id)));
      toast.success(`${selectedIds.size} ${t('wardrobe.removed')}`);
      setSelectedIds(new Set()); setIsSelecting(false);
    } catch { toast.error(t('common.something_wrong')); }
  };

  const isOverLimit = !isPremium && (displayGarments?.length || 0) >= PLAN_LIMITS.free.maxGarments;

  const hasActiveFilters = selectedCategory !== 'all' || selectedColor || selectedSeason || sortBy !== 'created_at' || showLaundry;

  const clearFilters = () => {
    setSelectedCategory('all');
    setSelectedColor(null);
    setSelectedSeason(null);
    setSortBy('created_at');
    setShowLaundry(false);
  };

  const handleRefresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['garments'] });
    await queryClient.invalidateQueries({ queryKey: ['garments-count'] });
  }, [queryClient]);

  return (
    <AppLayout>
      <PullToRefresh onRefresh={handleRefresh}>
        <AnimatedPage className="px-6 pb-36 pt-12 space-y-8 max-w-lg mx-auto">
          {/* Title row */}
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold">{t('wardrobe.title')}</h1>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsGridView(!isGridView)}
                className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-muted/40 transition-colors active:scale-95"
                aria-label={isGridView ? 'List view' : 'Grid view'}
              >
                {isGridView ? <List className="w-[18px] h-[18px] text-muted-foreground" /> : <Grid3X3 className="w-[18px] h-[18px] text-muted-foreground" />}
              </button>
              {!isSelecting ? (
                <button onClick={() => setIsSelecting(true)} className="text-[13px] font-medium text-muted-foreground px-2 py-1 rounded-lg hover:bg-muted/40 transition-colors">{t('wardrobe.select')}</button>
              ) : (
                <button onClick={() => { setIsSelecting(false); setSelectedIds(new Set()); }} className="text-[13px] font-medium text-primary px-2 py-1 rounded-lg hover:bg-muted/40 transition-colors">{t('common.cancel')}</button>
              )}
            </div>
          </div>

          {/* Segmented control */}
          <div className="flex p-0.5 rounded-xl bg-muted/30">
            {(['garments', 'outfits'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'flex-1 py-2 text-[13px] font-medium rounded-[10px] transition-all duration-200',
                  activeTab === tab
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground/60'
                )}
              >
                {t(`wardrobe.tab_${tab}`)}
              </button>
            ))}
          </div>

          <AnimatedTab tabKey={activeTab}>
            {activeTab === 'garments' ? (
              <div className="space-y-6">
                {/* Search bar + filter */}
                <div className="flex gap-2.5">
                  <div className="relative flex-1">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40 pointer-events-none" />
                    <Input
                      placeholder={`${t('wardrobe.search')} ${totalCount ?? ''} ${t('wardrobe.garments_count_label')}...`}
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-10 bg-muted/30 border-0 h-11 rounded-xl text-[14px] placeholder:text-muted-foreground/40"
                    />
                    {search && (
                      <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 active:scale-90 transition-transform">
                        <X className="w-4 h-4 text-muted-foreground/50" />
                      </button>
                    )}
                  </div>
                  <button
                    onClick={() => setShowFilterSheet(true)}
                    className={cn(
                      'h-11 w-11 rounded-xl flex-shrink-0 flex items-center justify-center transition-colors relative',
                      hasActiveFilters ? 'bg-primary/10 text-primary' : 'bg-muted/30 text-muted-foreground/60 hover:bg-muted/50'
                    )}
                  >
                    <SlidersHorizontal className="w-4 h-4" />
                    {hasActiveFilters && (
                      <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-primary" />
                    )}
                  </button>
                </div>

                {/* Smart groupings — only when no search/filters active */}
                {!search && !hasActiveFilters && displayGarments.length > 5 && (
                  <SmartGroupings garments={displayGarments} />
                )}

                {/* All garments section header */}
                {!search && !hasActiveFilters && displayGarments.length > 5 && (
                  <SectionHeader title={t('wardrobe.all_garments')} />
                )}

                {/* Bulk select bar */}
                {isSelecting && selectedIds.size > 0 && (
                  <div className="flex items-center justify-between p-3.5 rounded-2xl bg-muted/30">
                    <span className="text-[13px] font-medium">{selectedIds.size} {t('wardrobe.selected')}</span>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={handleBulkLaundry} className="rounded-xl h-8 text-xs">
                        <WashingMachine className="w-3.5 h-3.5 mr-1" />{t('wardrobe.laundry')}
                      </Button>
                      <Button size="sm" variant="destructive" onClick={handleBulkDelete} className="rounded-xl h-8 text-xs">
                        <Trash2 className="w-3.5 h-3.5 mr-1" />{t('wardrobe.remove')}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Garment grid */}
                {isLoading ? (
                  <GarmentGridSkeleton count={6} grid={isGridView} />
                ) : displayGarments.length > 0 ? (
                  <GarmentListContent
                    garments={displayGarments}
                    isGridView={isGridView}
                    isSelecting={isSelecting}
                    selectedIds={selectedIds}
                    onSelect={toggleSelect}
                    onEdit={(id) => navigate(`/wardrobe/${id}/edit`)}
                    onLaundry={(garment) => updateGarment.mutate({ id: garment.id, updates: { in_laundry: !garment.in_laundry } })}
                    onDelete={(id) => deleteGarment.mutate(id)}
                    onLoadMore={() => { if (hasNextPage && !isFetchingNextPage) fetchNextPage(); }}
                    hasNextPage={!!hasNextPage}
                    isFetchingNextPage={isFetchingNextPage}
                  />
                ) : (
                  <EmptyState
                    icon={Shirt}
                    title={hasActiveFilters || search ? t('wardrobe.no_results') : t('wardrobe.no_garments')}
                    description={hasActiveFilters || search ? t('wardrobe.try_other') : t('wardrobe.add_first')}
                    action={!hasActiveFilters && !search ? { label: t('wardrobe.add'), onClick: handleAddGarment, icon: Plus } : undefined}
                  />
                )}
              </div>
            ) : (
              <div>
                <WardrobeOutfitsTab />
              </div>
            )}
          </AnimatedTab>

          {/* Single FAB with menu */}
          {activeTab === 'garments' && (
            <AddFAB
              onPhoto={handleAddGarment}
              onScan={() => navigate('/wardrobe/scan')}
              isOverLimit={isOverLimit}
            />
          )}
        </AnimatedPage>
      </PullToRefresh>

      {/* Filter bottom sheet */}
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
