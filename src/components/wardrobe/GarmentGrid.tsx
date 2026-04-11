import { useVirtualizer } from '@tanstack/react-virtual';
import { useEffect, useRef, Fragment, type MouseEvent, type RefObject } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { SwipeableGarmentCard } from '@/components/wardrobe/SwipeableGarmentCard';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { GarmentGridSkeleton } from '@/components/ui/skeletons';
import { type Garment } from '@/hooks/useGarments';
import { EmptyState } from '@/components/layout/EmptyState';
import { WardrobeOnboardingEmpty } from '@/components/onboarding/OnboardingEmptyState';
import { categoryLabel } from '@/lib/humanize';
import { buildStyleAroundState, buildStyleFlowSearch } from '@/lib/styleFlowState';
import {
  WardrobeGarmentGridLayout,
  WardrobeGarmentListLayout,
  WARDROBE_GRID_ROW_HEIGHT,
  WARDROBE_LIST_ROW_HEIGHT,
} from '@/components/wardrobe/GarmentCardSystem';

const CATEGORY_ORDER = ['dress', 'top', 'bottom', 'outerwear', 'shoes', 'accessory'];
const VIRTUALIZE_THRESHOLD = 30;
const GAP = 6;

function CategorySection({ category, count, t }: { category: string; count: number; t: (key: string) => string }) {
  return (
    <div className="flex items-center justify-between pb-2 pt-4">
      <span className="font-body text-[9px] uppercase tracking-[0.12em] text-foreground/40">
        {categoryLabel(t, category)}
      </span>
      <span className="font-body text-[9px] tracking-[0.12em] text-foreground/40">
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
}

function GarmentCard({ garment, t, isGridView, isSelecting, isSelected, onSelect }: GarmentCardProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (isSelecting) {
      onSelect();
      return;
    }

    navigate(`/wardrobe/${garment.id}`);
  };

  const handleStyleAround = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    navigate(`/ai/chat${buildStyleFlowSearch(garment.id)}`, { state: buildStyleAroundState(garment.id) });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="w-full text-left"
    >
      {isGridView ? (
        <WardrobeGarmentGridLayout
          garment={garment}
          t={t}
          isSelecting={isSelecting}
          isSelected={isSelected}
        />
      ) : (
        <WardrobeGarmentListLayout
          garment={garment}
          t={t}
          isSelecting={isSelecting}
          isSelected={isSelected}
          onStyleAround={!isSelecting ? handleStyleAround : undefined}
        />
      )}
    </button>
  );
}

function LoadingSkeletons({ isGridView }: { isGridView: boolean }) {
  return isGridView ? (
    <div className="grid grid-cols-3 gap-[5px]">
      {[1, 2].map((index) => (
        <Skeleton key={index} className="aspect-[3/4] w-full rounded-[24px]" />
      ))}
    </div>
  ) : (
    <div className="flex flex-col gap-2">
      {[1, 2].map((index) => (
        <Skeleton key={index} className="h-[158px] w-full rounded-[26px]" />
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
  const cols = isGridView ? 3 : 1;
  const rowCount = Math.ceil(garments.length / cols);
  const estimateSize = isGridView ? WARDROBE_GRID_ROW_HEIGHT : WARDROBE_LIST_ROW_HEIGHT;

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => document.querySelector('main#main-content') as HTMLElement | null,
    estimateSize: () => estimateSize + GAP,
    overscan: 5,
    scrollingDelay: 150,
  });

  return (
    <div className="w-full overflow-visible">
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative', width: '100%' }}>
        {virtualizer.getVirtualItems().map((virtualRow) => {
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
              <div className={cn(isGridView ? 'grid grid-cols-3 gap-[5px] h-full' : 'flex flex-col gap-2')}>
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
    const element = sentinelRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          onLoadMore();
        }
      },
      { rootMargin: '200px' }
    );

    observer.observe(element);
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
      <div className={cn(isGridView ? 'grid grid-cols-3 gap-[5px]' : 'flex flex-col gap-2')}>
        {garments.map((garment) => (
          <div
            key={garment.id}
            style={{
              contentVisibility: 'auto',
              containIntrinsicSize: isGridView ? `auto ${WARDROBE_GRID_ROW_HEIGHT}px` : `auto ${WARDROBE_LIST_ROW_HEIGHT}px`,
            }}
          >
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
          {CATEGORY_ORDER.filter((category) => garmentsByCategory[category]?.length > 0).map((category) => (
            <div key={category}>
              <CategorySection category={category} count={garmentsByCategory[category].length} t={t} />
              <div className={cn(isGridView ? 'grid grid-cols-3 gap-[5px]' : 'flex flex-col gap-2')}>
                {garmentsByCategory[category].map((garment) => (
                  <div key={garment.id}>
                    <GarmentCard
                      garment={garment}
                      t={t}
                      isGridView={isGridView}
                      isSelecting={isSelecting}
                      isSelected={selectedIds.has(garment.id)}
                      onSelect={() => onSelect(garment.id)}
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
        action={hasActiveFilters ? { label: t('wardrobe.clear_filters'), onClick: onClearFilters } : undefined}
        compact
        variant="editorial"
      />
    );
  }

  return <WardrobeOnboardingEmpty />;
}
