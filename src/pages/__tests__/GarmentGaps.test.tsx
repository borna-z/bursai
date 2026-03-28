import type { PropsWithChildren } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import GarmentGapsPage from '../GarmentGaps';

const navigateMock = vi.fn();
const useAuthMock = vi.fn();
const useGarmentCountMock = vi.fn();
const useWardrobeUnlocksMock = vi.fn();
const useWardrobeGapAnalysisMock = vi.fn();

vi.mock('framer-motion', () => {
  const motionElement = ({ children, ...props }: PropsWithChildren<Record<string, unknown>>) => (
    <div {...props}>{children}</div>
  );

  return {
    AnimatePresence: ({ children }: PropsWithChildren) => <>{children}</>,
    motion: new Proxy({}, { get: () => motionElement }),
  };
});

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ locale: 'en', t: (value: string) => value }),
}));

vi.mock('@/components/layout/AppLayout', () => ({
  AppLayout: ({ children }: PropsWithChildren) => <div>{children}</div>,
}));

vi.mock('@/components/ui/animated-page', () => ({
  AnimatedPage: ({ children, ...props }: PropsWithChildren<Record<string, unknown>>) => (
    <div {...props}>{children}</div>
  ),
}));

vi.mock('@/components/discover/WardrobeProgress', () => ({
  WardrobeProgress: () => <div data-testid="wardrobe-progress">Wardrobe progress</div>,
}));

vi.mock('@/components/ui/AILoadingOverlay', () => ({
  AILoadingOverlay: () => <div data-testid="ai-loading-overlay">Loading overlay</div>,
}));

vi.mock('@/components/ui/StaleIndicator', () => ({
  StaleIndicator: ({ updatedAt }: { updatedAt: string | null }) => (
    <div data-testid="stale-indicator">{updatedAt ?? 'none'}</div>
  ),
}));

vi.mock('@/hooks/useGarments', () => ({
  useGarmentCount: () => useGarmentCountMock(),
}));

vi.mock('@/hooks/useWardrobeUnlocks', () => ({
  useWardrobeUnlocks: () => useWardrobeUnlocksMock(),
}));

vi.mock('@/hooks/useAdvancedFeatures', () => ({
  useWardrobeGapAnalysis: () => useWardrobeGapAnalysisMock(),
}));

vi.mock('@/lib/haptics', () => ({
  hapticSuccess: vi.fn(),
}));

function renderPage(initialEntry = '/gaps') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <GarmentGapsPage />
    </MemoryRouter>,
  );
}

describe('GarmentGapsPage', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    useAuthMock.mockReturnValue({
      user: { id: 'user-1' },
    });
    useGarmentCountMock.mockReturnValue({
      data: 14,
    });
    useWardrobeUnlocksMock.mockReturnValue({
      isUnlocked: (feature: string) => feature === 'gap_analysis',
    });
    useWardrobeGapAnalysisMock.mockReturnValue({
      isPending: false,
      isError: false,
      mutateAsync: vi.fn(),
    });
    window.sessionStorage.clear();
  });

  it('renders the ready state when unlocked and no snapshot exists', () => {
    renderPage();

    expect(screen.getByRole('heading', { level: 1, name: 'gaps.garment_gaps' })).toBeInTheDocument();
    expect(screen.getByText('gaps.ready_title')).toBeInTheDocument();
    expect(screen.getByText('gaps.pieces_in_wardrobe')).toBeInTheDocument();
  });

  it('hydrates the last saved snapshot for the current user', () => {
    window.sessionStorage.setItem('burs:gaps:last-scan:user-1', JSON.stringify({
      analyzedAt: '2026-03-28T00:00:00.000Z',
      results: [
        {
          item: 'Structured overshirt',
          category: 'outerwear',
          color: 'navy',
          reason: 'Bridges your casual and polished looks.',
          new_outfits: 6,
          price_range: '$80-$140',
          search_query: 'navy structured overshirt',
        },
      ],
    }));

    renderPage();

    expect(screen.getByText('gaps.results_title')).toBeInTheDocument();
    expect(screen.getByText('Structured overshirt')).toBeInTheDocument();
  });

  it('kicks off autorun scans and strips the query marker', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({
      gaps: [
        {
          item: 'Structured overshirt',
          category: 'outerwear',
          color: 'navy',
          reason: 'Bridges your casual and polished looks.',
          new_outfits: 6,
          price_range: '$80-$140',
          search_query: 'navy structured overshirt',
        },
      ],
    });

    useWardrobeGapAnalysisMock.mockReturnValue({
      isPending: false,
      isError: false,
      mutateAsync,
    });

    renderPage('/gaps?autorun=1');

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({ locale: 'en' });
    });

    expect(navigateMock).toHaveBeenCalledWith('/gaps', {
      replace: true,
      state: { source: 'gaps' },
    });

    expect(await screen.findByText('Structured overshirt')).toBeInTheDocument();
  });

  it('shows the error state when no scan result exists and the mutation errors', () => {
    useWardrobeGapAnalysisMock.mockReturnValue({
      isPending: false,
      isError: true,
      mutateAsync: vi.fn(),
    });

    renderPage();

    expect(screen.getByText('gaps.error_title')).toBeInTheDocument();
    expect(screen.getByText('gaps.retry_scan')).toBeInTheDocument();
  });
});
