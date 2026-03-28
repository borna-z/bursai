import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import { HomeCommandBoard } from '../HomeCommandBoard';

vi.mock('@/components/ui/OutfitComposition', () => ({
  OutfitComposition: () => <div data-testid="outfit-composition" />,
}));

const baseProps = {
  garmentCount: 8,
  recentOutfits: [],
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
        secondaryLabel="Open wardrobe"
        coachNudge
      />,
    );

    expect(screen.getByTestId('home-command-board-empty_wardrobe')).toBeInTheDocument();
    expect(screen.getByTestId('home-command-board-visual-empty')).toBeInTheDocument();
    expect(screen.getByText('Top')).toBeInTheDocument();
    expect(screen.getByText('Start with three anchors')).toBeInTheDocument();
    expect(screen.getByText('Open wardrobe')).toBeInTheDocument();
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
    expect(screen.getByText('Planned look')).toBeInTheDocument();
    expect(screen.getByText('Today is covered')).toBeInTheDocument();
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
    expect(screen.getByText('Recent looks')).toBeInTheDocument();
    expect(screen.getByText('No look is saved yet')).toBeInTheDocument();
    expect(screen.getByText('Style Me')).toBeInTheDocument();
  });

  it('renders weather alert copy in weather state', () => {
    render(
      <HomeCommandBoard
        {...baseProps}
        state="weather_alert"
        weatherSummary="7° Rain"
      />,
    );

    expect(screen.getByTestId('home-command-board-weather_alert')).toBeInTheDocument();
    expect(screen.getByText('Forecast changed the plan')).toBeInTheDocument();
    expect(screen.getByText('Rebuild around weather')).toBeInTheDocument();
  });
});
