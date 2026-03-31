import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WardrobeToolbar } from '../WardrobeToolbar';
import type { WardrobeCommandTopState } from '../wardrobeTypes';

const baseCommandState: WardrobeCommandTopState = {
  title: 'Wardrobe',
  caption: 'Search, filter, and open what you own.',
  activeTab: 'garments',
  resultsLabel: '12 garments',
  searchPlaceholder: 'Search garments...',
  actions: [
    { key: 'style', label: 'Create', tone: 'primary' },
    { key: 'plan', label: 'Plan', tone: 'secondary' },
  ],
};

function renderToolbar({
  commandState = baseCommandState,
  isSelecting = false,
  selectedIdsCount = 0,
  hasActiveFilters = false,
  search = '',
  activeTab = 'garments' as const,
} = {}) {
  return render(
    <WardrobeToolbar
      t={(key) => key}
      commandState={{ ...commandState, activeTab }}
      isGridView
      onToggleView={vi.fn()}
      isSelecting={isSelecting}
      onStartSelecting={vi.fn()}
      onCancelSelecting={vi.fn()}
      activeTab={activeTab}
      onTabChange={vi.fn()}
      search={search}
      onSearchChange={vi.fn()}
      onClearSearch={vi.fn()}
      onOpenFilterSheet={vi.fn()}
      hasActiveFilters={hasActiveFilters}
      activeFilterCount={hasActiveFilters ? 2 : 0}
      selectedIdsCount={selectedIdsCount}
      onBulkLaundry={vi.fn()}
      onBulkDelete={vi.fn()}
      onAction={vi.fn()}
      onClearFilters={vi.fn()}
      selectedCategory="all"
      onCategoryChange={vi.fn()}
      totalCount={12}
    />,
  );
}

describe('WardrobeToolbar', () => {
  it('renders the V4 garments state with tabs, search, and category chips', () => {
    renderToolbar();

    expect(screen.getByText('wardrobe.tab_garments')).toBeInTheDocument();
    expect(screen.getByText('wardrobe.tab_outfits')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search garments...')).toBeInTheDocument();
    // Category chips rendered
    expect(screen.getByText('wardrobe.filter_all')).toBeInTheDocument();
  });

  it('renders selecting state with bulk actions', () => {
    renderToolbar({
      isSelecting: true,
      selectedIdsCount: 3,
    });

    expect(screen.getByRole('button', { name: 'common.cancel' })).toBeInTheDocument();
    expect(screen.getByText('3 wardrobe.selected')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /wardrobe\.laundry/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /wardrobe\.remove/i })).toBeInTheDocument();
  });

  it('shows filter badge when filters are active', () => {
    renderToolbar({ hasActiveFilters: true });

    const filterButton = screen.getByRole('button', { name: 'wardrobe.filter' });
    expect(filterButton).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('hides garment search controls on outfits tab', () => {
    renderToolbar({
      activeTab: 'outfits',
    });

    expect(screen.queryByPlaceholderText('Search garments...')).not.toBeInTheDocument();
    expect(screen.getByText('wardrobe.tab_garments')).toBeInTheDocument();
    expect(screen.getByText('wardrobe.tab_outfits')).toBeInTheDocument();
  });
});
