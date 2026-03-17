import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: vi.fn(() => ({ t: (k: string) => k, locale: 'en' })),
}));

vi.mock('@/lib/haptics', () => ({
  hapticLight: vi.fn(),
}));

vi.mock('@/components/ui/lazy-image', () => ({
  LazyImageSimple: ({ alt }: { alt: string }) => <div data-testid="lazy-image">{alt}</div>,
}));

import { OutfitSlotCard } from '../OutfitSlotCard';

const baseProps = {
  slot: 'top',
  garmentId: 'g-1',
  garmentTitle: 'Blue T-Shirt',
  garmentColor: 'blue',
  garmentCategory: 'tshirt',
  imagePath: 'garments/g-1.webp',
  onSwap: vi.fn(),
};

function renderCard(overrides = {}) {
  const props = { ...baseProps, onSwap: vi.fn(), ...overrides };
  return { ...render(
    <MemoryRouter>
      <OutfitSlotCard {...props} />
    </MemoryRouter>,
  ), props };
}

describe('OutfitSlotCard', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders without crashing', () => {
    renderCard();
    expect(screen.getByText('Blue T-Shirt', { selector: 'p' })).toBeInTheDocument();
  });

  it('displays slot label via translation key', () => {
    renderCard();
    expect(screen.getByText('outfit.slot.top')).toBeInTheDocument();
  });

  it('displays garment title', () => {
    renderCard({ garmentTitle: 'Red Jacket' });
    expect(screen.getByText('Red Jacket', { selector: 'p' })).toBeInTheDocument();
  });

  it('displays color and category meta', () => {
    renderCard();
    expect(screen.getByText('blue · tshirt')).toBeInTheDocument();
  });

  it('shows fallback title when garmentTitle is missing', () => {
    renderCard({ garmentTitle: undefined });
    expect(screen.getByText('outfit.unknown')).toBeInTheDocument();
  });

  it('renders the swap button with correct aria-label', () => {
    renderCard();
    expect(screen.getByLabelText('outfit.swap_out')).toBeInTheDocument();
  });

  it('calls onSwap when swap button is clicked', () => {
    const { props } = renderCard();
    fireEvent.click(screen.getByLabelText('outfit.swap_out'));
    expect(props.onSwap).toHaveBeenCalledTimes(1);
  });

  it('renders loading skeleton when isLoading is true', () => {
    const { container } = renderCard({ isLoading: true });
    expect(container.querySelectorAll('[class*="skeleton-shimmer"]').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('Blue T-Shirt')).not.toBeInTheDocument();
  });

  it('renders image with garment title as alt text', () => {
    renderCard();
    expect(screen.getByTestId('lazy-image')).toHaveTextContent('Blue T-Shirt');
  });
});
