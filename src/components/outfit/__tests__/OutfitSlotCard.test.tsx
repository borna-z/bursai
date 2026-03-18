import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: vi.fn(() => ({ t: (k: string) => k, locale: 'en' })),
}));

vi.mock('@/components/ui/lazy-image', () => ({
  LazyImageSimple: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

import { OutfitSlotCard } from '../OutfitSlotCard';

const defaultProps = {
  slot: 'top',
  garmentId: 'g1',
  garmentTitle: 'White T-Shirt',
  garmentColor: 'white',
  garmentCategory: 'top',
  imagePath: 'img.jpg',
  onSwap: vi.fn(),
};

function renderCard(overrides: Partial<typeof defaultProps> = {}) {
  return render(
    <MemoryRouter>
      <OutfitSlotCard {...defaultProps} {...overrides} />
    </MemoryRouter>,
  );
}

describe('OutfitSlotCard', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders without crashing', () => {
    const { container } = renderCard();
    expect(container.firstChild).toBeInTheDocument();
  });

  it('renders slot label (top)', () => {
    renderCard({ slot: 'top' });
    expect(screen.getByText('outfit.slot.top')).toBeInTheDocument();
  });

  it('renders garment title when provided', () => {
    renderCard({ garmentTitle: 'White T-Shirt' });
    expect(screen.getByText('White T-Shirt')).toBeInTheDocument();
  });

  it('renders swap button', () => {
    renderCard();
    expect(screen.getByRole('button', { name: 'outfit.swap_out' })).toBeInTheDocument();
  });

  it('calls onSwap when swap button is clicked', () => {
    const onSwap = vi.fn();
    renderCard({ onSwap });
    fireEvent.click(screen.getByRole('button', { name: 'outfit.swap_out' }));
    expect(onSwap).toHaveBeenCalledOnce();
  });

  it('shows skeleton when isLoading is true', () => {
    const { container } = render(
      <MemoryRouter>
        <OutfitSlotCard {...defaultProps} isLoading={true} />
      </MemoryRouter>,
    );
    const skeletons = container.querySelectorAll('[class*="skeleton-shimmer"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });
});
