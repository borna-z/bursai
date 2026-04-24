import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { WardrobeGarmentGridLayout, WardrobeGarmentListLayout } from '../GarmentCardSystem';
import type { Garment } from '@/hooks/useGarments';

vi.mock('@/components/ui/lazy-image', () => ({
  LazyImageSimple: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

const garment = {
  id: 'g1',
  title: 'Stone trench coat',
  category: 'outerwear',
  color_primary: 'beige',
  image_path: 'coat.jpg',
  created_at: '2026-03-28T09:00:00.000Z',
  wear_count: 2,
  formality: 4,
  ai_raw: { occasions: ['work', 'travel'] },
  in_laundry: false,
  render_status: null,
} as unknown as Garment;

const laundryGarment = {
  ...garment,
  in_laundry: true,
  wear_count: 0,
} as Garment;

function t(key: string) {
  return {
    'wardrobe.laundry': 'Laundry',
    'wardrobe.new_badge': 'New',
    'wardrobe.wears_count': '{count} wears',
    'garment.never_worn': 'Never worn',
  }[key] ?? key;
}

describe('GarmentCardSystem', () => {
  it('keeps the grid card focused while preserving richer actions in list view', () => {
    const onStyleAround = vi.fn();
    const { rerender } = render(
      <WardrobeGarmentGridLayout
        garment={garment}
        t={t}
        onStyleAround={onStyleAround}
      />,
    );

    expect(screen.getByText('Stone trench coat')).toBeInTheDocument();
    expect(screen.getByText('Outerwear')).toBeInTheDocument();
    expect(screen.getByText(/Beige/)).toBeInTheDocument();
    expect(screen.getByText(/2 wears/)).toBeInTheDocument();
    expect(screen.queryByText('Work')).not.toBeInTheDocument();
    expect(screen.queryByText('Travel')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Style this/i })).not.toBeInTheDocument();

    rerender(
      <WardrobeGarmentListLayout
        garment={garment}
        t={t}
        onStyleAround={onStyleAround}
      />,
    );

    expect(screen.getByText('Stone trench coat')).toBeInTheDocument();
    expect(screen.getByText('Outerwear')).toBeInTheDocument();
    expect(screen.getByText(/Beige/)).toBeInTheDocument();
    expect(screen.getByText(/2 wears/)).toBeInTheDocument();
    expect(screen.getByText(/Work/)).toBeInTheDocument();
    expect(screen.getByText(/Travel/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Style this/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Style this/i }));
    expect(onStyleAround).toHaveBeenCalledTimes(1);
  });

  it('keeps laundry state language consistent across grid and list layouts', () => {
    const { rerender } = render(
      <WardrobeGarmentGridLayout
        garment={laundryGarment}
        t={t}
        onStyleAround={vi.fn()}
      />,
    );

    expect(screen.getByText('Laundry')).toBeInTheDocument();
    expect(screen.getByText(/Never worn/)).toBeInTheDocument();

    rerender(
      <WardrobeGarmentListLayout
        garment={laundryGarment}
        t={t}
        onStyleAround={vi.fn()}
      />,
    );

    expect(screen.getByText('Laundry')).toBeInTheDocument();
    expect(screen.getByText(/Never worn/)).toBeInTheDocument();
  });

  it('suppresses the style action while selecting', () => {
    render(
      <WardrobeGarmentListLayout
        garment={garment}
        t={t}
        isSelecting
        isSelected={false}
      />,
    );

    expect(screen.queryByRole('button', { name: /Style this/i })).not.toBeInTheDocument();
  });
});
