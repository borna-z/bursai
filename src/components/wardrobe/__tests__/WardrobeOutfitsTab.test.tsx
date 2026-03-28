import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ReactNode } from 'react';

const navigateMock = vi.fn();
const mutateMock = vi.fn();
const useOutfitsMock = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('framer-motion', () => ({
  motion: {
    div: ({
      children,
      whileTap,
      transition,
      ...props
    }: Record<string, unknown> & { children?: ReactNode }) => <div {...props}>{children}</div>,
    h3: ({ children, ...props }: Record<string, unknown> & { children?: ReactNode }) => <h3 {...props}>{children}</h3>,
    p: ({ children, ...props }: Record<string, unknown> & { children?: ReactNode }) => <p {...props}>{children}</p>,
    button: ({ children, ...props }: Record<string, unknown> & { children?: ReactNode }) => <button {...props}>{children}</button>,
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    locale: 'en',
    t: (key: string) => {
      const translations: Record<string, string> = {
        'outfits.create': 'Create outfit',
        'outfits.deleted': 'Outfit deleted',
        'outfits.delete_error': 'Could not delete outfit',
        'outfits.delete_confirm': 'Delete outfit?',
        'outfits.delete_warning': 'This removes the outfit from your wardrobe.',
        'common.cancel': 'Cancel',
        'common.delete': 'Delete',
        'occasion.work': 'Work',
        'occasion.casual': 'Casual',
      };

      return translations[key] ?? key;
    },
  }),
}));

vi.mock('@/hooks/useOutfits', () => ({
  useOutfits: (...args: unknown[]) => useOutfitsMock(...args),
  useDeleteOutfit: () => ({
    mutate: mutateMock,
  }),
}));

vi.mock('@/components/ui/OutfitPreviewCard', () => ({
  OutfitPreviewCard: ({
    meta,
    excerpt,
    footer,
  }: {
    meta?: ReactNode;
    excerpt?: string | null;
    footer?: ReactNode;
  }) => (
    <div data-testid="outfit-preview-card">
      {meta}
      {excerpt ? <div>{excerpt}</div> : null}
      {footer}
    </div>
  ),
}));

import { WardrobeOutfitsTab } from '../WardrobeOutfitsTab';

const baseOutfit = {
  id: 'outfit-1',
  user_id: 'user-1',
  occasion: 'work',
  explanation: 'Clean layers with enough structure for the office.',
  outfit_items: [],
  saved: true,
  rating: 4,
  planned_for: '2026-03-30',
  worn_at: null,
  generated_at: '2026-03-28T09:00:00.000Z',
  created_at: '2026-03-28T09:00:00.000Z',
  updated_at: '2026-03-28T09:00:00.000Z',
  style_vibe: null,
  weather: null,
  feedback: null,
  style_score: null,
} as const;

describe('WardrobeOutfitsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders in-page actions, summary counts, and rich outfit metadata', () => {
    useOutfitsMock.mockReturnValue({
      data: [
        baseOutfit,
        {
          ...baseOutfit,
          id: 'outfit-2',
          occasion: 'casual',
          saved: false,
          rating: null,
          planned_for: null,
        },
      ],
      isLoading: false,
    });

    render(<WardrobeOutfitsTab />);

    expect(screen.getByText('Styled outfits, kept close')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Style outfit' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open plan' })).toBeInTheDocument();
    expect(screen.getAllByText('All looks').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Saved').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Planned').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Wardrobe look').length).toBeGreaterThan(0);
    expect(screen.getByText('Work')).toBeInTheDocument();
    expect(screen.getByText('4/5')).toBeInTheDocument();
    expect(screen.getByText('Saved + planned')).toBeInTheDocument();
  });

  it('shows the planned filter empty state and lets the user recover to all looks', () => {
    useOutfitsMock.mockReturnValue({
      data: [
        {
          ...baseOutfit,
          planned_for: null,
        },
      ],
      isLoading: false,
    });

    render(<WardrobeOutfitsTab />);

    fireEvent.click(screen.getByRole('button', { name: /planned/i }));

    expect(screen.getByText('Nothing planned yet')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Open plan' }).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'Show all looks' }));

    expect(screen.getByTestId('outfit-preview-card')).toBeInTheDocument();
  });

  it('shows the primary empty state when no outfits exist', () => {
    useOutfitsMock.mockReturnValue({
      data: [],
      isLoading: false,
    });

    render(<WardrobeOutfitsTab />);

    expect(screen.getByText('No wardrobe looks yet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create outfit' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Open plan' }).length).toBeGreaterThan(0);
  });
});
