import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: vi.fn(() => ({ t: (k: string) => k, locale: 'en' })),
}));

vi.mock('@/lib/haptics', () => ({
  hapticLight: vi.fn(),
}));

vi.mock('@/components/ui/lazy-image', () => ({
  LazyImageSimple: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...p }: React.PropsWithChildren<Record<string, unknown>>) => {
      const { style, drag, dragDirectionLock, dragConstraints, dragElastic, onDragEnd, ...rest } = p;
      return <div {...rest}>{children}</div>;
    },
  },
  useMotionValue: () => ({ get: () => 0, set: vi.fn() }),
  useTransform: () => ({ get: () => 1 }),
  animate: vi.fn(),
}));

import { SwipeableGarmentCard } from '../SwipeableGarmentCard';
import type { Garment } from '@/hooks/useGarments';

const baseGarment: Partial<Garment> = {
  id: 'g1',
  title: 'Blue Oxford Shirt',
  category: 'top',
  color_primary: 'blue',
  image_path: 'img.jpg',
  formality: null,
  ai_raw: null,
  in_laundry: false,
  created_at: new Date(0).toISOString(),
};

function renderCard(overrides: Partial<Garment> = {}) {
  const garment = { ...baseGarment, ...overrides } as Garment;
  return render(
    <MemoryRouter>
      <SwipeableGarmentCard
        garment={garment}
        onEdit={vi.fn()}
        onLaundry={vi.fn()}
        onDelete={vi.fn()}
      />
    </MemoryRouter>,
  );
}

describe('SwipeableGarmentCard', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders without crashing with minimal props', () => {
    const { container } = renderCard();
    expect(container.firstChild).toBeInTheDocument();
  });

  it('renders garment title when provided', () => {
    renderCard({ title: 'Blue Oxford Shirt' });
    expect(screen.getByText('Blue Oxford Shirt')).toBeInTheDocument();
  });

  it('renders category label', () => {
    renderCard({ category: 'top', color_primary: 'blue' });
    expect(screen.getByText(/garment\.category\.top/)).toBeInTheDocument();
  });

  it('renders formality dots when formality is 3 (3 filled + 2 unfilled)', () => {
    const { container } = renderCard({ formality: 3 });
    const dots = container.querySelectorAll('.rounded-full.inline-block');
    expect(dots).toHaveLength(5);
    const filled = container.querySelectorAll('.bg-foreground\\/70');
    const unfilled = container.querySelectorAll('.bg-foreground\\/10');
    expect(filled).toHaveLength(3);
    expect(unfilled).toHaveLength(2);
  });

  it('renders nothing for intelligence strip when formality is undefined', () => {
    const { container } = renderCard({ formality: undefined, ai_raw: null });
    const dots = container.querySelectorAll('.rounded-full.inline-block');
    expect(dots).toHaveLength(0);
  });

  it('does not render occasion chips when no occasion data present', () => {
    renderCard({ ai_raw: null });
    const chips = screen.queryAllByText(/./);
    // No Chip components rendered — only title, category, and action labels
    const chipElements = document.querySelectorAll('[class*="cursor-default"][class*="pointer-events-none"]');
    expect(chipElements).toHaveLength(0);
  });
});
