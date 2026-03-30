import type { ElementType } from 'react';
import { CalendarDays, ChevronDown, Search, SlidersHorizontal, Sparkles, Trash2, WashingMachine, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { WardrobeCommandActionKey, WardrobeCommandTopState, WardrobeInventoryState } from '@/components/wardrobe/wardrobeTypes';
import type { WardrobeTab } from '@/hooks/useWardrobeView';
import { hapticLight } from '@/lib/haptics';

const ACTION_ICONS = {
  style: Sparkles,
  plan: CalendarDays,
} satisfies Record<WardrobeCommandActionKey, ElementType>;

const CATEGORY_CHIPS = ['all', 'tops', 'bottoms', 'shoes', 'outerwear', 'accessories'] as const;

interface WardrobeToolbarProps {
  t: (key: string) => string;
  commandState: WardrobeCommandTopState;
  inventoryState: WardrobeInventoryState;
  isGridView: boolean;
  onToggleView: () => void;
  isSelecting: boolean;
  onStartSelecting: () => void;
  onCancelSelecting: () => void;
  activeTab: WardrobeTab;
  onTabChange: (tab: WardrobeTab) => void;
  search: string;
  onSearchChange: (value: string) => void;
  onClearSearch: () => void;
  onOpenFilterSheet: () => void;
  hasActiveFilters: boolean;
  activeFilterCount: number;
  selectedIdsCount: number;
  onBulkLaundry: () => void;
  onBulkDelete: () => void;
  onAction: (action: WardrobeCommandActionKey) => void;
  onClearFilters: () => void;
  selectedCategory?: string;
  onCategoryChange?: (category: string) => void;
  totalCount?: number;
  sortBy?: string;
}

export function WardrobeToolbar({
  t,
  commandState,
  inventoryState,
  isGridView,
  onToggleView,
  isSelecting,
  onStartSelecting,
  onCancelSelecting,
  activeTab,
  onTabChange,
  search,
  onSearchChange,
  onClearSearch,
  onOpenFilterSheet,
  hasActiveFilters,
  activeFilterCount,
  selectedIdsCount,
  onBulkLaundry,
  onBulkDelete,
  onAction,
  onClearFilters,
  selectedCategory,
  onCategoryChange,
  totalCount,
  sortBy,
}: WardrobeToolbarProps) {
  const showGarmentControls = activeTab === 'garments';

  return (
    <section className="space-y-3" aria-label="Wardrobe controls">
      {/* Tab switcher */}
      <div className="flex items-center justify-between gap-3">
        <div className="inline-flex rounded-full border border-border/45 bg-card/80 p-1">
          {(['garments', 'outfits'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => onTabChange(tab)}
              className={cn(
                'rounded-full px-4 py-2 text-[13px] font-medium transition-colors cursor-pointer',
                activeTab === tab
                  ? 'bg-foreground text-background'
                  : 'text-muted-foreground',
              )}
            >
              {t(`wardrobe.tab_${tab}`)}
            </button>
          ))}
        </div>

        {showGarmentControls && (
          <button
            onClick={isSelecting ? onCancelSelecting : onStartSelecting}
            className={cn(
              'rounded-full px-3.5 py-2 text-[13px] font-medium transition-colors cursor-pointer',
              isSelecting
                ? 'bg-foreground text-background'
                : 'text-muted-foreground',
            )}
          >
            {isSelecting ? t('common.cancel') : t('wardrobe.select')}
          </button>
        )}
      </div>

      {/* Search + Filter row */}
      {showGarmentControls && (
        <div className="flex gap-2.5">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground/50" />
            <Input
              placeholder={commandState.searchPlaceholder || t('wardrobe.search_placeholder') || 'Search'}
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              className="h-11 rounded-[1.1rem] border-border/45 bg-background/78 pl-10 pr-10 text-[14px] shadow-none placeholder:text-muted-foreground/40"
            />
            {search && (
              <button
                onClick={onClearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 transition-transform active:scale-90 cursor-pointer"
                aria-label={t('wardrobe.clear_search')}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <button
            onClick={onOpenFilterSheet}
            className={cn(
              'relative flex h-11 w-11 shrink-0 items-center justify-center rounded-[1.1rem] border transition-colors cursor-pointer',
              hasActiveFilters
                ? 'border-foreground bg-foreground text-background'
                : 'border-border/45 bg-background/80 text-muted-foreground hover:bg-background',
            )}
            aria-label={t('wardrobe.filter')}
          >
            <SlidersHorizontal className="h-4 w-4" />
            {activeFilterCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-background px-1 text-[10px] font-bold text-foreground">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
      )}

      {/* Category chips */}
      {showGarmentControls && onCategoryChange && (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {CATEGORY_CHIPS.map((chip) => {
            const isActive = (selectedCategory || 'all') === chip;
            const label = chip === 'all' ? t('wardrobe.filter_all') || 'All' : t(`wardrobe.category_${chip}`) || chip.charAt(0).toUpperCase() + chip.slice(1);
            return (
              <button
                key={chip}
                onClick={() => { hapticLight(); onCategoryChange(chip === 'all' ? 'all' : chip); }}
                className={cn(
                  'shrink-0 rounded-full px-4 py-2 text-[12px] font-medium transition-colors cursor-pointer',
                  isActive
                    ? 'bg-foreground text-background'
                    : 'border border-border/45 bg-card/60 text-foreground',
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      {/* Count + Sort row */}
      {showGarmentControls && !isSelecting && (
        <div className="flex items-center justify-between px-0.5">
          <span className="text-[14px] font-medium text-muted-foreground">
            {totalCount !== undefined
              ? t('wardrobe.pieces_count')?.replace('{count}', String(totalCount)) || `${totalCount} pieces`
              : commandState.resultsLabel}
          </span>
          <button
            onClick={onOpenFilterSheet}
            className="flex items-center gap-1 text-[12px] font-medium text-accent cursor-pointer"
          >
            {t('wardrobe.sort_recent') || 'Recently Added'}
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Outfits tab caption */}
      {activeTab === 'outfits' && (
        <div className="surface-utility px-4 py-3">
          <p className="text-sm text-muted-foreground">
            {t('wardrobe.outfits_caption')}
          </p>
        </div>
      )}

      {/* Bulk selection bar */}
      {isSelecting && selectedIdsCount > 0 && (
        <div className="surface-utility flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <span className="text-sm font-medium text-foreground">
            {selectedIdsCount} {t('wardrobe.selected')}
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={onBulkLaundry} className="h-11 rounded-full border-border/20 bg-background px-3.5 text-[13px]">
              <WashingMachine className="mr-1.5 h-3.5 w-3.5" />
              {t('wardrobe.laundry')}
            </Button>
            <Button size="sm" variant="destructive" onClick={onBulkDelete} className="h-11 rounded-full px-3.5 text-[13px]">
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              {t('wardrobe.remove')}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
