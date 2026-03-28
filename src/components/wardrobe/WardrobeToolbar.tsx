import { Grid3X3, List, Plus, Search, SlidersHorizontal, Trash2, WashingMachine, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { WardrobeCommandTopState, WardrobeInventoryState } from '@/components/wardrobe/wardrobeTypes';

interface WardrobeToolbarProps {
  t: (key: string) => string;
  commandState: WardrobeCommandTopState;
  inventoryState: WardrobeInventoryState;
  isGridView: boolean;
  onToggleView: () => void;
  isSelecting: boolean;
  onStartSelecting: () => void;
  onCancelSelecting: () => void;
  search: string;
  onSearchChange: (value: string) => void;
  onClearSearch: () => void;
  onOpenFilterSheet: () => void;
  hasActiveFilters: boolean;
  activeFilterCount: number;
  selectedIdsCount: number;
  onBulkLaundry: () => void;
  onBulkDelete: () => void;
  onClearFilters: () => void;
  onAddGarment: () => void;
  onOpenOutfits: () => void;
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
  search,
  onSearchChange,
  onClearSearch,
  onOpenFilterSheet,
  hasActiveFilters,
  activeFilterCount,
  selectedIdsCount,
  onBulkLaundry,
  onBulkDelete,
  onClearFilters,
  onAddGarment,
  onOpenOutfits,
}: WardrobeToolbarProps) {
  return (
    <section className="space-y-4" aria-label="Wardrobe command top">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="eyebrow-chip bg-background/80 text-muted-foreground/72">
              Wardrobe
            </span>
            <span className="eyebrow-chip border-transparent bg-secondary/85 text-foreground/58">
              {commandState.resultsLabel}
            </span>
          </div>
          <div className="space-y-1">
            <h1 className="text-[1.75rem] font-semibold tracking-[-0.045em] text-foreground">
              {commandState.title}
            </h1>
            <p className="max-w-[34ch] text-sm leading-relaxed text-muted-foreground">
              {commandState.caption}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button variant="quiet" className="rounded-full px-3 text-[0.8rem]" onClick={onOpenOutfits}>
            Open outfits
          </Button>
          <Button className="rounded-full px-4" onClick={onAddGarment}>
            <Plus className="size-4" />
            {t('wardrobe.add')}
          </Button>
        </div>
      </div>

      <div className="grid gap-2.5 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground/50" />
          <Input
            placeholder={commandState.searchPlaceholder}
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            className="h-12 rounded-[1.25rem] border-border/45 bg-background/80 pl-10 pr-10 text-[14px] shadow-none placeholder:text-muted-foreground/40"
          />
          {search ? (
            <button
              type="button"
              onClick={onClearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 transition-transform active:scale-90"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        <button
          type="button"
          onClick={onOpenFilterSheet}
          className={cn(
            'relative flex h-12 min-w-[3rem] items-center justify-center rounded-[1.25rem] border transition-colors',
            hasActiveFilters
              ? 'border-foreground bg-foreground text-background'
              : 'border-border/45 bg-background/80 text-muted-foreground hover:bg-background',
          )}
          aria-label={t('wardrobe.filter')}
        >
          <SlidersHorizontal className="h-4 w-4" />
          {activeFilterCount > 0 ? (
            <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-background px-1 text-[10px] font-bold text-foreground">
              {activeFilterCount}
            </span>
          ) : null}
        </button>

        <button
          type="button"
          onClick={onToggleView}
          className="flex h-12 min-w-[3rem] items-center justify-center rounded-[1.25rem] border border-border/45 bg-background/80 text-muted-foreground transition-colors hover:bg-background"
          aria-label={isGridView ? 'List view' : 'Grid view'}
        >
          {isGridView ? <List className="h-[18px] w-[18px]" /> : <Grid3X3 className="h-[18px] w-[18px]" />}
        </button>
      </div>

      <div className="surface-utility flex items-center justify-between gap-3 rounded-[1.4rem] px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{inventoryState.title}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{inventoryState.description}</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {(hasActiveFilters || search) && !isSelecting ? (
            <button
              type="button"
              onClick={() => {
                onClearSearch();
                onClearFilters();
              }}
              className="text-xs font-medium text-muted-foreground underline underline-offset-4"
            >
              Clear
            </button>
          ) : null}
          <button
            type="button"
            onClick={isSelecting ? onCancelSelecting : onStartSelecting}
            className={cn(
              'rounded-full px-4 py-2.5 text-sm font-medium transition-colors',
              isSelecting
                ? 'bg-foreground text-background'
                : 'border border-border/45 bg-background/80 text-muted-foreground hover:bg-background',
            )}
          >
            {isSelecting ? t('common.cancel') : t('wardrobe.select')}
          </button>
        </div>
      </div>

      {isSelecting && selectedIdsCount > 0 ? (
        <div className="surface-editorial flex flex-wrap items-center justify-between gap-3 rounded-[1.5rem] px-4 py-3">
          <span className="text-sm font-medium text-foreground">
            {selectedIdsCount} {t('wardrobe.selected')}
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={onBulkLaundry} className="h-9 rounded-full border-border/20 bg-background px-3.5 text-xs">
              <WashingMachine className="mr-1.5 h-3.5 w-3.5" />
              {t('wardrobe.laundry')}
            </Button>
            <Button size="sm" variant="destructive" onClick={onBulkDelete} className="h-9 rounded-full px-3.5 text-xs">
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              {t('wardrobe.remove')}
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
