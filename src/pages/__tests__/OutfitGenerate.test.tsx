import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const navigateMock = vi.fn();
const generateOutfitMock = vi.fn();
const generateOutfitCandidatesMock = vi.fn();
const canCreateOutfitMock = vi.fn();
const isUnlockedMock = vi.fn();
const useFlatGarmentsMock = vi.fn();
const useGarmentsByIdsMock = vi.fn();
const useWeatherMock = vi.fn();
const useCalendarEventsMock = vi.fn();
const updateOutfitMutateAsync = vi.fn();
const markWornMutateAsync = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
    useLocation: () => ({ pathname: '/ai/generate', search: '', state: null }),
  };
});

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: (k: string) => k,
    locale: 'en',
  }),
}));

vi.mock('@/hooks/useOutfitGenerator', () => ({
  useOutfitGenerator: () => ({
    generateOutfit: generateOutfitMock,
    generateOutfitCandidates: generateOutfitCandidatesMock,
    isGenerating: false,
  }),
}));

vi.mock('@/hooks/useWardrobeUnlocks', () => ({
  useWardrobeUnlocks: () => ({ isUnlocked: isUnlockedMock }),
}));

vi.mock('@/hooks/useWeather', () => ({
  useWeather: () => useWeatherMock(),
}));

vi.mock('@/hooks/useCalendarSync', () => ({
  useCalendarEvents: () => useCalendarEventsMock(),
}));

vi.mock('@/hooks/useSubscription', () => ({
  useSubscription: () => ({
    canCreateOutfit: canCreateOutfitMock,
    isPremium: false,
  }),
}));

vi.mock('@/hooks/useGarments', async () => {
  const actual = await vi.importActual<typeof import('@/hooks/useGarments')>('@/hooks/useGarments');
  return {
    ...actual,
    useFlatGarments: () => useFlatGarmentsMock(),
  };
});

vi.mock('@/hooks/useGarmentsByIds', () => ({
  useGarmentsByIds: () => useGarmentsByIdsMock(),
}));

vi.mock('@/hooks/useOutfits', () => ({
  useUpdateOutfit: () => ({ mutateAsync: updateOutfitMutateAsync, isPending: false }),
  useMarkOutfitWorn: () => ({ mutateAsync: markWornMutateAsync, isPending: false }),
}));

vi.mock('@/hooks/useSignedUrlCache', () => ({
  useCachedSignedUrl: () => ({ signedUrl: null, setRef: vi.fn() }),
}));

vi.mock('@/components/layout/AppLayout', () => ({
  AppLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/layout/PageErrorBoundary', () => ({
  PageErrorBoundary: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/OutfitGenerationState', () => ({
  OutfitGenerationState: () => <div>generation-state</div>,
}));

vi.mock('@/components/discover/WardrobeProgress', () => ({
  WardrobeProgress: ({ message }: { message: string }) => <div data-testid="wardrobe-progress">{message}</div>,
}));

vi.mock('@/components/outfit/OutfitGeneratePicker', () => ({
  OutfitGeneratePicker: ({
    onGenerate,
    isGenerating,
    showPaywall,
  }: {
    onGenerate: () => void;
    isGenerating: boolean;
    showPaywall: boolean;
  }) => (
    <div data-testid="picker">
      <button onClick={onGenerate} disabled={isGenerating}>Generate</button>
      {showPaywall && <div data-testid="paywall">paywall</div>}
    </div>
  ),
  OCCASIONS: [
    { key: 'casual', label: 'Casual' },
    { key: 'work', label: 'Work' },
  ],
  STYLES: ['minimal', 'classic'],
}));

