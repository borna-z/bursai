import type { WardrobeSmartFilter, WardrobeTab } from '@/hooks/useWardrobeView';
import type {
  WardrobeCollectionTileModel,
  WardrobeCommandActionModel,
  WardrobeCommandTopState,
} from '@/components/wardrobe/wardrobeTypes';

type Translate = (key: string) => string;

function getResultsLabel({
  activeTab,
  totalCount,
  displayCount,
  hasActiveFilters,
  isSearching,
  t,
}: {
  activeTab: WardrobeTab;
  totalCount?: number;
  displayCount: number;
  hasActiveFilters: boolean;
  isSearching: boolean;
  t: Translate;
}) {
  if (activeTab === 'outfits') {
    return t('wardrobe.tab_outfits');
  }

  if (!totalCount) {
    return t('wardrobe.add_first');
  }

  if (hasActiveFilters || isSearching) {
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
  isSearching,
  search,
  t,
}: {
  activeTab: WardrobeTab;
  totalCount?: number;
  displayCount: number;
  isSelecting: boolean;
  selectedIdsCount: number;
  hasActiveFilters: boolean;
  isSearching: boolean;
  search: string;
  t: Translate;
}): WardrobeCommandTopState {
  const garmentCount = totalCount ?? 0;
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
  } else if (activeTab === 'garments' && garmentCount === 0) {
    caption = t('wardrobe.guidance_zero');
  } else if (activeTab === 'garments' && garmentCount <= 2) {
    caption = t('wardrobe.guidance_low');
  } else if (activeTab === 'garments' && garmentCount <= 9) {
    caption = t('wardrobe.guidance_growing');
  }

  const actions: WardrobeCommandActionModel[] = [
    { key: 'style', label: t('outfits.create'), tone: 'primary' as const },
    { key: 'plan', label: t('plan.plan'), tone: 'secondary' as const },
  ];

  return {
    title: t('wardrobe.title'),
    caption,
    activeTab,
    resultsLabel: getResultsLabel({ activeTab, totalCount, displayCount, hasActiveFilters, isSearching, t }),
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

