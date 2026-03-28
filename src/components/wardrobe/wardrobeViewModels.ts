import type { WardrobeSmartFilter, WardrobeTab } from '@/hooks/useWardrobeView';
import type {
  WardrobeCollectionTileModel,
  WardrobeCommandActionModel,
  WardrobeCommandTopState,
  WardrobeInventoryState,
} from '@/components/wardrobe/wardrobeTypes';

type Translate = (key: string) => string;

function getResultsLabel({
  activeTab,
  totalCount,
  displayCount,
  t,
}: {
  activeTab: WardrobeTab;
  totalCount?: number;
  displayCount: number;
  t: Translate;
}) {
  if (activeTab === 'outfits') {
    return t('wardrobe.tab_outfits');
  }

  if (!totalCount) {
    return t('wardrobe.add_first');
  }

  if (displayCount !== totalCount) {
    return `${displayCount} ${t('wardrobe.garments_count_label')}`;
  }

  return `${totalCount} ${t('wardrobe.garments_count_label')}`;
}

export function buildWardrobeCommandTopState({
  activeTab,
  totalCount,
  displayCount,
  isSelecting,
  selectedIdsCount,
  hasActiveFilters,
  search,
  t,
}: {
  activeTab: WardrobeTab;
  totalCount?: number;
  displayCount: number;
  isSelecting: boolean;
  selectedIdsCount: number;
  hasActiveFilters: boolean;
  search: string;
  t: Translate;
}): WardrobeCommandTopState {
  const garmentCount = totalCount ?? 0;
  const isLowWardrobe = garmentCount < 3;
  const trimmedSearch = search.trim();

  let caption = activeTab === 'garments'
    ? 'Search, filter, and open what you own.'
    : 'Saved and planned looks stay together.';

  if (isSelecting) {
    caption = selectedIdsCount > 0
      ? `${selectedIdsCount} ${t('wardrobe.selected')}`
      : t('wardrobe.select');
  } else if (activeTab === 'garments' && trimmedSearch) {
    caption = `${displayCount} result${displayCount === 1 ? '' : 's'}`;
  } else if (activeTab === 'garments' && hasActiveFilters) {
    caption = `${displayCount} filtered piece${displayCount === 1 ? '' : 's'}`;
  } else if (activeTab === 'garments' && isLowWardrobe) {
    caption = 'Add a top, bottom, and shoes to unlock styling.';
  }

  const actions: WardrobeCommandActionModel[] = activeTab === 'outfits'
    ? [
        { key: 'style', label: t('outfits.create'), tone: 'primary' as const },
        { key: 'plan', label: t('plan.plan'), tone: 'secondary' as const },
        { key: 'add', label: t('wardrobe.add'), tone: 'muted' as const },
        { key: 'scan', label: t('wardrobe.live_scan'), tone: 'muted' as const },
      ]
    : isLowWardrobe
      ? [
          { key: 'add', label: t('wardrobe.add'), tone: 'primary' as const },
          { key: 'scan', label: t('wardrobe.live_scan'), tone: 'secondary' as const },
          { key: 'style', label: t('outfits.create'), tone: 'muted' as const },
          { key: 'plan', label: t('plan.plan'), tone: 'muted' as const },
        ]
      : [
          { key: 'style', label: t('outfits.create'), tone: 'primary' as const },
          { key: 'plan', label: t('plan.plan'), tone: 'secondary' as const },
          { key: 'add', label: t('wardrobe.add'), tone: 'muted' as const },
          { key: 'scan', label: t('wardrobe.live_scan'), tone: 'muted' as const },
        ];

  return {
    title: t('wardrobe.title'),
    caption,
    activeTab,
    resultsLabel: getResultsLabel({ activeTab, totalCount, displayCount, t }),
    searchPlaceholder: 'Search garments...',
    actions,
  };
}

export function buildWardrobeCollectionTiles({
  smartFilter,
  smartFilterCounts,
  t,
}: {
  smartFilter: WardrobeSmartFilter;
  smartFilterCounts: Record<'rarely_worn' | 'most_worn' | 'new', number>;
  t: Translate;
}): WardrobeCollectionTileModel[] {
  const tiles: WardrobeCollectionTileModel[] = [
    { key: 'rarely_worn', label: t('wardrobe.rarely_worn'), count: smartFilterCounts.rarely_worn, active: smartFilter === 'rarely_worn' },
    { key: 'most_worn', label: t('wardrobe.most_worn'), count: smartFilterCounts.most_worn, active: smartFilter === 'most_worn' },
    { key: 'new', label: t('wardrobe.recently_added'), count: smartFilterCounts.new, active: smartFilter === 'new' },
  ];

  return tiles.filter((tile) => tile.count > 0);
}

export function buildWardrobeInventoryState({
  activeTab,
  isLoading,
  isSelecting,
  selectedIdsCount,
  displayCount,
  hasActiveFilters,
  search,
}: {
  activeTab: WardrobeTab;
  isLoading: boolean;
  isSelecting: boolean;
  selectedIdsCount: number;
  displayCount: number;
  hasActiveFilters: boolean;
  search: string;
}): WardrobeInventoryState {
  if (isLoading) {
    return {
      kind: 'loading',
      title: activeTab === 'outfits' ? 'Loading looks' : 'Loading wardrobe',
      description: activeTab === 'outfits' ? 'Pulling in your saved and planned outfits.' : 'Pulling in your latest pieces.',
    };
  }

  if (isSelecting) {
    return {
      kind: 'selecting',
      title: selectedIdsCount > 0 ? `${selectedIdsCount} selected` : 'Select pieces',
      description: 'Batch actions stay above the list.',
    };
  }

  if (activeTab === 'outfits') {
    return {
      kind: 'results',
      title: 'Look archive',
      description: 'Saved and planned looks stay together here.',
    };
  }

  if (displayCount === 0 && (hasActiveFilters || search.trim().length > 0)) {
    return {
      kind: 'filtered-empty',
      title: 'No matching pieces',
      description: 'Clear filters or search less specifically.',
    };
  }

  if (displayCount === 0) {
    return {
      kind: 'empty',
      title: 'Start with your core pieces',
      description: 'Add garments first, then style and plan from the same workspace.',
    };
  }

  return {
    kind: 'results',
    title: `${displayCount} piece${displayCount === 1 ? '' : 's'} ready`,
    description: 'Tap a piece to open it.',
  };
}
