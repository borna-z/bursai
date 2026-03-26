import { Grid3X3, List, Search, SlidersHorizontal, Trash2, WashingMachine, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Chip } from '@/components/ui/chip';
import { cn } from '@/lib/utils';
import type { WardrobeSmartFilter, WardrobeTab } from '@/hooks/useWardrobeView';

interface WardrobeToolbarProps {
  t: (key: string) => string;
  totalCount?: number;
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
  allGarmentsLength: number;
  smartFilter: WardrobeSmartFilter;
  onSmartFilterChange: (filter: WardrobeSmartFilter) => void;
  smartFilterCounts: Record<'rarely_worn' | 'most_worn' | 'new', number>;
  selectedIdsCount: number;
  onBulkLaundry: () => void;
  onBulkDelete: () => void;
}

export function WardrobeToolbar({
  t,
  totalCount,
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
  allGarmentsLength,
  smartFilter,
  onSmartFilterChange,
  smartFilterCounts,
  selectedIdsCount,
  onBulkLaundry,
  onBulkDelete,
}: WardrobeToolbarProps) {
  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('wardrobe.title')}</h1>
          {typeof totalCount === 'number' && totalCount > 0 && (
            <p className="label-editorial mt-0.5 text-muted-foreground/50">{totalCount} {t('wardrobe.garments_count_label').toUpperCase()}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={onToggleView}
            className="w-10 h-10 rounded-xl surface-inset flex items-center justify-center hover:bg-foreground/[0.05] transition-colors active:scale-95"
            aria-label={isGridView ? 'List view' : 'Grid view'}
          >
            {isGridView ? <List className="w-[18px] h-[18px] text-muted-foreground" /> : <Grid3X3 className="w-[18px] h-[18px] text-muted-foreground" />}
          </button>
          {!isSelecting ? (
            <button onClick={onStartSelecting} className="text-sm font-medium text-muted-foreground px-2.5 py-1.5 rounded-lg hover:bg-muted/40 transition-colors">{t('wardrobe.select')}</button>
          ) : (
            <button onClick={onCancelSelecting} className="text-sm font-medium text-primary px-2.5 py-1.5 rounded-lg hover:bg-muted/40 transition-colors">{t('common.cancel')}</button>
          )}
        </div>
      </div>

      <div className="flex border-b border-border/20">
        {(['garments', 'outfits'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => onTabChange(tab)}
            className={cn(
              "flex-1 py-2.5 font-['DM_Sans'] text-[13px] font-medium transition-colors duration-200",
              activeTab === tab
                ? 'text-foreground border-b border-foreground'
                : 'text-muted-foreground'
            )}
          >
            {t(`wardrobe.tab_${tab}`)}
          </button>
        ))}
      </div>

      {activeTab === 'garments' && (
        <div className="space-y-6">
          <div className="flex gap-2.5">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-muted-foreground/50 pointer-events-none" />
              <Input
                placeholder={`${t('wardrobe.search')} ${totalCount ?? ''} ${t('wardrobe.garments_count_label')}...`}
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-10 surface-inset border-border/10 h-11 rounded-xl text-[14px] placeholder:text-muted-foreground/40 shadow-none focus-within:ring-1 focus-within:ring-border/20"
              />
              {search && (
                <button onClick={onClearSearch} className="absolute right-3 top-1/2 -translate-y-1/2 active:scale-90 transition-transform">
                  <X className="w-4 h-4 text-muted-foreground/50" />
                </button>
              )}
            </div>
            <button
              onClick={onOpenFilterSheet}
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

          {allGarmentsLength > 5 && (
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
                  onClick={() => onSmartFilterChange(smartFilter === chip.key ? null : chip.key)}
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

          {isSelecting && selectedIdsCount > 0 && (
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-muted/30">
              <span className="text-[13px] font-medium">{selectedIdsCount} {t('wardrobe.selected')}</span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={onBulkLaundry} className="rounded-xl h-8 text-xs">
                  <WashingMachine className="w-3.5 h-3.5 mr-1" />{t('wardrobe.laundry')}
                </Button>
                <Button size="sm" variant="destructive" onClick={onBulkDelete} className="rounded-xl h-8 text-xs">
                  <Trash2 className="w-3.5 h-3.5 mr-1" />{t('wardrobe.remove')}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
