import type { PropsWithChildren } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const navigateMock = vi.fn();
const useOutfitsMock = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: (k: string) => k, locale: 'en' }),
}));

vi.mock('@/hooks/useOutfits', () => ({
  useOutfits: () => useOutfitsMock(),
}));

vi.mock('@/components/layout/AppLayout', () => ({
  AppLayout: ({ children }: PropsWithChildren) => <div>{children}</div>,
}));

vi.mock('@/components/layout/BursLoadingScreen', () => ({
  BursLoadingScreen: () => <div data-testid="loading">loading</div>,
}));

vi.mock('@/components/onboarding/OnboardingEmptyState', () => ({
  OutfitsOnboardingEmpty: () => <div data-testid="empty">empty</div>,
}));

vi.mock('@/components/ui/OutfitPreviewCard', () => ({
  OutfitPreviewCard: ({ meta, excerpt }: { meta?: React.ReactNode; excerpt?: string }) => (
    <div data-testid="outfit-card">{meta}{excerpt}</div>
  ),
}));

vi.mock('@/components/ui/animated-page', () => ({
  AnimatedPage: ({ children, className }: PropsWithChildren<{ className?: string }>) => (
    <div className={className}>{children}</div>
  ),
}));

vi.mock('@/lib/haptics', () => ({ hapticLight: vi.fn() }));

import OutfitsPage from '../Outfits';

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/outfits']}>
      <OutfitsPage />
    </MemoryRouter>,
  );
}

describe('Outfits page', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    useOutfitsMock.mockReset();
  });

  it('shows the loading screen while fetching', () => {
    useOutfitsMock.mockReturnValue({ data: undefined, isLoading: true });
    renderPage();
    expect(screen.getByTestId('loading')).toBeInTheDocument();
  });

  it('shows onboarding empty state when there are no outfits', () => {
    useOutfitsMock.mockReturnValue({ data: [], isLoading: false });
    renderPage();
    expect(screen.getByTestId('empty')).toBeInTheDocument();
  });

  it('renders a list of outfits and navigates on click', () => {
    useOutfitsMock.mockReturnValue({
      data: [
        { id: 'o1', occasion: 'casual', explanation: 'light layered look', created_at: '2026-03-30', outfit_items: [] },
        { id: 'o2', occasion: 'work', explanation: null, created_at: '2026-03-25', outfit_items: [] },
      ],
      isLoading: false,
    });
    renderPage();
    const cards = screen.getAllByTestId('outfit-card');
    expect(cards.length).toBe(2);

    fireEvent.click(cards[0]);
    expect(navigateMock).toHaveBeenCalledWith('/outfits/o1');
  });

  it('routes to the generator from the header action', () => {
    useOutfitsMock.mockReturnValue({
      data: [
        { id: 'o1', occasion: 'casual', explanation: 'x', created_at: '2026-03-30', outfit_items: [] },
      ],
      isLoading: false,
    });
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /outfits\.generate_look/i }));
    expect(navigateMock).toHaveBeenCalledWith('/ai/generate');
  });

  it('filters to only outfits with notes', () => {
    useOutfitsMock.mockReturnValue({
      data: [
        { id: 'o1', occasion: 'casual', explanation: 'a note', created_at: '2026-03-30', outfit_items: [] },
        { id: 'o2', occasion: 'work', explanation: null, created_at: '2026-03-25', outfit_items: [] },
      ],
      isLoading: false,
    });
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /outfits\.filter_with_notes/i }));
    const cards = screen.getAllByTestId('outfit-card');
    expect(cards.length).toBe(1);
  });
});
