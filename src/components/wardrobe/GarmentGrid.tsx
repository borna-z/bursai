import { useVirtualizer } from '@tanstack/react-virtual';
import { motion } from 'framer-motion';
import { EASE_CURVE, STAGGER_DELAY, DISTANCE, DURATION_MEDIUM, PRESETS } from '@/lib/motion';
import { useEffect, useRef, Fragment, type MouseEvent, type RefObject } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Shirt, Sparkles } from 'lucide-react';
import { SwipeableGarmentCard } from '@/components/wardrobe/SwipeableGarmentCard';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { GarmentGridSkeleton } from '@/components/ui/skeletons';
import { type Garment } from '@/hooks/useGarments';
import { EmptyState } from '@/components/layout/EmptyState';
import { WardrobeOnboardingEmpty } from '@/components/onboarding/OnboardingEmptyState';
import { LazyImageSimple } from '@/components/ui/lazy-image';
import { categoryLabel, colorLabel } from '@/lib/humanize';
import { getPreferredGarmentImagePath } from '@/lib/garmentImage';
import { GarmentProcessingBadge } from '@/components/wardrobe/GarmentProcessingBadge';
import { RenderPendingOverlay } from '@/components/wardrobe/RenderPendingOverlay';

const CATEGORY_ORDER = ['dress', 'top', 'bottom', 'outerwear', 'shoes', 'accessory'];
const VIRTUALIZE_THRESHOLD = 30;
const GRID_ROW_HEIGHT = 180;
const LIST_ROW_HEIGHT = 74;
const GAP = 6;

const cardReveal = {
  hidden: { opacity: 0, y: DISTANCE.md },
  visible: { opacity: 1, y: 0 },
};

function CategorySection({ category, count, t }: { category: string; count: number; t: (key: string) => string }) {
  return (
    <div className="flex justify-between items-center pt-4 pb-1.5">
      <span className="font-['DM_Sans'] text-[9px] tracking-[0.1em] uppercase text-foreground/40">
        {categoryLabel(t, category)}
      </span>
      <span className="font-['DM_Sans'] text-[9px] tracking-[0.1em] text-foreground/40">
        {count}
      </span>
    </div>
  );
}

interface GarmentCardProps {
  garment: Garment;
  t: (key: string) => string;
  isGridView: boolean;
  isSelecting: boolean;
  isSelected: boolean;
  onSelect: () => void;
  index?: number;
}

function GarmentCard({ garment, t, isGridView, isSelecting, isSelected, onSelect, index = 0 }: GarmentCardProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (isSelecting) {
      onSelect();
    } else {
      navigate(`/wardrobe/${garment.id}`);
    }
  };

  const handleStyleAround = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    navigate('/ai/chat', { state: { selectedGarmentId: garment.id } });
  };

  const displayImagePath = getPreferredGarmentImagePath(garment);

  const categoryColorMap: Record<string, string> = {
    top: 'hsl(var(--accent) / 0.6)',
    bottom: 'hsl(var(--muted-foreground) / 0.5)',
    shoes: 'hsl(var(--accent) / 0.45)',
    outerwear: 'hsl(var(--muted-foreground) / 0.4)',
    accessory: 'hsl(var(--accent) / 0.5)',
    dress: 'hsl(var(--muted-foreground) / 0.45)',
  };
  const categoryStripColor = categoryColorMap[garment.category] || 'hsl(var(--foreground) / 0.12)';

  if (!isGridView) {
    return (
      <motion.div
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            handleClick();
          }
        }}
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
        <div className="relative w-16 h-16 shrink-0 overflow-hidden">
          <LazyImageSimple
            imagePath={displayImagePath}
            alt={garment.title}
            className="w-16 h-16 shrink-0"
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

  return (
    <motion.div
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          handleClick();
        }
      }}
      variants={cardReveal}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-20px' }}
      transition={{ ease: EASE_CURVE, duration: DURATION_MEDIUM, delay: (index % 6) * STAGGER_DELAY }}
      whileTap={PRESETS.PRESS.whileTap}
      onClick={handleClick}
      className={cn(
        'w-full overflow-hidden transition-colors text-left will-change-transform relative group',
        garment.in_laundry && 'opacity-60',
        isSelected && 'ring-2 ring-accent'
      )}
      style={{ borderLeft: `2px solid ${categoryStripColor}` }}
    >
      <div className="aspect-[3/4] bg-muted relative overflow-hidden">
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
        <span className={cn(
          'absolute top-1.5 right-1.5 font-[\'DM_Sans\'] text-[9px] font-medium px-1.5 py-0.5 rounded-none leading-[1.4] tracking-[0.02em]',
          (garment.wear_count || 0) === 0
            ? 'bg-card text-foreground/45'
            : 'bg-foreground text-background'
        )}>
          {(garment.wear_count || 0) > 0 ? `${garment.wear_count}×` : '0×'}
        </span>
        <div className="absolute bottom-0 left-0 right-0 bg-foreground/[0.38] px-[7px] py-[5px] z-[2]">
          <div className="font-['DM_Sans'] text-[10px] font-medium text-background truncate">
            {garment.title}
          </div>
          <div className="font-['DM_Sans'] text-[8px] text-background/55 mt-px">
            {categoryLabel(t, garment.category)}
          </div>
        </div>
      </div>
    </motion.div>
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

