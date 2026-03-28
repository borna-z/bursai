import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import { WardrobeToolbar } from '../WardrobeToolbar';
import type { WardrobeCommandTopState, WardrobeInventoryState } from '../wardrobeTypes';

const baseCommandState: WardrobeCommandTopState = {
  title: 'Wardrobe',
  caption: 'Search, filter, and open garments directly from one calm workspace.',
  resultsLabel: '12 garments',
  searchPlaceholder: 'Search garments...',
};

const baseInventoryState: WardrobeInventoryState = {
  kind: 'results',
  title: '12 pieces ready',
  description: 'Tap a garment to open it, edit it, or style around it.',
};

function renderToolbar({
  commandState = baseCommandState,
  inventoryState = baseInventoryState,
  isSelecting = false,
  selectedIdsCount = 0,
  hasActiveFilters = false,
  search = '',
} = {}) {
  return render(
    <WardrobeToolbar
      t={(key) => key}
      commandState={commandState}
      inventoryState={inventoryState}
      isGridView
      onToggleView={vi.fn()}
      isSelecting={isSelecting}
      onStartSelecting={vi.fn()}
      onCancelSelecting={vi.fn()}
      search={search}
      onSearchChange={vi.fn()}
      onClearSearch={vi.fn()}
      onOpenFilterSheet={vi.fn()}
      hasActiveFilters={hasActiveFilters}
      activeFilterCount={hasActiveFilters ? 2 : 0}
      selectedIdsCount={selectedIdsCount}
      onBulkLaundry={vi.fn()}
      onBulkDelete={vi.fn()}
      onClearFilters={vi.fn()}
      onAddGarment={vi.fn()}
      onOpenOutfits={vi.fn()}
    />,
  );
}

describe('WardrobeToolbar', () => {
  it('renders the calmer garments-only header state', () => {
    renderToolbar();

    expect(screen.getByRole('heading', { name: 'Wardrobe' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search garments...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'wardrobe.add' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open outfits' })).toBeInTheDocument();
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
        description: 'Batch actions stay visible only while selection mode is on.',
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
        inventoryState={baseInventoryState}
        isGridView
        onToggleView={vi.fn()}
        isSelecting={false}
        onStartSelecting={vi.fn()}
        onCancelSelecting={vi.fn()}
        search="blue"
        onSearchChange={vi.fn()}
        onClearSearch={onClearSearch}
        onOpenFilterSheet={vi.fn()}
        hasActiveFilters
        activeFilterCount={2}
        selectedIdsCount={0}
        onBulkLaundry={vi.fn()}
        onBulkDelete={vi.fn()}
        onClearFilters={onClearFilters}
        onAddGarment={vi.fn()}
        onOpenOutfits={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(onClearSearch).toHaveBeenCalled();
    expect(onClearFilters).toHaveBeenCalled();
  });

  it('keeps the outfits archive as a secondary route instead of a page tab', () => {
    renderToolbar();

    expect(screen.queryByRole('button', { name: 'wardrobe.tab_garments' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'wardrobe.tab_outfits' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open outfits' })).toBeInTheDocument();
  });
});
