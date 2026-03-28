import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const navigateMock = vi.fn();
const triggerGarmentPostSaveIntelligenceMock = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: vi.fn(() => ({ t: (key: string) => key, locale: 'en' })),
}));

vi.mock('@/lib/haptics', () => ({
  hapticLight: vi.fn(),
}));

vi.mock('@/lib/garmentIntelligence', () => ({
  triggerGarmentPostSaveIntelligence: (...args: unknown[]) => triggerGarmentPostSaveIntelligenceMock(...args),
}));

vi.mock('@/components/ui/lazy-image', () => ({
  LazyImageSimple: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => {
      const { style, drag, dragDirectionLock, dragConstraints, dragElastic, onDragEnd, ...rest } = props;
      return <div {...rest}>{children}</div>;
    },
    button: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => <button {...props}>{children}</button>,
    p: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => <p {...props}>{children}</p>,
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
  wear_count: 0,
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
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the shared wardrobe card language', () => {
    renderCard();

    expect(screen.getByText('Blue Oxford Shirt')).toBeInTheDocument();
    expect(screen.getByText('Top')).toBeInTheDocument();
    expect(screen.getByText('Blue')).toBeInTheDocument();
    expect(screen.getByText('Never worn')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Style around this/i })).toBeInTheDocument();
  });

  it('renders formality dots when formality is provided', () => {
    const { container } = renderCard({ formality: 3 });

    expect(container.querySelectorAll('.bg-foreground\\/65')).toHaveLength(3);
    expect(container.querySelectorAll('.bg-foreground\\/12')).toHaveLength(2);
  });

  it('does not render occasion pills when no occasion data is present', () => {
    renderCard({ ai_raw: null });

    expect(screen.queryByText('Work')).not.toBeInTheDocument();
    expect(screen.queryByText('Casual')).not.toBeInTheDocument();
  });

  it('navigates into anchored style flow from the shared CTA', () => {
    renderCard();

    fireEvent.click(screen.getByRole('button', { name: /Style around this/i }));
    expect(navigateMock).toHaveBeenCalledWith('/ai/chat?selectedGarmentId=g1&garments=g1', {
      state: {
        garmentIds: ['g1'],
        selectedGarmentId: 'g1',
        selectedGarmentIds: ['g1'],
        prefillMessage: 'Style around this garment and build a complete look around it.',
      },
    });
    expect(navigateMock).toHaveBeenCalledTimes(1);
  });

  it('opens the garment detail when the card body is tapped', () => {
    renderCard();

    fireEvent.click(screen.getByText('Blue Oxford Shirt'));

    expect(navigateMock).toHaveBeenCalledWith('/wardrobe/g1');
  });

  it('keeps the redesign secondary action wired to enhancement without opening the garment', () => {
    renderCard();

    fireEvent.click(screen.getByRole('button', { name: 'Enhance' }));

    expect(triggerGarmentPostSaveIntelligenceMock).toHaveBeenCalledWith({
      garmentId: 'g1',
      storagePath: 'img.jpg',
      source: 'manual_enhance',
      imageProcessing: { mode: 'full' },
    });
    expect(navigateMock).not.toHaveBeenCalled();
    expect(screen.getByText('Enhancing...')).toBeInTheDocument();
  });
});
