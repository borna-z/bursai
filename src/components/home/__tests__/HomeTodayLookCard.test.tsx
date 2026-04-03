import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import { HomeTodayLookCard } from '@/components/home/HomeTodayLookCard';

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/components/ui/lazy-image', () => ({
  LazyImageSimple: ({ alt }: { alt: string }) => <div>{alt}</div>,
}));

vi.mock('@/components/ui/BursMonogram', () => ({
  BursMonogram: () => <div data-testid="burs-monogram" />,
}));

describe('HomeTodayLookCard', () => {
  it('renders the settings action below the planned outfit area', () => {
    const onTertiaryAction = vi.fn();

    render(
      <HomeTodayLookCard
        state="outfit_planned"
        todayOutfit={{
          id: 'outfit-1',
          occasion: 'Travel',
          outfit_items: [
            { id: 'item-1', slot: 'top', garment: { id: 'garment-1', title: 'White tee', image_path: 'tee.jpg' } },
          ],
        } as any}
        garmentCount={12}
        weatherSummary="4° Cloudy"
        primaryLabel="Wear today"
        secondaryLabel="Restyle"
        tertiaryLabel="Settings"
        onPrimaryAction={vi.fn()}
        onSecondaryAction={vi.fn()}
        onTertiaryAction={onTertiaryAction}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /settings/i }));

    expect(onTertiaryAction).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Travel')).toBeInTheDocument();
  });

  it('renders the settings action when no outfit is planned', () => {
    const onTertiaryAction = vi.fn();

    render(
      <HomeTodayLookCard
        state="no_outfit"
        todayOutfit={null}
        garmentCount={12}
        weatherSummary={null}
        primaryLabel="Style me"
        secondaryLabel="Open plan"
        tertiaryLabel="Settings"
        onPrimaryAction={vi.fn()}
        onSecondaryAction={vi.fn()}
        onTertiaryAction={onTertiaryAction}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /settings/i }));

    expect(onTertiaryAction).toHaveBeenCalledTimes(1);
    expect(screen.getByText('home.no_outfit_title')).toBeInTheDocument();
  });
});
