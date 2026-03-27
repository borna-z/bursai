import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HomeCommandBoard } from '../HomeCommandBoard';

vi.mock('@/components/ui/OutfitComposition', () => ({
  OutfitComposition: () => <div data-testid="outfit-composition" />,
}));

const baseProps = {
  garmentCount: 8,
  recentOutfits: [],
  stylistLine: 'Lead with clean structure and keep the shoes grounded.',
  secondaryLabel: 'Open plan',
  onPrimaryAction: vi.fn(),
  onSecondaryAction: vi.fn(),
};

describe('HomeCommandBoard', () => {
  it('renders starter slot placeholders for empty wardrobe state', () => {
    render(
      <HomeCommandBoard
        {...baseProps}
        state="empty_wardrobe"
        garmentCount={2}
        secondaryLabel="Add garments"
      />,
    );

    expect(screen.getByTestId('home-command-board-empty_wardrobe')).toBeInTheDocument();
    expect(screen.getByTestId('home-command-board-visual-empty')).toBeInTheDocument();
    expect(screen.getByText('Top')).toBeInTheDocument();
    expect(screen.getByText('Add garments')).toBeInTheDocument();
  });

  it('renders the planned outfit composition state', () => {
    render(
      <HomeCommandBoard
        {...baseProps}
        state="outfit_planned"
        todayOutfit={{
          id: 'look-1',
          explanation: 'A polished work look.',
          outfit_items: [],
        } as never}
      />,
    );

    expect(screen.getByTestId('home-command-board-outfit_planned')).toBeInTheDocument();
    expect(screen.getByTestId('home-command-board-visual-planned')).toBeInTheDocument();
    expect(screen.getByTestId('outfit-composition')).toBeInTheDocument();
    expect(screen.getByText('Saved for today')).toBeInTheDocument();
  });

  it('renders recent-look mode when there is no planned outfit', () => {
    render(
      <HomeCommandBoard
        {...baseProps}
        state="no_outfit"
      />,
    );

    expect(screen.getByTestId('home-command-board-no_outfit')).toBeInTheDocument();
    expect(screen.getByTestId('home-command-board-visual-recent')).toBeInTheDocument();
    expect(screen.getByText('Rotation note')).toBeInTheDocument();
    expect(screen.getByText('Style Me')).toBeInTheDocument();
  });
});
