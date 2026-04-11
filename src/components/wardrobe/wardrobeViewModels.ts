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
  filteredCount,
  displayCount,
  isSearching,
  t,
}: {
  activeTab: WardrobeTab;
  totalCount?: number;
  filteredCount?: number;
  displayCount: number;
  isSearching: boolean;
  t: Translate;
}) {
  if (activeTab === 'outfits') {
    return t('wardrobe.tab_outfits');
  }

  if (!totalCount) {
    return t('wardrobe.add_first');
  }

  // Search results come from a client-side array (useGarmentSearch, capped at
  // 200) — use its length directly.
  if (isSearching) {
    return `${displayCount} ${t('wardrobe.garments_count_label')}`;
  }

  // Everything else (unfiltered or filtered) is backed by a server-side
  // count query that mirrors the current filter set, so it always matches
  // what the infinite query will ultimately return.
  const effectiveCount = filteredCount ?? totalCount;
  return `${effectiveCount} ${t('wardrobe.garments_count_label')}`;
}

export function buildWardrobeCommandTopState({
  activeTab,
  totalCount,
  filteredCount,
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
  filteredCount?: number;
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
  // Prefer the filter-aware count for the "X filtered" caption so it agrees
  // with the header and the Smart Access tiles.
  const activeCount = filteredCount ?? displayCount;

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
    caption = t('wardrobe.filtered_count').replace('{count}', String(activeCount));
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
    resultsLabel: getResultsLabel({ activeTab, totalCount, filteredCount, displayCount, isSearching, t }),
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

