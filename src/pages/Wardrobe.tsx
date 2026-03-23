import { useVirtualizer } from '@tanstack/react-virtual';
import { useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { TAP_TRANSITION, EASE_CURVE, STAGGER_DELAY, DISTANCE, DURATION_MEDIUM, PRESETS } from '@/lib/motion';
import { useState, useMemo, useEffect, useRef, useCallback, Fragment, type MouseEvent } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Plus, Search, X, Trash2, Shirt, ScanLine, Camera,
  SlidersHorizontal, Grid3X3, List, WashingMachine, Sparkles,
} from 'lucide-react';
import { SwipeableGarmentCard } from '@/components/wardrobe/SwipeableGarmentCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { GarmentGridSkeleton } from '@/components/ui/skeletons';
import { useGarments, useUpdateGarment, useDeleteGarment, useGarmentCount, type Garment } from '@/hooks/useGarments';
import { useSubscription, PLAN_LIMITS } from '@/hooks/useSubscription';
import { PaywallModal } from '@/components/PaywallModal';
import { AppLayout } from '@/components/layout/AppLayout';
import { PullToRefresh } from '@/components/layout/PullToRefresh';
import { EmptyState } from '@/components/layout/EmptyState';
import { LazyImageSimple } from '@/components/ui/lazy-image';
import { useLanguage } from '@/contexts/LanguageContext';
import { WardrobeOutfitsTab } from '@/components/wardrobe/WardrobeOutfitsTab';
import { AnimatedPage } from '@/components/ui/animated-page';
import { AnimatedTab } from '@/components/ui/animated-tab';
import { FilterSheet } from '@/components/wardrobe/FilterSheet';
import { categoryLabel, colorLabel } from '@/lib/humanize';
import { Chip } from '@/components/ui/chip';
import { CoachMark } from '@/components/coach/CoachMark';
import { useFirstRunCoach } from '@/hooks/useFirstRunCoach';
import { getPreferredGarmentImagePath } from '@/lib/garmentImage';
import { GarmentProcessingBadge } from '@/components/wardrobe/GarmentProcessingBadge';
import { RenderPendingOverlay } from '@/components/wardrobe/RenderPendingOverlay';

// ── Garment Card ──

const cardReveal = {
  hidden: { opacity: 0, y: DISTANCE.md },
  visible: { opacity: 1, y: 0 },
};

interface GarmentCardProps {
  garment: Garment;
  isGridView: boolean;
  isSelecting: boolean;
  isSelected: boolean;
  onSelect: () => void;
  index?: number;
}

