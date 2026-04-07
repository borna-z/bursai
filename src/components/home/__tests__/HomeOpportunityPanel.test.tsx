import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { HomeOpportunityPanel } from '../HomeOpportunityPanel';

const navigateMock = vi.fn();
const mutateAsyncMock = vi.fn();
const useWardrobeUnlocksMock = vi.fn();
const useWardrobeGapAnalysisMock = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ locale: 'en', t: (value: string) => value }),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'test-user-id' } }),
}));

vi.mock('@/hooks/useWardrobeUnlocks', () => ({
  useWardrobeUnlocks: () => useWardrobeUnlocksMock(),
}));

vi.mock('@/hooks/useAdvancedFeatures', () => ({
  useWardrobeGapAnalysis: () => useWardrobeGapAnalysisMock(),
}));

describe('HomeOpportunityPanel', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    mutateAsyncMock.mockReset();
  });

  it('renders locked state before gap analysis unlocks', () => {
    useWardrobeUnlocksMock.mockReturnValue({
      isUnlocked: () => false,
      garmentsNeeded: 3,
      currentCount: 7,
    });
    useWardrobeGapAnalysisMock.mockReturnValue({
      isPending: false,
      isError: false,
      mutateAsync: mutateAsyncMock,
    });

    render(<HomeOpportunityPanel />);

    expect(screen.getByTestId('home-opportunity-locked')).toBeInTheDocument();
    expect(screen.getByText('home.opportunity_to_unlock')).toBeInTheDocument();
    fireEvent.click(screen.getByText('home.opportunity_add_garments'));
    expect(navigateMock).toHaveBeenCalledWith('/wardrobe/add');
  });

  it('renders ready state when scan is available', () => {
    useWardrobeUnlocksMock.mockReturnValue({
      isUnlocked: () => true,
      garmentsNeeded: 0,
      currentCount: 18,
    });
    useWardrobeGapAnalysisMock.mockReturnValue({
      isPending: false,
      isError: false,
      mutateAsync: mutateAsyncMock,
    });

    render(<HomeOpportunityPanel />);

    expect(screen.getByTestId('home-opportunity-ready')).toBeInTheDocument();
    expect(screen.getByText('home.opportunity_run_scan')).toBeInTheDocument();
  });

  it('renders populated result summary after a successful scan', async () => {
    useWardrobeUnlocksMock.mockReturnValue({
      isUnlocked: () => true,
      garmentsNeeded: 0,
      currentCount: 18,
    });
    mutateAsyncMock.mockResolvedValue({
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
      mutateAsync: mutateAsyncMock,
    });

    render(<HomeOpportunityPanel />);
    fireEvent.click(screen.getByText('home.opportunity_run_scan'));

    await waitFor(() => {
      expect(screen.getByTestId('home-opportunity-results')).toBeInTheDocument();
    });

    expect(screen.getByText('Structured overshirt')).toBeInTheDocument();
    expect(screen.getByText(/home\.opportunity_looks/)).toBeInTheDocument();
  });
});
