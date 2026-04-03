import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const invokeEdgeFunctionMock = vi.fn();
const generateOutfitMock = vi.fn();
const useOutfitMock = vi.fn();

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => <div {...props}>{children}</div>,
    button: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => <button {...props}>{children}</button>,
    section: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => <section {...props}>{children}</section>,
  },
  useReducedMotion: () => true,
}));

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));
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

import MoodOutfitPage from '../MoodOutfit';

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
    useOutfitMock.mockReturnValue({ data: { outfit_items: [] } });
  });

  it('falls back to the general outfit generator when mood_outfit fails', async () => {
    invokeEdgeFunctionMock.mockResolvedValue({
      data: null,
      error: new Error('AI returned incomplete outfit'),
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
  });
});
