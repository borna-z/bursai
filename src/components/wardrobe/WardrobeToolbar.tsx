import type { ElementType } from 'react';
import { Camera, CalendarDays, Grid3X3, List, Plus, Search, SlidersHorizontal, Sparkles, Trash2, WashingMachine, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { WardrobeCommandActionKey, WardrobeCommandTopState, WardrobeInventoryState } from '@/components/wardrobe/wardrobeTypes';
import type { WardrobeTab } from '@/hooks/useWardrobeView';

const ACTION_ICONS = {
  style: Sparkles,
  add: Plus,
  scan: Camera,
  plan: CalendarDays,
} satisfies Record<WardrobeCommandActionKey, ElementType>;

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
}: WardrobeToolbarProps) {
  const showGarmentControls = activeTab === 'garments';
  const showInventoryMessage = isSelecting
    || activeTab === 'outfits'
    || hasActiveFilters
    || Boolean(search)
    || inventoryState.kind !== 'results';

  return (
    <section className="space-y-3.5" aria-label="Wardrobe command top">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="eyebrow-chip bg-background/80 text-muted-foreground/72">
              {activeTab === 'garments' ? 'Wardrobe' : 'Looks'}
            </span>
            {commandState.resultsLabel ? (
              <span className="eyebrow-chip border-transparent bg-secondary/75 text-foreground/58">
                {commandState.resultsLabel}
              </span>
            ) : null}
          </div>
          <h1 className="font-['Playfair_Display'] italic text-[1.95rem] tracking-[-0.05em] text-foreground">
            {commandState.title}
          </h1>
          <p className="max-w-[30ch] text-sm leading-relaxed text-muted-foreground">
            {commandState.caption}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {showGarmentControls && (
            <>
              <button
                onClick={onToggleView}
                className="flex h-10 w-10 items-center justify-center rounded-[1.1rem] border border-border/45 bg-background/80 text-muted-foreground transition-colors hover:bg-background"
                aria-label={isGridView ? 'List view' : 'Grid view'}
              >
                {isGridView ? <List className="h-[18px] w-[18px]" /> : <Grid3X3 className="h-[18px] w-[18px]" />}
              </button>
              <button
                onClick={isSelecting ? onCancelSelecting : onStartSelecting}
                className={cn(
                  'rounded-full px-3.5 py-2 text-sm font-medium transition-colors',
                  isSelecting
                    ? 'bg-foreground text-background'
                    : 'border border-border/45 bg-background/80 text-muted-foreground hover:bg-background',
                )}
              >
                {isSelecting ? t('common.cancel') : t('wardrobe.select')}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="inline-flex rounded-full border border-border/45 bg-card/80 p-1 shadow-[0_8px_20px_rgba(22,18,15,0.04)]">
        {(['garments', 'outfits'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => onTabChange(tab)}
            className={cn(
              'rounded-full px-4 py-2 text-[13px] font-medium transition-colors',
              activeTab === tab
                ? 'bg-foreground text-background'
                : 'text-muted-foreground',
            )}
          >
            {t(`wardrobe.tab_${tab}`)}
          </button>
        ))}
      </div>

      {showGarmentControls ? (
        <div className="flex gap-2.5">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground/50" />
            <Input
              placeholder={commandState.searchPlaceholder}
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              className="h-11 rounded-[1.1rem] border-border/45 bg-background/78 pl-10 pr-10 text-[14px] shadow-none placeholder:text-muted-foreground/40"
            />
            {search && (
              <button
                onClick={onClearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 transition-transform active:scale-90"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <button
            onClick={onOpenFilterSheet}
            className={cn(
              'relative flex h-11 w-11 items-center justify-center rounded-[1.1rem] border transition-colors',
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
      ) : (
        <div className="surface-utility px-4 py-3">
          <p className="text-sm text-muted-foreground">
            Build, save, and plan looks from one place.
          </p>
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {commandState.actions.map((action) => {
          const Icon = ACTION_ICONS[action.key];
          return (
            <button
              key={action.key}
              onClick={() => onAction(action.key)}
              className={cn(
                'flex h-10 shrink-0 items-center gap-2 rounded-full px-3.5 text-[13px] font-medium transition-colors',
                action.tone === 'primary' && 'bg-foreground text-background',
                action.tone === 'secondary' && 'border border-border/45 bg-background/80 text-foreground',
                action.tone === 'muted' && 'border border-border/35 bg-card/65 text-muted-foreground',
              )}
            >
              <Icon className="h-4 w-4" />
              {action.label}
            </button>
          );
        })}
      </div>

      {showInventoryMessage ? (
        <div className="surface-utility flex items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">{inventoryState.title}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{inventoryState.description}</p>
          </div>
          {showGarmentControls && (hasActiveFilters || search) && !isSelecting && (
            <button
              onClick={() => {
                onClearSearch();
                onClearFilters();
              }}
              className="shrink-0 text-xs font-medium text-muted-foreground underline underline-offset-4"
            >
              Clear
            </button>
          )}
        </div>
      ) : null}

      {isSelecting && selectedIdsCount > 0 && (
        <div className="surface-utility flex flex-wrap items-center justify-between gap-3 px-4 py-3">
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
      )}
    </section>
  );
}