vi.mock('@/components/outfit/OutfitGenerateResult', () => ({
  OutfitGenerateResult: ({
    primary,
    onRegenerate,
  }: {
    primary: { id: string };
    onRegenerate: () => void;
  }) => (
    <div data-testid="result">
      <span data-testid="primary-id">{primary.id}</span>
      <button onClick={onRegenerate}>regenerate</button>
    </div>
  ),
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('@/lib/haptics', () => ({
  hapticLight: vi.fn(),
}));

vi.mock('@/lib/analytics', () => ({
  trackEvent: vi.fn(),
}));

vi.mock('@/lib/dayIntelligence', () => ({
  buildDayIntelligence: vi.fn(() => null),
}));

import OutfitGeneratePage from '../OutfitGenerate';

function buildOutfit(id = 'outfit-1') {
  return {
    id,
    occasion: 'casual',
    style_vibe: null,
    explanation: 'A calm neutral look.',
    weather: { precipitation: 'none', wind: 'low' },
    items: [
      { slot: 'top', garment: { id: 'g-top', title: 'Top', category: 'top' } },
      { slot: 'bottom', garment: { id: 'g-bottom', title: 'Bottom', category: 'bottom' } },
      { slot: 'shoes', garment: { id: 'g-shoes', title: 'Shoes', category: 'shoes' } },
    ],
    outfit_reasoning: { why_it_works: 'Balanced silhouette.' },
  };
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/ai/generate']}>
        <OutfitGeneratePage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('OutfitGenerate page', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    generateOutfitMock.mockReset();
    generateOutfitCandidatesMock.mockReset();
    canCreateOutfitMock.mockReset();
    canCreateOutfitMock.mockReturnValue(true);
    isUnlockedMock.mockReset();
    isUnlockedMock.mockReturnValue(true);
    useFlatGarmentsMock.mockReturnValue({ data: [] });
    useGarmentsByIdsMock.mockReturnValue({ data: [] });
    useWeatherMock.mockReturnValue({ weather: { temperature: 18, precipitation: 'none', wind: 'low' } });
    useCalendarEventsMock.mockReturnValue({ data: [] });
    updateOutfitMutateAsync.mockReset();
    markWornMutateAsync.mockReset();
    try {
      localStorage.clear();
    } catch {
      /* ignore */
    }
  });

  it('renders the picker in the initial picking phase', () => {
    renderPage();

    expect(screen.getByTestId('picker')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /generate/i })).toBeInTheDocument();
  });

  it('shows the wardrobe gate when the outfit feature is locked', () => {
    isUnlockedMock.mockReturnValue(false);

    renderPage();

    expect(screen.getByTestId('wardrobe-progress')).toBeInTheDocument();
    expect(screen.queryByTestId('picker')).not.toBeInTheDocument();
  });

  it('renders the result after a successful generation', async () => {
    generateOutfitMock.mockResolvedValue(buildOutfit('outfit-success'));

    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /generate/i }));

    await waitFor(() => {
      expect(screen.getByTestId('result')).toBeInTheDocument();
    });
    expect(screen.getByTestId('primary-id')).toHaveTextContent('outfit-success');
    expect(generateOutfitMock).toHaveBeenCalledTimes(1);
  });

  it('shows the paywall instead of generating when the limit is reached', () => {
    canCreateOutfitMock.mockReturnValue(false);

    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /generate/i }));

    expect(screen.getByTestId('paywall')).toBeInTheDocument();
    expect(generateOutfitMock).not.toHaveBeenCalled();
  });

  it('shows the error phase when generation throws', async () => {
    generateOutfitMock.mockRejectedValue(new Error('boom'));

    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /generate/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument();
  });

  it('returns to the picking phase when the error back button is pressed', async () => {
    generateOutfitMock.mockRejectedValue(new Error('boom'));

    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /generate/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(screen.getByTestId('picker')).toBeInTheDocument();
  });

  it('re-invokes the generator when regenerate is pressed from the result', async () => {
    generateOutfitMock.mockResolvedValue(buildOutfit('outfit-first'));

    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /generate/i }));

    await waitFor(() => {
      expect(screen.getByTestId('result')).toBeInTheDocument();
    });

    generateOutfitMock.mockResolvedValueOnce(buildOutfit('outfit-second'));
    fireEvent.click(screen.getByRole('button', { name: /regenerate/i }));

    await waitFor(() => {
      expect(generateOutfitMock).toHaveBeenCalledTimes(2);
    });
  });

  it('surfaces the recovery message when the generator returns an incomplete outfit', async () => {
    generateOutfitMock.mockResolvedValue({
      id: 'incomplete',
      occasion: 'casual',
      style_vibe: null,
      explanation: '',
      weather: { precipitation: 'none', wind: 'low' },
      items: [{ slot: 'top', garment: { id: 'g', title: 'Top', category: 'top' } }],
    });

    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /generate/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });
  });
});
