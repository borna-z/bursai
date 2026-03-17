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

import { SwipeableGarmentCard } from '../SwipeableGarmentCard';
import type { Garment } from '@/hooks/useGarments';

const baseGarment = {
  id: 'g-1',
  title: 'Blue T-Shirt',
  category: 'tshirt',
  color_primary: 'blue',
  image_path: 'garments/g-1.webp',
  created_at: new Date().toISOString(),
  in_laundry: false,
} as Garment;

function renderCard(overrides: Partial<Garment> = {}, handlers = {}) {
  const props = {
    garment: { ...baseGarment, ...overrides } as Garment,
    onEdit: vi.fn(),
    onLaundry: vi.fn(),
    onDelete: vi.fn(),
    ...handlers,
  };
  return { ...render(
    <MemoryRouter>
      <SwipeableGarmentCard {...props} />
    </MemoryRouter>,
  ), props };
}

describe('SwipeableGarmentCard', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders without crashing', () => {
    renderCard();
    expect(document.querySelector('.rounded-xl')).toBeInTheDocument();
  });

  it('displays garment title', () => {
    renderCard();
    expect(screen.getByText('Blue T-Shirt', { selector: 'p' })).toBeInTheDocument();
  });

  it('displays category and color via translation keys', () => {
    renderCard();
    expect(screen.getByText(/garment\.category\.tshirt/)).toBeInTheDocument();
  });

  it('shows new badge when garment was created within 24h', () => {
    renderCard({ created_at: new Date().toISOString() });
    expect(screen.getByText('wardrobe.new_badge')).toBeInTheDocument();
  });

  it('does not show new badge for old garments', () => {
    renderCard({ created_at: '2020-01-01T00:00:00Z' });
    expect(screen.queryByText('wardrobe.new_badge')).not.toBeInTheDocument();
  });

  it('renders action buttons (edit, laundry, delete)', () => {
    renderCard();
    expect(screen.getByLabelText('common.edit')).toBeInTheDocument();
    expect(screen.getByLabelText('wardrobe.laundry')).toBeInTheDocument();
    expect(screen.getByLabelText('wardrobe.remove')).toBeInTheDocument();
  });

  it('calls onEdit when edit button is clicked', () => {
    vi.useFakeTimers();
    const { props } = renderCard();
    fireEvent.click(screen.getByLabelText('common.edit'));
    vi.advanceTimersByTime(200);
    expect(props.onEdit).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('calls onDelete when delete button is clicked', () => {
    vi.useFakeTimers();
    const { props } = renderCard();
    fireEvent.click(screen.getByLabelText('wardrobe.remove'));
    vi.advanceTimersByTime(200);
    expect(props.onDelete).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('applies reduced opacity when garment is in laundry', () => {
    renderCard({ in_laundry: true });
    expect(document.querySelector('.opacity-60')).toBeInTheDocument();
  });
});
