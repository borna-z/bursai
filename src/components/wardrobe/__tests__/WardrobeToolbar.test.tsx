import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { WardrobeToolbar } from '../WardrobeToolbar';
import type { WardrobeCommandTopState, WardrobeInventoryState } from '../wardrobeTypes';

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

const baseInventoryState: WardrobeInventoryState = {
  kind: 'results',
  title: '12 pieces ready',
  description: 'Tap a piece to open it.',
};

function renderToolbar({
  commandState = baseCommandState,
  inventoryState = baseInventoryState,
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
      inventoryState={inventoryState}
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
    />,
  );
}

describe('WardrobeToolbar', () => {
  it('renders the default garments state', () => {
    renderToolbar();

    expect(screen.getByText('nav.wardrobe')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search garments...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Plan' })).toBeInTheDocument();
    expect(screen.queryByText('12 pieces ready')).not.toBeInTheDocument();
  });

  it('renders selecting state with bulk actions', () => {
    renderToolbar({
      isSelecting: true,
      selectedIdsCount: 3,
      commandState: {
        ...baseCommandState,
        caption: '3 selected',
      },
      inventoryState: {
        kind: 'selecting',
        title: '3 selected',
        description: 'Batch actions stay above the list.',
      },
    });

    expect(screen.getByRole('button', { name: 'common.cancel' })).toBeInTheDocument();
    expect(screen.getByText('3 wardrobe.selected')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /wardrobe\.laundry/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /wardrobe\.remove/i })).toBeInTheDocument();
  });

  it('shows clear when filters or search are active', () => {
    const onClearSearch = vi.fn();
    const onClearFilters = vi.fn();

    render(
      <WardrobeToolbar
        t={(key) => key}
        commandState={baseCommandState}
        inventoryState={{
          kind: 'results',
          title: '2 pieces ready',
          description: 'Tap a piece to open it.',
        }}
        isGridView
        onToggleView={vi.fn()}
        isSelecting={false}
        onStartSelecting={vi.fn()}
        onCancelSelecting={vi.fn()}
        activeTab="garments"
        onTabChange={vi.fn()}
        search="blue"
        onSearchChange={vi.fn()}
        onClearSearch={onClearSearch}
        onOpenFilterSheet={vi.fn()}
        hasActiveFilters
        activeFilterCount={2}
        selectedIdsCount={0}
        onBulkLaundry={vi.fn()}
        onBulkDelete={vi.fn()}
        onAction={vi.fn()}
        onClearFilters={onClearFilters}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'wardrobe.clear' }));
    expect(onClearSearch).toHaveBeenCalled();
    expect(onClearFilters).toHaveBeenCalled();
  });

  it('renders a calmer outfits state without garment search controls', () => {
    renderToolbar({
      activeTab: 'outfits',
      commandState: {
        ...baseCommandState,
        activeTab: 'outfits',
        caption: 'Saved and planned looks stay together.',
      },
      inventoryState: {
        kind: 'results',
        title: 'Look archive',
        description: 'Saved and planned looks stay together here.',
      },
    });

    expect(screen.queryByPlaceholderText('Search garments...')).not.toBeInTheDocument();
    expect(screen.getByText('nav.outfits')).toBeInTheDocument();
    expect(screen.getByText('Look archive')).toBeInTheDocument();
  });
});
