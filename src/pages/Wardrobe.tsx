import { useState, useMemo, useEffect, useRef, useCallback, Fragment } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { TAP_TRANSITION } from '@/lib/motion';
import { useNavigate } from 'react-router-dom';
import hangerLogo from '@/assets/burs-logo.png';
import hangerLogoWhite from '@/assets/burs-logo-white.png';
import { 
  Plus, Search, Loader2, WashingMachine,
  Grid3X3, List, X, Trash2, Shirt, ScanLine, Camera, SlidersHorizontal
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
import { PullToRefresh } from '@/components/layout/PullToRefresh';
import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState } from '@/components/layout/EmptyState';
import { LazyImageSimple } from '@/components/ui/lazy-image';
import { useLanguage } from '@/contexts/LanguageContext';
import { WardrobeOutfitsTab } from '@/components/wardrobe/WardrobeOutfitsTab';
import { AnimatedPage } from '@/components/ui/animated-page';
import { AnimatedTab } from '@/components/ui/animated-tab';

const colorFilters = ['svart', 'vit', 'grå', 'marinblå', 'blå', 'röd', 'grön', 'beige', 'brun'];
const seasonFilters = ['vår', 'sommar', 'höst', 'vinter'];

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

  // Grid view — lookbook style with overlay title
  return (
    <motion.button
      whileTap={{ scale: 0.97, y: -2 }}
      transition={TAP_TRANSITION}
      onClick={handleClick}
      className={cn(
        'w-full rounded-2xl overflow-hidden transition-colors text-left will-change-transform relative',
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
        {/* Gradient overlay with title */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/50 via-black/20 to-transparent pt-10 pb-2.5 px-2.5">
          <p className="text-white text-[13px] font-medium truncate drop-shadow-sm">{garment.title}</p>
        </div>
        {isSelecting && (
          <div className="absolute top-2 left-2">
            <Checkbox checked={isSelected} className="bg-background/80" />
          </div>
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
      <div className={cn(isGridView ? 'grid grid-cols-2 gap-3' : 'flex flex-col gap-2')}>
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
              <div className={cn(isGridView ? 'grid grid-cols-2 gap-3 h-full' : 'flex flex-col gap-2')}>
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
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-20"
              onClick={() => setOpen(false)}
            />
            {/* Menu items */}
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
        className="h-14 w-14 rounded-xl shadow-lg bg-accent text-accent-foreground hover:bg-accent/90 relative z-30"
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
  const [filters, setFilters] = useState<GarmentFilters>({});
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [selectedSeason, setSelectedSeason] = useState<string | null>(null);
  const [isGridView, setIsGridView] = useState(true);
  const [showPaywall, setShowPaywall] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
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
    ...filters, search: debouncedSearch,
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

  const clearFilters = () => { setSelectedCategory('all'); setSelectedColor(null); setSelectedSeason(null); setFilters({}); setSearch(''); setSortBy('created_at'); setShowLaundry(false); };
  const hasActiveFilters = selectedCategory !== 'all' || selectedColor || selectedSeason || search || sortBy !== 'created_at' || showLaundry;

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
            <Button variant="ghost" size="icon" onClick={() => setIsGridView(!isGridView)} aria-label={isGridView ? 'List view' : 'Grid view'}>
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
      <AnimatedPage className="px-4 pb-36 pt-5 space-y-4 max-w-lg mx-auto">
        {/* Slim segmented control */}
        <div className="flex p-0.5 rounded-xl bg-foreground/[0.04]">
          {(['garments', 'outfits'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'flex-1 py-1.5 text-xs font-medium rounded-lg transition-all duration-200',
                activeTab === tab
                  ? 'bg-foreground/[0.06] text-foreground'
                  : 'text-muted-foreground'
              )}
            >
              {t(`wardrobe.tab_${tab}`)}
            </button>
          ))}
        </div>

        <AnimatedTab tabKey={activeTab}>
        {activeTab === 'garments' ? (
          <div className="space-y-4">
            {/* Search bar — always visible, count in placeholder */}
            <div className="relative">
              <img src={hangerLogo} alt="" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 object-contain pointer-events-none opacity-50 z-10 dark:hidden" />
              <img src={hangerLogoWhite} alt="" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 object-contain pointer-events-none opacity-50 z-10 hidden dark:block" />
              <Input
                placeholder={`${t('wardrobe.search')} ${totalCount ?? ''} ${t('wardrobe.garments_count_label')}...`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-foreground/[0.04] border-0 h-10 rounded-xl text-sm"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              )}
            </div>

            {/* Category pills — horizontal scroll */}
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={cn(
                    'whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium transition-all shrink-0',
                    selectedCategory === cat.id
                      ? 'bg-accent text-accent-foreground'
                      : 'bg-foreground/[0.04] text-muted-foreground hover:bg-foreground/[0.08]'
                  )}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Filter pill + laundry toggle + sort pills */}
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-0.5">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all shrink-0',
                  showFilters || hasActiveFilters
                    ? 'bg-accent/10 text-accent'
                    : 'bg-foreground/[0.04] text-muted-foreground'
                )}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                {t('wardrobe.filter')}
                {hasActiveFilters && <span className="w-1.5 h-1.5 rounded-full bg-accent" />}
              </button>

              {/* Laundry toggle */}
              <button
                onClick={() => setShowLaundry(!showLaundry)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all shrink-0',
                  showLaundry
                    ? 'bg-accent/10 text-accent'
                    : 'bg-foreground/[0.04] text-muted-foreground'
                )}
              >
                <WashingMachine className="w-3.5 h-3.5" />
                {t('wardrobe.in_laundry')}
              </button>

              {/* Sort divider */}
              <div className="w-px h-4 bg-border/40 shrink-0" />

              {/* Sort pills */}
              {([
                { key: 'created_at' as const, label: t('wardrobe.sort.latest') },
                { key: 'last_worn_at' as const, label: t('wardrobe.sort.last_worn') },
                { key: 'wear_count' as const, label: t('wardrobe.sort.most_used') },
              ]).map(sort => (
                <button
                  key={sort.key}
                  onClick={() => setSortBy(sort.key)}
                  className={cn(
                    'whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium transition-all shrink-0',
                    sortBy === sort.key
                      ? 'bg-accent/10 text-accent'
                      : 'bg-foreground/[0.04] text-muted-foreground'
                  )}
                >
                  {sort.label}
                </button>
              ))}

              {hasActiveFilters && (
                <button onClick={clearFilters} className="text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0">
                  {t('wardrobe.clear')}
                </button>
              )}
            </div>

            <AnimatePresence>
              {showFilters && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="space-y-3 pb-2">
                    {/* Color row */}
                    <div className="space-y-1.5">
                      <span className="text-[11px] text-muted-foreground uppercase tracking-wider">{t('wardrobe.color')}</span>
                      <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-1">
                        {colorFilters.map((color) => (
                          <button
                            key={color}
                            onClick={() => setSelectedColor(selectedColor === color ? null : color)}
                            className={cn(
                              'whitespace-nowrap px-2.5 py-1 rounded-full text-xs transition-all shrink-0',
                              selectedColor === color
                                ? 'bg-accent/10 text-accent font-medium'
                                : 'bg-foreground/[0.04] text-muted-foreground'
                            )}
                          >
                            {t(`color.${color}`)}
                          </button>
                        ))}
                      </div>
                    </div>
                    {/* Season row */}
                    <div className="space-y-1.5">
                      <span className="text-[11px] text-muted-foreground uppercase tracking-wider">{t('wardrobe.season')}</span>
                      <div className="flex gap-1.5">
                        {seasonFilters.map((season) => (
                          <button
                            key={season}
                            onClick={() => setSelectedSeason(selectedSeason === season ? null : season)}
                            className={cn(
                              'flex-1 py-1.5 rounded-full text-xs transition-all capitalize',
                              selectedSeason === season
                                ? 'bg-accent/10 text-accent font-medium'
                                : 'bg-foreground/[0.04] text-muted-foreground'
                            )}
                          >
                            {t(`garment.season.${season === 'vår' ? 'spring' : season === 'sommar' ? 'summer' : season === 'höst' ? 'autumn' : 'winter'}`)}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Bulk select bar */}
            {isSelecting && selectedIds.size > 0 && (
              <div className="flex items-center justify-between p-3 rounded-xl bg-foreground/[0.04]">
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

      <PaywallModal isOpen={showPaywall} onClose={() => setShowPaywall(false)} reason="garments" />
    </AppLayout>
  );
}