function GarmentCard({ garment, isGridView, isSelecting, isSelected, onSelect, index = 0 }: GarmentCardProps) {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const handleClick = () => {
    if (isSelecting) { onSelect(); } else { navigate(`/wardrobe/${garment.id}`); }
  };
  const handleStyleAround = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    navigate('/ai', { state: { selectedGarmentId: garment.id } });
  };
  const displayImagePath = getPreferredGarmentImagePath(garment);

  if (!isGridView) {
    return (
      <motion.div
        role="button"
        tabIndex={0}
        onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ' ) { event.preventDefault(); handleClick(); } }}
        variants={cardReveal}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-20px' }}
        transition={{ ease: EASE_CURVE, duration: DURATION_MEDIUM, delay: (index % 6) * STAGGER_DELAY }}
        whileTap={{ scale: 0.975 }}
        onClick={handleClick}
        className={cn(
          'w-full flex items-center gap-3 p-3 rounded-xl transition-colors text-left will-change-transform',
          garment.in_laundry && 'opacity-60',
          isSelected && 'ring-2 ring-accent'
        )}
      >
        {isSelecting && <Checkbox checked={isSelected} className="shrink-0" />}
        <div className="relative w-16 h-16 rounded-xl shrink-0 overflow-hidden">
          <LazyImageSimple
            imagePath={displayImagePath}
            alt={garment.title}
            className="w-16 h-16 rounded-xl shrink-0"
            fallbackIcon={<Shirt className="w-5 h-5 text-muted-foreground/30" />}
          />
          <RenderPendingOverlay renderStatus={garment.render_status} variant="overlay" className="[&>span]:hidden" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{garment.title}</p>
          <p className="text-xs text-muted-foreground capitalize">{categoryLabel(t, garment.category)} · {colorLabel(t, garment.color_primary)}</p>
          {(garment.render_status === 'pending' || garment.render_status === 'rendering') ? (
            <RenderPendingOverlay renderStatus={garment.render_status} variant="badge" className="mt-1" />
          ) : (
            <GarmentProcessingBadge
              status={garment.image_processing_status}
              renderStatus={garment.render_status}
              className="mt-1"
            />
          )}
          {!isSelecting && (
            <button
              type="button"
              onClick={handleStyleAround}
              className="mt-2 inline-flex h-8 items-center gap-1 rounded-full border border-primary/20 bg-primary/5 px-3 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Style around this
            </button>
          )}
        </div>
      </motion.div>
    );
  }

  // Grid view — clean gallery, name on tap only
  return (
    <motion.div
      role="button"
      tabIndex={0}
      onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ' ) { event.preventDefault(); handleClick(); } }}
      variants={cardReveal}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-20px' }}
      transition={{ ease: EASE_CURVE, duration: DURATION_MEDIUM, delay: (index % 6) * STAGGER_DELAY }}
      whileTap={PRESETS.PRESS.whileTap}
      onClick={handleClick}
      className={cn(
        'w-full rounded-xl overflow-hidden transition-colors text-left will-change-transform relative group',
        garment.in_laundry && 'opacity-60',
        isSelected && 'ring-2 ring-accent'
      )}
    >
      <div className="aspect-[3/4] bg-muted relative overflow-hidden rounded-xl">
        <LazyImageSimple
          imagePath={displayImagePath}
          alt={garment.title}
          className="w-full h-full"
          fallbackIcon={<Shirt className="w-8 h-8 text-muted-foreground/50" />}
        />
        <RenderPendingOverlay renderStatus={garment.render_status} />
        {!(garment.render_status === 'pending' || garment.render_status === 'rendering') && (
          <div className="absolute left-2 bottom-2">
            <GarmentProcessingBadge status={garment.image_processing_status} renderStatus={garment.render_status} />
          </div>
        )}
        {isSelecting && (
          <div className="absolute top-2 left-2">
            <Checkbox checked={isSelected} className="bg-background/80" />
          </div>
        )}
        {/* Usage badge */}
        {(garment.wear_count || 0) > 0 && (
          <span className="absolute top-2 right-2 text-[11px] font-medium bg-background/70 backdrop-blur-sm border border-white/10 px-1.5 py-0.5 rounded-full text-foreground/80">
            {garment.wear_count}×
          </span>
        )}
        {!isSelecting && (
          <button
            type="button"
            onClick={handleStyleAround}
            className="absolute inset-x-2 bottom-2 inline-flex h-8 items-center justify-center gap-1 rounded-full bg-background/88 px-3 text-xs font-medium text-foreground shadow-sm backdrop-blur-sm transition-colors hover:bg-background"
          >
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Style around this
          </button>
        )}
      </div>
    </motion.div>
  );
}

// ── Virtualization ──