interface VirtualizedGarmentListProps {
  t: (key: string) => string;
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

function VirtualGarmentGrid({
  t,
  garments,
  isGridView,
  isSelecting,
  selectedIds,
  onSelect,
  onEdit,
  onLaundry,
  onDelete,
  isFetchingNextPage,
  sentinelRef,
}: Omit<VirtualizedGarmentListProps, 'onLoadMore' | 'hasNextPage'> & { sentinelRef: RefObject<HTMLDivElement | null> }) {
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
                      <SwipeableGarmentCard
                        garment={garment}
                        onEdit={() => onEdit(garment.id)}
                        onLaundry={() => onLaundry(garment)}
                        onDelete={() => onDelete(garment.id)}
                      />
                    ) : (
                      <GarmentCard
                        garment={garment}
                        t={t}
                        isGridView={isGridView}
                        isSelecting={isSelecting}
                        isSelected={selectedIds.has(garment.id)}
                        onSelect={() => onSelect(garment.id)}
                        index={startIdx + colIdx}
                      />
                    )}
                  </Fragment>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <div ref={sentinelRef as RefObject<HTMLDivElement>} className="h-1" />
      {isFetchingNextPage && <LoadingSkeletons isGridView={isGridView} />}
    </div>
  );
}

function GarmentListContent({
  t,
  garments,
  isGridView,
  isSelecting,
  selectedIds,
  onSelect,
  onEdit,
  onLaundry,
  onDelete,
  onLoadMore,
  hasNextPage,
  isFetchingNextPage,
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
        t={t}
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
                t={t}
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

interface GarmentGridProps {
  t: (key: string) => string;
  isLoading: boolean;
  isGridView: boolean;
  isSelecting: boolean;
  selectedIds: Set<string>;
  displayGarments: Garment[];
  showGrouped: boolean;
  garmentsByCategory: Record<string, Garment[]>;
  hasActiveFilters: boolean;
  search: string;
  onSelect: (id: string) => void;
  onEdit: (id: string) => void;
  onLaundry: (garment: Garment) => void;
  onDelete: (id: string) => void;
  onLoadMore: () => void;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onClearFilters: () => void;
}

export function GarmentGrid({
  t,
  isLoading,
  isGridView,
  isSelecting,
  selectedIds,
  displayGarments,
  showGrouped,
  garmentsByCategory,
  hasActiveFilters,
  search,
  onSelect,
  onEdit,
  onLaundry,
  onDelete,
  onLoadMore,
  hasNextPage,
  isFetchingNextPage,
  onClearFilters,
}: GarmentGridProps) {
  if (isLoading) {
    return <GarmentGridSkeleton count={6} grid={isGridView} />;
  }

  if (displayGarments.length > 0) {
    if (showGrouped) {
      return (
        <div className="space-y-2">
          {CATEGORY_ORDER.filter(cat => garmentsByCategory[cat]?.length > 0).map(cat => (
            <div key={cat}>
              <CategorySection category={cat} count={garmentsByCategory[cat].length} t={t} />
              <div className={cn(isGridView ? 'grid grid-cols-3 gap-[5px]' : 'flex flex-col gap-1')}>
                {garmentsByCategory[cat].map((garment, idx) => (
                  <div key={garment.id} className="animate-drape-in" style={{ animationDelay: `${Math.min(idx, 12) * 40}ms`, animationFillMode: 'both' }}>
                    <GarmentCard
                      garment={garment}
                      t={t}
                      isGridView={isGridView}
                      isSelecting={isSelecting}
                      isSelected={selectedIds.has(garment.id)}
                      onSelect={() => onSelect(garment.id)}
                      index={idx}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      );
    }

    return (
      <GarmentListContent
        t={t}
        garments={displayGarments}
        isGridView={isGridView}
        isSelecting={isSelecting}
        selectedIds={selectedIds}
        onSelect={onSelect}
        onEdit={onEdit}
        onLaundry={onLaundry}
        onDelete={onDelete}
        onLoadMore={onLoadMore}
        hasNextPage={hasNextPage}
        isFetchingNextPage={isFetchingNextPage}
      />
    );
  }

  if (hasActiveFilters || search) {
    return (
      <EmptyState
        icon={Search}
        title={t('wardrobe.no_results')}
        description={t('wardrobe.try_other')}
        action={hasActiveFilters ? { label: 'Clear filters', onClick: onClearFilters } : undefined}
        compact
      />
    );
  }

  return <WardrobeOnboardingEmpty />;
}
