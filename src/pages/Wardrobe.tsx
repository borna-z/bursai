import { useState, useMemo, useEffect, useRef, useCallback, Fragment } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, Search, Loader2, WashingMachine,
  Grid3X3, List, X, Trash2, Shirt, ScanLine, ChevronDown, ChevronUp
} from 'lucide-react';
import { SwipeableGarmentCard } from '@/components/wardrobe/SwipeableGarmentCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { GarmentGridSkeleton } from '@/components/ui/skeletons';
import { useGarments, useUpdateGarment, useDeleteGarment, useGarmentCount, type GarmentFilters, type Garment } from '@/hooks/useGarments';
import { useSubscription, PLAN_LIMITS } from '@/hooks/useSubscription';
import { PaywallModal } from '@/components/PaywallModal';
import { AppLayout } from '@/components/layout/AppLayout';
import { PullToRefresh } from '@/components/layout/PullToRefresh';
import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState } from '@/components/layout/EmptyState';
import { SettingsGroup } from '@/components/settings/SettingsGroup';
import { LazyImageSimple } from '@/components/ui/lazy-image';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useLanguage } from '@/contexts/LanguageContext';
import { WardrobeOutfitsTab } from '@/components/wardrobe/WardrobeOutfitsTab';
import { AnimatedPage } from '@/components/ui/animated-page';
import { AnimatedTab } from '@/components/ui/animated-tab';

const colorFilters = ['svart', 'vit', 'grå', 'marinblå', 'blå', 'röd', 'grön', 'beige', 'brun'];
const seasonFilters = ['vår', 'sommar', 'höst', 'vinter'];

interface GarmentCardProps {
  garment: Garment;
  isGridView: boolean;
  isSelecting: boolean;
  isSelected: boolean;
  onSelect: () => void;
}

function GarmentCard({ garment, isGridView, isSelecting, isSelected, onSelect }: GarmentCardProps) {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const handleClick = () => {
    if (isSelecting) { onSelect(); } else { navigate(`/wardrobe/${garment.id}`); }
  };

  if (!isGridView) {
    return (
      <motion.button
        whileTap={{ scale: 0.975 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30, mass: 0.5 }}
        onClick={handleClick}
        className={cn(
          'w-full flex items-center gap-3 p-3 glass-card rounded-xl transition-colors text-left will-change-transform',
          garment.in_laundry && 'opacity-60',
          isSelected && 'ring-2 ring-accent'
        )}
      >
        {isSelecting && <Checkbox checked={isSelected} className="shrink-0" />}
        <LazyImageSimple
          imagePath={garment.image_path}
          alt={garment.title}
          className="w-14 h-14 rounded-lg shrink-0"
          fallbackIcon={<Shirt className="w-5 h-5 text-muted-foreground/30" />}
        />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{garment.title}</p>
          <p className="text-xs text-muted-foreground capitalize">{t(`garment.category.${garment.category}`)} · {t(`color.${garment.color_primary}`)}</p>
        </div>
      </motion.button>
    );
  }

  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30, mass: 0.5 }}
      onClick={handleClick}
      className={cn(
        'w-full glass-card rounded-xl overflow-hidden transition-colors text-left will-change-transform',
        garment.in_laundry && 'opacity-60',
        isSelected && 'ring-2 ring-accent'
      )}
    >
      <div className="aspect-square bg-muted relative">
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
      </div>
      <div className="p-2.5">
        <p className="font-medium text-sm truncate">{garment.title}</p>
        <p className="text-xs text-muted-foreground capitalize">{t(`garment.category.${garment.category}`)} · {t(`color.${garment.color_primary}`)}</p>
      </div>
    </motion.button>
  );
}

// ── Virtualized garment list ──
const GRID_ROW_HEIGHT = 220; // aspect-square + padding
const LIST_ROW_HEIGHT = 74;  // p-3 + h-14 image + gaps
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
  isFetchingNextPage: boolean;
}

