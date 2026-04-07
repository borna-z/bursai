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
    ? t('wardrobe.search_caption')
    : t('wardrobe.outfits_caption');

  if (isSelecting) {
    caption = selectedIdsCount > 0
      ? `${selectedIdsCount} ${t('wardrobe.selected')}`
      : t('wardrobe.select');
  } else if (activeTab === 'garments' && trimmedSearch) {
    caption = t('wardrobe.search_results').replace('{count}', String(displayCount));
  } else if (activeTab === 'garments' && hasActiveFilters) {
    caption = t('wardrobe.filtered_count').replace('{count}', String(displayCount));
  } else if (activeTab === 'garments' && isLowWardrobe) {
    caption = t('wardrobe.low_wardrobe_hint');
  }

  const actions: WardrobeCommandActionModel[] = [
    { key: 'style', label: t('outfits.create'), tone: 'primary' as const },
    { key: 'plan', label: t('plan.plan'), tone: 'secondary' as const },
  ];

  return {
    title: t('wardrobe.title'),
    caption,
    activeTab,
    resultsLabel: getResultsLabel({ activeTab, totalCount, displayCount, t }),
    searchPlaceholder: t('wardrobe.search') || 'Search…',
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
  t,
}: {
  activeTab: WardrobeTab;
  isLoading: boolean;
  isSelecting: boolean;
  selectedIdsCount: number;
  displayCount: number;
  hasActiveFilters: boolean;
  search: string;
  t: (key: string) => string;
}): WardrobeInventoryState {
  if (isLoading) {
    return {
      kind: 'loading',
      title: activeTab === 'outfits' ? t('wardrobe.loading_looks') : t('wardrobe.loading_wardrobe'),
      description: activeTab === 'outfits' ? t('wardrobe.loading_looks_desc') : t('wardrobe.loading_wardrobe_desc'),
    };
  }

  if (isSelecting) {
    return {
      kind: 'selecting',
      title: selectedIdsCount > 0 ? t('wardrobe.items_selected').replace('{count}', String(selectedIdsCount)) : t('wardrobe.select_pieces'),
      description: t('wardrobe.batch_hint'),
    };
  }

  if (activeTab === 'outfits') {
    return {
      kind: 'results',
      title: t('wardrobe.look_archive'),
      description: t('wardrobe.outfits_storage_hint'),
    };
  }

  if (displayCount === 0 && (hasActiveFilters || search.trim().length > 0)) {
    return {
      kind: 'filtered-empty',
      title: t('wardrobe.no_match_title'),
      description: t('wardrobe.no_match_desc'),
    };
  }

  if (displayCount === 0) {
    return {
      kind: 'empty',
      title: t('wardrobe.empty_title'),
      description: t('wardrobe.empty_desc'),
    };
  }

  return {
    kind: 'results',
    title: t('wardrobe.pieces_ready').replace('{count}', String(displayCount)),
    description: t('wardrobe.tap_hint'),
  };
}
