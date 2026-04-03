import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const invokeEdgeFunctionMock = vi.fn();
const generateOutfitMock = vi.fn();
const useOutfitMock = vi.fn();
const toastErrorMock = vi.fn();
const fromMock = vi.fn();

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => <div {...props}>{children}</div>,
    button: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => <button {...props}>{children}</button>,
    section: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => <section {...props}>{children}</section>,
  },
  useReducedMotion: () => true,
}));

vi.mock('sonner', () => ({ toast: { error: (...args: unknown[]) => toastErrorMock(...args) } }));
vi.mock('@/components/layout/AppLayout', () => ({ AppLayout: ({ children }: React.PropsWithChildren) => <div>{children}</div> }));
vi.mock('@/components/PaywallModal', () => ({ PaywallModal: () => null }));
vi.mock('@/components/ui/animated-page', () => ({ AnimatedPage: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => <div {...props}>{children}</div> }));
vi.mock('@/components/ui/OutfitPreviewCard', () => ({ OutfitPreviewCard: () => <div>outfit-preview</div> }));
vi.mock('@/components/layout/PageHeader', () => ({ PageHeader: ({ title }: { title: string }) => <div>{title}</div> }));
vi.mock('@/lib/haptics', () => ({ hapticLight: vi.fn() }));
vi.mock('@/hooks/useSubscription', () => ({ useSubscription: () => ({ isPremium: true }) }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'user-1' } }) }));
vi.mock('@/contexts/LanguageContext', () => ({ useLanguage: () => ({ t: (key: string) => key, locale: 'en' }) }));
vi.mock('@/hooks/useWeather', () => ({
  useWeather: () => ({
    weather: { temperature: 12, precipitation: 'none', wind: 'low' },
  }),
}));
vi.mock('@/hooks/useOutfitGenerator', () => ({
  useOutfitGenerator: () => ({ generateOutfit: generateOutfitMock }),
}));
vi.mock('@/hooks/useOutfits', () => ({
  useOutfit: (...args: unknown[]) => useOutfitMock(...args),
}));
vi.mock('@/lib/edgeFunctionClient', () => ({
  invokeEdgeFunction: (...args: unknown[]) => invokeEdgeFunctionMock(...args),
}));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (...args: unknown[]) => fromMock(...args),
  },
}));

import MoodOutfitPage from '../MoodOutfit';

function createOutfitsInsertResult() {
  return {
    insert: vi.fn().mockResolvedValue({ error: null }),
    delete: vi.fn(() => ({
      eq: vi.fn().mockResolvedValue({ error: null }),
    })),
  };
}

function createOutfitItemsInsertResult() {
  return {
    insert: vi.fn().mockResolvedValue({ error: null }),
  };
}

function createGarmentsQueryResult(garments: Array<Record<string, unknown>>) {
  return {
    select: vi.fn(() => ({
      eq: vi.fn().mockResolvedValue({
        data: garments,
        error: null,
      }),
    })),
  };
}

function renderMoodPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <MoodOutfitPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('MoodOutfitPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('mood-outfit-1');
    useOutfitMock.mockReturnValue({ data: { outfit_items: [] } });
    fromMock.mockImplementation((table: string) => {
      if (table === 'outfits') return createOutfitsInsertResult();
      if (table === 'outfit_items') return createOutfitItemsInsertResult();
      if (table === 'garments') return createGarmentsQueryResult([]);
      throw new Error(`Unexpected table: ${table}`);
    });
  });

  it('falls back to the general outfit generator only when the mood payload stays incomplete after repair', async () => {
    invokeEdgeFunctionMock.mockResolvedValue({
      data: {
        items: [{ garment_id: 'top-1', slot: 'top' }],
        explanation: 'Primary explanation',
        limitation_note: 'Need more structure',
      },
      error: null,
    });
    fromMock.mockImplementation((table: string) => {
      if (table === 'garments') {
        return createGarmentsQueryResult([
          { id: 'top-1', category: 'top', subcategory: 'shirt', wear_count: 1, layering_role: 'base', in_laundry: false },
        ]);
      }
      if (table === 'outfits') return createOutfitsInsertResult();
      if (table === 'outfit_items') return createOutfitItemsInsertResult();
      throw new Error(`Unexpected table: ${table}`);
    });
    generateOutfitMock.mockResolvedValue({
      id: 'fallback-outfit',
      explanation: 'Fallback explanation',
      items: [
        { slot: 'top', garment: { id: 'top-1' } },
        { slot: 'bottom', garment: { id: 'bottom-1' } },
        { slot: 'shoes', garment: { id: 'shoes-1' } },
      ],
    });

    renderMoodPage();

    fireEvent.click(screen.getByRole('button', { name: /ai\.mood_confident/i }));

    await waitFor(() => {
      expect(generateOutfitMock).toHaveBeenCalledWith({
        occasion: 'mood:confident',
        style: 'confident',
        locale: 'en',
        weather: {
          temperature: 12,
          precipitation: 'none',
          wind: 'low',
        },
      });
    });

    expect(await screen.findByText('Your look is ready')).toBeInTheDocument();
    expect(screen.getByText('Fallback explanation')).toBeInTheDocument();
    expect(screen.getByText(/general generator because the mood-specific response was incomplete/i)).toBeInTheDocument();
  });

  it('does not fall back when mood_outfit returns a backend error payload', async () => {
    invokeEdgeFunctionMock.mockResolvedValue({
      data: {
        error: 'Not enough garments to build a complete mood outfit. Missing: shoes',
        missing_slots: ['shoes'],
        limitation_note: 'No weather-appropriate shoes were available.',
      },
      error: null,
    });

    renderMoodPage();

    fireEvent.click(screen.getByRole('button', { name: /ai\.mood_confident/i }));

    await waitFor(() => {
      expect(generateOutfitMock).not.toHaveBeenCalled();
      expect(toastErrorMock).toHaveBeenCalledWith(
        'Not enough garments to build a complete mood outfit. Missing: shoes No weather-appropriate shoes were available.',
      );
    });
  });

  it('surfaces mood-specific match and limitation signals on successful mood generation', async () => {
    invokeEdgeFunctionMock.mockResolvedValue({
      data: {
        items: [
          { garment_id: 'top-1', slot: 'top' },
          { garment_id: 'bottom-1', slot: 'bottom' },
          { garment_id: 'shoes-1', slot: 'shoes' },
        ],
        explanation: 'A sharp tonal look.',
        mood_match_score: 92,
        limitation_note: 'No outerwear was added because the weather is mild.',
      },
      error: null,
    });

    renderMoodPage();

    fireEvent.click(screen.getByRole('button', { name: /ai\.mood_confident/i }));

    expect(await screen.findByText('A sharp tonal look.')).toBeInTheDocument();
    expect(screen.getByText('Mood match score: 92')).toBeInTheDocument();
    expect(screen.getByText('No outerwear was added because the weather is mild.')).toBeInTheDocument();
    expect(generateOutfitMock).not.toHaveBeenCalled();
  });
});
