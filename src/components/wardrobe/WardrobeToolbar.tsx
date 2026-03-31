import { Search, SlidersHorizontal, Trash2, WashingMachine, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { WardrobeCommandTopState } from '@/components/wardrobe/wardrobeTypes';
import type { WardrobeTab } from '@/hooks/useWardrobeView';
import { hapticLight } from '@/lib/haptics';

const CATEGORY_CHIPS = [
  { id: 'all', labelKey: 'wardrobe.filter_all', fallback: 'All' },
  { id: 'top', labelKey: 'wardrobe.category_tops', fallback: 'Tops' },
  { id: 'bottom', labelKey: 'wardrobe.category_bottoms', fallback: 'Bottoms' },
  { id: 'shoes', labelKey: 'wardrobe.category_shoes', fallback: 'Shoes' },
  { id: 'outerwear', labelKey: 'wardrobe.category_outerwear', fallback: 'Outerwear' },
  { id: 'accessory', labelKey: 'wardrobe.category_accessories', fallback: 'Accessories' },
] as const;

interface WardrobeToolbarProps {
  t: (key: string) => string;
  commandState: WardrobeCommandTopState;
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
  selectedCategory?: string;
  onCategoryChange?: (category: string) => void;
}

export function WardrobeToolbar({
  t,
  commandState,
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
  selectedCategory,
  onCategoryChange,
}: WardrobeToolbarProps) {
  const showGarmentControls = activeTab === 'garments';

  return (
    <section className="space-y-2" aria-label="Wardrobe controls">
      <div className="flex items-center gap-2">
        <div className="inline-flex min-w-0 flex-1 rounded-full border border-border/45 bg-card/80 p-0.5">
          {(['garments', 'outfits'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => onTabChange(tab)}
              className={cn(
                'min-w-0 flex-1 rounded-full px-3.5 py-2 text-[13px] font-medium transition-colors cursor-pointer',
                activeTab === tab
                  ? 'bg-accent text-white'
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
              'shrink-0 rounded-full border border-border/45 px-3 py-2 text-[13px] font-medium transition-colors cursor-pointer',
              isSelecting
                ? 'border-foreground bg-foreground text-background'
                : 'bg-card/70 text-muted-foreground',
            )}
          >
            {isSelecting ? t('common.cancel') : t('wardrobe.select')}
          </button>
        )}
      </div>

      {showGarmentControls && (
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground/50" />
            <Input
              placeholder={commandState.searchPlaceholder || t('wardrobe.search_placeholder') || 'Search'}
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              className="h-10.5 rounded-[1rem] border-border/45 bg-background/78 pl-10 pr-10 text-[14px] shadow-none placeholder:text-muted-foreground/40"
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
              'relative flex h-10.5 w-10.5 shrink-0 items-center justify-center rounded-[1rem] border transition-colors cursor-pointer',
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

      {showGarmentControls && onCategoryChange && (
        <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-hide">
          {CATEGORY_CHIPS.map((chip) => {
            const isActive = (selectedCategory || 'all') === chip.id;
            const label = t(chip.labelKey) || chip.fallback;
            return (
              <button
                key={chip.id}
                onClick={() => { hapticLight(); onCategoryChange(chip.id); }}
                className={cn(
                  'shrink-0 rounded-full px-3.5 py-1.5 text-[12px] font-medium transition-colors cursor-pointer',
                  isActive
                    ? 'bg-accent text-white'
                    : 'border border-border/45 bg-card/60 text-foreground',
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      {isSelecting && selectedIdsCount > 0 && (
        <div className="surface-utility flex flex-wrap items-center justify-between gap-3 px-4 py-2.5">
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