const VIRTUALIZE_THRESHOLD = 30;
const GRID_ROW_HEIGHT = 180;
const LIST_ROW_HEIGHT = 74;
const GAP = 6;

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
      <div className={cn(isGridView ? 'grid grid-cols-3 gap-[5px]' : 'flex flex-col gap-1')}>
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
                index={index}
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
    <div className="grid grid-cols-3 gap-[5px]">
      {[1, 2].map(i => (
        <Skeleton key={i} className="aspect-[3/4] w-full rounded-xl" />
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
  const cols = isGridView ? 3 : 1;
  const rowCount = Math.ceil(garments.length / cols);
  const estimateSize = isGridView ? GRID_ROW_HEIGHT : LIST_ROW_HEIGHT;

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize + GAP,
    overscan: 5,
  });

  return (
    <div ref={parentRef} className="w-full overflow-visible">
      <div style={{ height: virtualizer.getTotalSize(), width: '100%', position: 'relative' }}>
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const startIdx = virtualRow.index * cols;
          const rowGarments = garments.slice(startIdx, startIdx + cols);
          return (
            <div
              key={virtualRow.index}
              style={{ position: 'absolute', top: virtualRow.start, left: 0, width: '100%', height: virtualRow.size, paddingBottom: GAP }}
            >
              <div className={cn(isGridView ? 'grid grid-cols-3 gap-[5px] h-full' : 'flex flex-col gap-1.5')}>
                {rowGarments.map((garment, colIdx) => (
                  <Fragment key={garment.id}>
                    {!isGridView && !isSelecting ? (
                      <SwipeableGarmentCard garment={garment} onEdit={() => onEdit(garment.id)} onLaundry={() => onLaundry(garment)} onDelete={() => onDelete(garment.id)} />
                    ) : (
                      <GarmentCard garment={garment} isGridView={isGridView} isSelecting={isSelecting} isSelected={selectedIds.has(garment.id)} onSelect={() => onSelect(garment.id)} index={startIdx + colIdx} />
                    )}
                  </Fragment>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <div ref={sentinelRef as React.RefObject<HTMLDivElement>} className="h-1" />
      {isFetchingNextPage && <LoadingSkeletons isGridView={isGridView} />}
    </div>
  );
}

// ── FAB Menu ──

const fabItems = [
  { icon: ScanLine, labelKey: 'wardrobe.live_scan', fallback: 'BURS Live Scan', action: 'scan' as const },
  { icon: Camera, labelKey: 'wardrobe.add', fallback: 'Add from Photo', action: 'photo' as const },
];

function AddFAB({ onPhoto, onScan, isOverLimit }: { onPhoto: () => void; onScan: () => void; isOverLimit: boolean }) {
  const [open, setOpen] = useState(false);
  const { t } = useLanguage();
  const navigate = useNavigate();

  const handleAction = (action: 'photo' | 'scan' | 'link') => {
    setOpen(false);
    if (action === 'photo') onPhoto();
    else if (action === 'scan') onScan();
    else navigate('/add-garment', { state: { mode: 'link' } });
  };

  return (
    <>
      {/* Backdrop */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
        )}
      </AnimatePresence>

      <div className="fixed bottom-24 right-4 z-50">
        <AnimatePresence>
          {open && (
            <div className="absolute bottom-16 right-0 flex flex-col gap-3 items-end mb-2">
              {fabItems.map((item, i) => (
                <motion.button
                  key={item.action}
                  initial={{ opacity: 0, y: 20, scale: 0.8 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.9 }}
                  transition={{ duration: 0.25, delay: i * 0.06, ease: [0.25, 0.1, 0.25, 1] }}
                  onClick={() => handleAction(item.action)}
                   className={cn(
                     "flex items-center gap-3 pr-5 pl-1.5 py-1.5 rounded-full bg-card border border-border/20 shadow-lg",
                     item.action === 'photo' && isOverLimit && "opacity-50"
                  )}
                >
                  <span className="w-10 h-10 rounded-full bg-accent flex items-center justify-center flex-shrink-0">
                    <item.icon className="w-[18px] h-[18px] text-accent-foreground" />
                  </span>
                  <span className="text-[13px] font-medium text-foreground whitespace-nowrap">
                    {t(item.labelKey) || item.fallback}
                  </span>
                </motion.button>
              ))}
            </div>
          )}
        </AnimatePresence>

        <motion.button
          whileTap={{ scale: 0.92 }}
          transition={TAP_TRANSITION}
          onClick={() => setOpen(!open)}
          className="h-14 w-14 rounded-full shadow-lg shadow-accent/25 bg-accent text-accent-foreground flex items-center justify-center"
        >
          <Plus className={cn("w-6 h-6 transition-transform duration-200", open && "rotate-45")} />
        </motion.button>
      </div>
    </>
  );
}

// ── Main Page ──

export default function WardrobePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const locationState = location.state as { tab?: string } | null;
  const [activeTab, setActiveTab] = useState<'garments' | 'outfits'>(locationState?.tab === 'outfits' ? 'outfits' : 'garments');
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
  const [smartFilter, setSmartFilter] = useState<'rarely_worn' | 'most_worn' | 'new' | null>(null);

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

  const allGarments = useMemo(() => {
    return infiniteData?.pages.flatMap(p => p.items) ?? [];
  }, [infiniteData]);

  // Apply smart filter on top of query results
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

  // Pre-calculate counts for smart filter chips
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

  const hasActiveFilters = selectedCategory !== 'all' || selectedColor || selectedSeason || sortBy !== 'created_at' || showLaundry || !!smartFilter;
  const activeFilterCount = [selectedCategory !== 'all', !!selectedColor, !!selectedSeason, sortBy !== 'created_at', showLaundry].filter(Boolean).length;

  const clearFilters = () => {
    setSelectedCategory('all');
    setSelectedColor(null);
    setSelectedSeason(null);
    setSortBy('created_at');
    setShowLaundry(false);
    setSmartFilter(null);
  };

  const coach = useFirstRunCoach();

  const handleRefresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['garments'] });
    await queryClient.invalidateQueries({ queryKey: ['garments-count'] });
  }, [queryClient]);

  return (
    <AppLayout>
      <PullToRefresh onRefresh={handleRefresh}>
        <AnimatedPage className="px-5 pb-36 pt-6 space-y-6">
          {/* Title row */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{t('wardrobe.title')}</h1>
              {typeof totalCount === 'number' && totalCount > 0 && (
                <p className="label-editorial mt-0.5 text-muted-foreground/50">{totalCount} {t('wardrobe.garments_count_label').toUpperCase()}</p>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setIsGridView(!isGridView)}
                className="w-10 h-10 rounded-xl surface-inset flex items-center justify-center hover:bg-foreground/[0.05] transition-colors active:scale-95"
                aria-label={isGridView ? 'List view' : 'Grid view'}
              >
                {isGridView ? <List className="w-[18px] h-[18px] text-muted-foreground" /> : <Grid3X3 className="w-[18px] h-[18px] text-muted-foreground" />}
              </button>
              {!isSelecting ? (
                <button onClick={() => setIsSelecting(true)} className="text-sm font-medium text-muted-foreground px-2.5 py-1.5 rounded-lg hover:bg-muted/40 transition-colors">{t('wardrobe.select')}</button>
              ) : (
                <button onClick={() => { setIsSelecting(false); setSelectedIds(new Set()); }} className="text-sm font-medium text-primary px-2.5 py-1.5 rounded-lg hover:bg-muted/40 transition-colors">{t('common.cancel')}</button>
              )}
            </div>
          </div>

          {/* Segmented control */}
          <div className="flex p-1 rounded-[var(--radius,0.75rem)] surface-inset border border-border/10">
            {(['garments', 'outfits'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'flex-1 py-2 text-sm font-semibold rounded-[var(--radius,10px)] transition-all duration-200',
                  activeTab === tab
                    ? 'bg-background text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.06)]'
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
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-muted-foreground/50 pointer-events-none" />
                    <Input
                      placeholder={`${t('wardrobe.search')} ${totalCount ?? ''} ${t('wardrobe.garments_count_label')}...`}
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-10 surface-inset border-border/10 h-11 rounded-xl text-[14px] placeholder:text-muted-foreground/40 shadow-none focus-within:ring-1 focus-within:ring-border/20"
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
                      hasActiveFilters ? 'bg-primary/10 text-primary border border-primary/20' : 'surface-inset text-muted-foreground/60 hover:bg-foreground/[0.05]'
                    )}
                  >
                    <SlidersHorizontal className="w-4 h-4" />
                    {activeFilterCount > 0 && (
                      <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center px-1">
                        {activeFilterCount}
                      </span>
                    )}
                  </button>
                </div>

                {/* Smart filter chips */}
                {allGarments.length > 5 && (
                  <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4 pb-1">
                    {([
                      { key: 'rarely_worn' as const, label: t('wardrobe.rarely_worn') },
                      { key: 'most_worn' as const, label: t('wardrobe.most_worn') },
                      { key: 'new' as const, label: t('wardrobe.recently_added') },
                    ]).map((chip) => (
                      <Chip
                        key={chip.key}
                        size="md"
                        selected={smartFilter === chip.key}
                        onClick={() => setSmartFilter(smartFilter === chip.key ? null : chip.key)}
                        className="whitespace-nowrap flex-shrink-0"
                      >
                        {chip.label}
                        {smartFilterCounts[chip.key] > 0 && (
                          <span className="text-[10px] font-medium bg-foreground/[0.06] px-1.5 py-px rounded-full">{smartFilterCounts[chip.key]}</span>
                        )}
                      </Chip>
                    ))}
                  </div>
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
                    description={hasActiveFilters || search ? t('wardrobe.try_other') : 'Scan or photograph your clothes to start building your digital wardrobe.'}
                    action={!hasActiveFilters && !search ? { label: t('wardrobe.add'), onClick: handleAddGarment, icon: Plus } : hasActiveFilters ? { label: 'Clear filters', onClick: clearFilters } : undefined}
                    variant={!hasActiveFilters && !search ? 'editorial' : 'default'}
                  />
                )}
              </div>
            ) : (
              <div>
                <WardrobeOutfitsTab />
              </div>
            )}
          </AnimatedTab>

          {/* FAB */}
          {activeTab === 'garments' ? (
            <CoachMark
              step={1}
              currentStep={coach.currentStep}
              isCoachActive={coach.isStepActive(1)}
              title="Add your first garment"
              body="Tap + to scan or upload. You need a top, bottom and shoes for your first outfit."
              ctaLabel="Got it"
              onCta={() => coach.advanceStep()}
              onSkip={() => coach.completeTour()}
              position="top"
            >
              <AddFAB
                onPhoto={handleAddGarment}
                onScan={() => navigate('/wardrobe/scan')}
                isOverLimit={isOverLimit}
              />
            </CoachMark>
          ) : (
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
