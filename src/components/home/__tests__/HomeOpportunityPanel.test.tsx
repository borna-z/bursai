import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { HomeOpportunityPanel } from '../HomeOpportunityPanel';

const navigateMock = vi.fn();
const useWardrobeUnlocksMock = vi.fn();
const useAuthMock = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: (value: string, vars?: Record<string, string>) => {
      const translations: Record<string, string> = {
        'home.gaps.panel_kicker': 'Wardrobe intelligence',
        'home.gaps.title': 'Garment gaps',
        'home.gaps.locked_kicker': '{count} to unlock',
        'home.gaps.locked_desc': 'Reach 10 pieces and BURS will show which additions unlock the most new outfits.',
        'common.progress': 'Progress',
        'common.add_garments': 'Add garments',
        'home.gaps.ready_title': 'Run the full gap scan.',
        'home.gaps.ready_desc': 'Run the full scan in one place so results, refreshes, and shopping follow-up stay together.',
        'home.gaps.run_scan': 'Run scan',
        'home.gaps.open_full_scan': 'Open full scan',
        'home.gaps.top_unlock': 'Top unlock',
        'home.gaps.looks': 'looks',
        'home.gaps.more_ideas': '{count} more ideas',
        'home.gaps.complete_kicker': 'Balanced',
        'home.gaps.complete_title': 'No urgent gap right now.',
        'home.gaps.run_fresh_scan': 'Run fresh scan',
        'home.gaps.complete_desc': 'Your last scan came back balanced. Open the full scan to review it or rerun it after adding new pieces.',
      };
      const template = translations[value] ?? value;
      return vars
        ? Object.entries(vars).reduce((result, [key, replacement]) => result.replace(`{${key}}`, replacement), template)
        : template;
    },
  }),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock('@/hooks/useWardrobeUnlocks', () => ({
  useWardrobeUnlocks: () => useWardrobeUnlocksMock(),
}));

describe('HomeOpportunityPanel', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    window.sessionStorage.clear();
    useAuthMock.mockReturnValue({
      user: { id: 'user-1' },
    });
  });

  it('renders locked state before gap analysis unlocks', () => {
    useWardrobeUnlocksMock.mockReturnValue({
      isUnlocked: () => false,
      garmentsNeeded: 3,
      currentCount: 7,
    });

    render(<HomeOpportunityPanel />);

    expect(screen.getByTestId('home-opportunity-locked')).toBeInTheDocument();
    expect(screen.getByText('Garment gaps')).toBeInTheDocument();
    expect(screen.getByText(/3 to unlock/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Add garments'));
    expect(navigateMock).toHaveBeenCalledWith('/wardrobe/add');
  });

  it('renders ready state when scan is available', () => {
    useWardrobeUnlocksMock.mockReturnValue({
      isUnlocked: () => true,
      garmentsNeeded: 0,
      currentCount: 18,
    });

    render(<HomeOpportunityPanel />);

    expect(screen.getByTestId('home-opportunity-ready')).toBeInTheDocument();
    expect(screen.getByText('Run the full gap scan.')).toBeInTheDocument();
    expect(screen.getByText('Run scan')).toBeInTheDocument();
  });

  it('hydrates the latest saved gap summary and opens the full scan', () => {
    useWardrobeUnlocksMock.mockReturnValue({
      isUnlocked: () => true,
      garmentsNeeded: 0,
      currentCount: 18,
    });
    window.sessionStorage.setItem('burs:gaps:last-scan:user-1', JSON.stringify({
      analyzedAt: '2026-03-28T12:00:00.000Z',
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

    render(<HomeOpportunityPanel />);

    expect(screen.getByTestId('home-opportunity-results')).toBeInTheDocument();
    expect(screen.getByText('Structured overshirt')).toBeInTheDocument();
    expect(screen.getByText('$80-$140')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Open full scan/i }));

    expect(navigateMock).toHaveBeenCalledWith('/gaps');
  });

  it('shows the balanced complete state from an empty saved scan and can rerun the scan', () => {
    useWardrobeUnlocksMock.mockReturnValue({
      isUnlocked: () => true,
      garmentsNeeded: 0,
      currentCount: 18,
    });
    window.sessionStorage.setItem('burs:gaps:last-scan:user-1', JSON.stringify({
      analyzedAt: '2026-03-28T12:00:00.000Z',
      results: [],
    }));

    render(<HomeOpportunityPanel />);

    expect(screen.getByTestId('home-opportunity-complete')).toBeInTheDocument();
    expect(screen.getByText('No urgent gap right now.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Run fresh scan/i }));

    expect(navigateMock).toHaveBeenCalledWith('/gaps?autorun=1', {
      state: {
        autorun: true,
        source: 'home',
      },
    });
  });
});
