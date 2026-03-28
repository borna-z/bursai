import type { WardrobeSmartFilter } from '@/hooks/useWardrobeView';
import type {
  WardrobeCollectionTileModel,
  WardrobeCommandTopState,
  WardrobeInventoryState,
} from '@/components/wardrobe/wardrobeTypes';

type Translate = (key: string) => string;

function getResultsLabel({
  totalCount,
  displayCount,
  t,
}: {
  totalCount?: number;
  displayCount: number;
  t: Translate;
}) {
  if (!totalCount) {
    return t('wardrobe.add_first');
  }

  if (displayCount !== totalCount) {
    return `${displayCount} ${t('wardrobe.garments_count_label')}`;
  }

  return `${totalCount} ${t('wardrobe.garments_count_label')}`;
}

export function buildWardrobeCommandTopState({
  totalCount,
  displayCount,
  isSelecting,
  selectedIdsCount,
  hasActiveFilters,
  search,
  t,
}: {
  totalCount?: number;
  displayCount: number;
  isSelecting: boolean;
  selectedIdsCount: number;
  hasActiveFilters: boolean;
  search: string;
  t: Translate;
}): WardrobeCommandTopState {
  const garmentCount = totalCount ?? 0;
  const trimmedSearch = search.trim();

  let caption = 'Search, filter, and open garments directly from one calm workspace.';

  if (isSelecting) {
    caption = selectedIdsCount > 0
      ? `${selectedIdsCount} ${t('wardrobe.selected')}`
      : t('wardrobe.select');
  } else if (trimmedSearch) {
    caption = `${displayCount} result${displayCount === 1 ? '' : 's'}`;
  } else if (hasActiveFilters) {
    caption = `${displayCount} filtered piece${displayCount === 1 ? '' : 's'}`;
  } else if (garmentCount < 3) {
    caption = 'Add a few essentials and BURS can start styling around what you own.';
  }

  return {
    title: t('wardrobe.title'),
    caption,
    resultsLabel: getResultsLabel({ totalCount, displayCount, t }),
    searchPlaceholder: 'Search garments...',
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
  return [
    { key: 'rarely_worn', label: t('wardrobe.rarely_worn'), count: smartFilterCounts.rarely_worn, active: smartFilter === 'rarely_worn' },
    { key: 'most_worn', label: t('wardrobe.most_worn'), count: smartFilterCounts.most_worn, active: smartFilter === 'most_worn' },
    { key: 'new', label: t('wardrobe.recently_added'), count: smartFilterCounts.new, active: smartFilter === 'new' },
  ].filter((tile) => tile.count > 0);
}

export function buildWardrobeInventoryState({
  isLoading,
  isSelecting,
  selectedIdsCount,
  displayCount,
  hasActiveFilters,
  search,
}: {
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
      title: 'Loading wardrobe',
      description: 'Pulling in your latest pieces.',
    };
  }

  if (isSelecting) {
    return {
      kind: 'selecting',
      title: selectedIdsCount > 0 ? `${selectedIdsCount} selected` : 'Select pieces',
      description: 'Batch actions stay visible only while selection mode is on.',
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
    description: 'Tap a garment to open it, edit it, or style around it.',
  };
}