function VirtualizedGarmentList({
  garments, isGridView, isSelecting, selectedIds,
  onSelect, onEdit, onLaundry, onDelete, onLoadMore, isFetchingNextPage,
}: VirtualizedGarmentListProps) {
  const navigate = useNavigate();
  const parentRef = useRef<HTMLDivElement>(null);

  // In grid mode we render 2 items per row
  const cols = isGridView ? 2 : 1;
  const rowCount = Math.ceil(garments.length / cols);
  const estimateSize = isGridView ? GRID_ROW_HEIGHT : LIST_ROW_HEIGHT;

  const virtualizer = useVirtualizer({
    count: rowCount + 1, // +1 for sentinel / loading row
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize + GAP,
    overscan: 5,
  });

  // Load more when we reach the sentinel row
  useEffect(() => {
    const lastItem = virtualizer.getVirtualItems().at(-1);
    if (lastItem && lastItem.index >= rowCount) {
      onLoadMore();
    }
  }, [virtualizer.getVirtualItems(), rowCount, onLoadMore]);

  return (
    <div
      ref={parentRef}
      className="w-full"
      style={{ height: Math.min(rowCount * (estimateSize + GAP), 600), overflow: 'auto' }}
    >
      <div
        style={{
          height: virtualizer.getTotalSize(),
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          // Sentinel / loading row
          if (virtualRow.index >= rowCount) {
            return (
              <div
                key="sentinel"
                style={{
                  position: 'absolute',
                  top: virtualRow.start,
                  left: 0,
                  width: '100%',
                  height: virtualRow.size,
                }}
              >
                {isFetchingNextPage && (
                  isGridView ? (
                    <div className="grid grid-cols-2 gap-3">
                      {[1, 2].map(i => (
                        <div key={i} className="glass-card rounded-xl overflow-hidden">
                          <Skeleton className="aspect-square w-full" />
                          <div className="p-2.5 space-y-1.5">
                            <Skeleton className="h-4 w-3/4" />
                            <Skeleton className="h-3 w-1/2" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {[1, 2].map(i => (
                        <div key={i} className="flex items-center gap-3 p-3 glass-card rounded-xl">
                          <Skeleton className="w-14 h-14 rounded-lg shrink-0" />
                          <div className="flex-1 space-y-1.5">
                            <Skeleton className="h-4 w-3/4" />
                            <Skeleton className="h-3 w-1/2" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                )}
              </div>
            );
          }

          const startIdx = virtualRow.index * cols;
          const rowGarments = garments.slice(startIdx, startIdx + cols);

          return (
            <div
              key={virtualRow.index}
              style={{
                position: 'absolute',
                top: virtualRow.start,
                left: 0,
                width: '100%',
                height: virtualRow.size,
                paddingBottom: GAP,
              }}
            >
              <div className={cn(isGridView ? 'grid grid-cols-2 gap-3 h-full' : 'flex flex-col gap-2')}>
                {rowGarments.map((garment) => (
                  <Fragment key={garment.id}>
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
                  </Fragment>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function WardrobePage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'garments' | 'outfits'>('garments');
  const [filters, setFilters] = useState<GarmentFilters>({});
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [selectedSeason, setSelectedSeason] = useState<string | null>(null);
  const [isGridView, setIsGridView] = useState(true);
  const [showPaywall, setShowPaywall] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);
  
  const updateGarment = useUpdateGarment();
  const deleteGarment = useDeleteGarment();
  
  const queryResult = useGarments({
    ...filters, search: debouncedSearch,
    category: selectedCategory === 'all' ? undefined : selectedCategory,
    color: selectedColor || undefined,
    season: selectedSeason || undefined,
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

  const sortOptions = [
    { id: 'created_at', label: t('wardrobe.sort.latest') },
    { id: 'wear_count', label: t('wardrobe.sort.most_used') },
    { id: 'last_worn_at', label: t('wardrobe.sort.least_used') },
  ];

  const handleFilterChange = (key: keyof GarmentFilters, value: unknown) => {
    setFilters((prev) => ({ ...prev, [key]: value === 'all' ? undefined : value }));
  };

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

  const clearFilters = () => { setSelectedCategory('all'); setSelectedColor(null); setSelectedSeason(null); setFilters({}); setSearch(''); };
  const hasActiveFilters = selectedCategory !== 'all' || selectedColor || selectedSeason || search;

  const handleRefresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['garments'] });
    await queryClient.invalidateQueries({ queryKey: ['garments-count'] });
  }, [queryClient]);

  return (
    <AppLayout>
      <PageHeader 
        title={t('wardrobe.title')} 
        actions={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => setIsGridView(!isGridView)}>
              {isGridView ? <List className="w-5 h-5" /> : <Grid3X3 className="w-5 h-5" />}
            </Button>
            {!isSelecting ? (
              <Button variant="ghost" size="sm" onClick={() => setIsSelecting(true)}>{t('wardrobe.select')}</Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => { setIsSelecting(false); setSelectedIds(new Set()); }}>{t('common.cancel')}</Button>
            )}
          </div>
        }
      />
      
      <PullToRefresh onRefresh={handleRefresh}>
      <AnimatedPage className="px-4 pb-36 pt-4 space-y-5 max-w-lg mx-auto">
        {/* Segmented control */}
        <div className="flex p-1 rounded-2xl bg-foreground/[0.04] backdrop-blur-sm border border-border/30">
          {(['garments', 'outfits'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'flex-1 py-2 text-sm font-medium rounded-xl transition-all duration-200',
                activeTab === tab
                  ? 'bg-background/80 backdrop-blur-md text-foreground shadow-[0_1px_3px_rgba(0,0,0,0.08)]'
                  : 'text-muted-foreground'
              )}
            >
              {t(`wardrobe.tab_${tab}`)}
            </button>
          ))}
        </div>

        <AnimatedTab tabKey={activeTab}>
        {activeTab === 'garments' ? (
          <div className="space-y-5">
            {/* Search */}
            <SettingsGroup>
              <Collapsible open={searchOpen} onOpenChange={setSearchOpen}>
                <CollapsibleTrigger className="w-full flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Search className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{search || t('wardrobe.search')}</span>
                  </div>
                  {searchOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="px-4 pb-3">
                    <Input
                      placeholder={t('wardrobe.search')}
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="bg-muted/50 border-0"
                      autoFocus
                    />
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </SettingsGroup>

            {/* Category grid */}
            <SettingsGroup title={t('wardrobe.category')}>
              <div className="grid grid-cols-4">
                {categories.map((cat, index) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={cn(
                      'py-3 text-sm font-medium transition-colors relative',
                      selectedCategory === cat.id
                        ? 'text-accent bg-accent/5'
                        : 'text-foreground hover:bg-muted/50',
                      index % 4 !== 3 && 'border-r border-border/50',
                      index < 4 && 'border-b border-border/50',
                    )}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </SettingsGroup>

            {/* Filters */}
            <SettingsGroup>
              <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
                <CollapsibleTrigger className="w-full flex items-center justify-between px-4 py-3">
                  <span className="text-sm font-medium">{t('wardrobe.filter')}</span>
                  <div className="flex items-center gap-2">
                    {hasActiveFilters && (
                      <span className="w-2 h-2 rounded-full bg-accent" />
                    )}
                    {filtersOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="px-4 pb-4 space-y-4">
                    {/* Sort */}
                    <div className="space-y-1.5">
                      <span className="text-xs text-muted-foreground uppercase tracking-wide">{t('wardrobe.sort')}</span>
                      <Select value={filters.sortBy || 'created_at'} onValueChange={(v) => handleFilterChange('sortBy', v as GarmentFilters['sortBy'])}>
                        <SelectTrigger className="bg-muted/50 border-0"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {sortOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Color */}
                    <div className="space-y-1.5">
                      <span className="text-xs text-muted-foreground uppercase tracking-wide">{t('wardrobe.color')}</span>
                      <div className="grid grid-cols-3 gap-1.5">
                        {colorFilters.map((color) => (
                          <button
                            key={color}
                            onClick={() => setSelectedColor(selectedColor === color ? null : color)}
                            className={cn(
                              'py-2 text-xs rounded-lg capitalize transition-colors',
                              selectedColor === color
                                ? 'bg-accent/10 text-accent font-medium'
                                : 'bg-muted/30 backdrop-blur-sm text-foreground hover:bg-muted/50'
                            )}
                          >
                            {t(`color.${color}`)}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Season */}
                    <div className="space-y-1.5">
                      <span className="text-xs text-muted-foreground uppercase tracking-wide">{t('wardrobe.season')}</span>
                      <div className="grid grid-cols-4 gap-1.5">
                        {seasonFilters.map((season) => (
                          <button
                            key={season}
                            onClick={() => setSelectedSeason(selectedSeason === season ? null : season)}
                            className={cn(
                              'py-2 text-xs rounded-lg capitalize transition-colors',
                              selectedSeason === season
                                ? 'bg-accent/10 text-accent font-medium'
                                : 'bg-muted/30 backdrop-blur-sm text-foreground hover:bg-muted/50'
                            )}
                          >
                            {t(`garment.season.${season === 'vår' ? 'spring' : season === 'sommar' ? 'summer' : season === 'höst' ? 'autumn' : 'winter'}`)}
                          </button>
                        ))}
                      </div>
                    </div>

                    {hasActiveFilters && (
                      <button onClick={clearFilters} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                        <X className="w-3.5 h-3.5" />
                        {t('wardrobe.clear')}
                      </button>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </SettingsGroup>

            {/* Count */}
            <p className="text-xs text-muted-foreground px-1">
              {hasNextPage && totalCount
                ? `${displayGarments.length} av ${totalCount} ${t('wardrobe.garments_count_label')}`
                : `${displayGarments.length} ${t('wardrobe.garments_count_label')}`}
            </p>

            {/* Bulk select bar */}
            {isSelecting && selectedIds.size > 0 && (
              <div className="flex items-center justify-between p-3 glass-card rounded-xl">
                <span className="text-sm font-medium">{selectedIds.size} {t('wardrobe.selected')}</span>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={handleBulkLaundry} className="rounded-xl">
                    <WashingMachine className="w-4 h-4 mr-1" />{t('wardrobe.laundry')}
                  </Button>
                  <Button size="sm" variant="destructive" onClick={handleBulkDelete} className="rounded-xl">
                    <Trash2 className="w-4 h-4 mr-1" />{t('wardrobe.remove')}
                  </Button>
                </div>
              </div>
            )}

            {/* Garment grid - virtualized */}
            {isLoading ? (
              <GarmentGridSkeleton count={6} grid={isGridView} />
            ) : displayGarments.length > 0 ? (
              <VirtualizedGarmentList
                garments={displayGarments}
                isGridView={isGridView}
                isSelecting={isSelecting}
                selectedIds={selectedIds}
                onSelect={toggleSelect}
                onEdit={(id) => navigate(`/wardrobe/${id}/edit`)}
                onLaundry={(garment) => updateGarment.mutate({ id: garment.id, updates: { in_laundry: !garment.in_laundry } })}
                onDelete={(id) => deleteGarment.mutate(id)}
                onLoadMore={() => { if (hasNextPage && !isFetchingNextPage) fetchNextPage(); }}
                isFetchingNextPage={isFetchingNextPage}
              />
            ) : (
              <EmptyState
                icon={Shirt}
                title={hasActiveFilters ? t('wardrobe.no_results') : t('wardrobe.no_garments')}
                description={hasActiveFilters ? t('wardrobe.try_other') : t('wardrobe.add_first')}
                action={!hasActiveFilters ? { label: t('wardrobe.add'), onClick: handleAddGarment, icon: Plus } : undefined}
              />
            )}
          </div>
        ) : (
          <div>
            <WardrobeOutfitsTab />
          </div>
        )}
        </AnimatedTab>

        {/* FABs - only show on garments tab */}
        {activeTab === 'garments' && (
          <div className="fixed bottom-24 right-4 z-30 flex flex-col gap-3">
            <Button
              size="lg"
              variant="outline"
              className="h-14 w-14 rounded-xl shadow-lg bg-card border-border"
              onClick={() => navigate('/wardrobe/scan')}
              aria-label="Live Scan"
            >
              <ScanLine className="w-6 h-6" />
            </Button>
            <Button
              size="lg"
              className={cn(
                "h-14 w-14 rounded-xl shadow-lg bg-accent text-accent-foreground hover:bg-accent/90",
                isOverLimit && "opacity-50"
              )}
              onClick={handleAddGarment}
            >
              <Plus className="w-6 h-6" />
            </Button>
          </div>
        )}
      </AnimatedPage>
      </PullToRefresh>

      <PaywallModal isOpen={showPaywall} onClose={() => setShowPaywall(false)} reason="garments" />
    </AppLayout>
  );
}
