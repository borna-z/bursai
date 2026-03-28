import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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
  image_processing_status: null,
  render_status: null,
} as unknown as Garment;

describe('GarmentCardSystem', () => {
  it('shares the core content model between grid and list layouts', () => {
    const { rerender } = render(
      <WardrobeGarmentGridLayout
        garment={garment}
        t={(key) => key}
        onStyleAround={vi.fn()}
      />,
    );

    expect(screen.getByText('Stone trench coat')).toBeInTheDocument();
    expect(screen.getByText('Outerwear / Beige')).toBeInTheDocument();
    expect(screen.getByText('2 wears')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Style around this/i })).toBeInTheDocument();

    rerender(
      <WardrobeGarmentListLayout
        garment={garment}
        t={(key) => key}
        onStyleAround={vi.fn()}
      />,
    );

    expect(screen.getByText('Stone trench coat')).toBeInTheDocument();
    expect(screen.getByText('Outerwear / Beige')).toBeInTheDocument();
    expect(screen.getByText('2 wears')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Style around this/i })).toBeInTheDocument();
  });

  it('suppresses the style action while selecting', () => {
    render(
      <WardrobeGarmentGridLayout
        garment={garment}
        t={(key) => key}
        isSelecting
        isSelected={false}
      />,
    );

    expect(screen.queryByRole('button', { name: /Style around this/i })).not.toBeInTheDocument();
  });
});
