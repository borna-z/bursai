import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useFirstRunCoach } from '@/hooks/useFirstRunCoach';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: vi.fn(() => ({ t: (k: string) => k, locale: 'en' })),
}));

vi.mock('@/lib/haptics', () => ({
  hapticLight: vi.fn(),
}));

vi.mock('@/lib/routePrefetch', () => ({
  prefetchRoute: vi.fn(),
}));

vi.mock('@/hooks/useProfile', () => ({
  useProfile: vi.fn(() => ({
    data: null,
    isLoading: false,
  })),
  useUpdateProfile: vi.fn(() => ({
    mutateAsync: vi.fn(),
  })),
}));

vi.mock('@/hooks/useGarments', () => ({
  useGarmentCount: vi.fn(() => ({
    data: 0,
  })),
}));

vi.mock('@/hooks/useFirstRunCoach', () => ({
  useFirstRunCoach: vi.fn(() => ({
    isActive: false,
    currentStep: 0,
    hasEnoughGarments: false,
    isStepActive: vi.fn(() => false),
    advanceStep: vi.fn(),
    completeTour: vi.fn(),
  })),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    user: { id: 'u1' },
    session: {},
    loading: false,
  })),
}));

import { BottomNav } from '../BottomNav';

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => ({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    bottom: 44,
    right: 120,
    width: 120,
    height: 44,
    toJSON: () => ({}),
  }) as DOMRect);
});

afterEach(() => {
  vi.restoreAllMocks();
});

function renderNav(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <BottomNav />
    </MemoryRouter>,
  );
}

describe('BottomNav smoke', () => {
  it('renders the 5-slot dock labels', () => {
    renderNav();
    expect(screen.getByText('nav.today')).toBeInTheDocument();
    expect(screen.getByText('nav.wardrobe')).toBeInTheDocument();
    expect(screen.getByText('nav.plan')).toBeInTheDocument();
    expect(screen.getByText('nav.insights')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'nav.add' })).toBeInTheDocument();
  });

  it('renders navigation landmark', () => {
    renderNav();
    expect(screen.getByRole('navigation', { name: 'nav.main_navigation' })).toBeInTheDocument();
  });

  it('keeps safe-area spacing inside the dock container', () => {
    renderNav();
    const nav = screen.getByRole('navigation', { name: 'nav.main_navigation' });

    expect(nav.className).not.toContain('safe-bottom');
    const dock = nav.querySelector('.app-dock');
    expect(dock?.className).toContain('pointer-events-auto');
    expect(dock?.className).toContain('app-dock');
  });

  it('marks active tab with accent color class', () => {
    renderNav('/wardrobe');
    const wardrobeLink = screen.getByText('nav.wardrobe').closest('a');
    expect(wardrobeLink?.className).toContain('app-dock-tab-active');
  });

  it('does not show the wardrobe coach overlay once the wardrobe route is active', () => {
    vi.mocked(useFirstRunCoach).mockReturnValue({
      isActive: true,
      currentStep: 0,
      hasEnoughGarments: false,
      isStepActive: vi.fn(() => false),
      advanceStep: vi.fn(),
      completeTour: vi.fn(),
    });

    renderNav('/wardrobe');
    expect(screen.queryByRole('button', { name: 'coach.start_here_cta' })).not.toBeInTheDocument();
  });

  it('shows the wardrobe coach overlay on other routes when step 0 is active', async () => {
    vi.mocked(useFirstRunCoach).mockReturnValue({
      isActive: true,
      currentStep: 0,
      hasEnoughGarments: false,
      isStepActive: vi.fn((step: number) => step === 0),
      advanceStep: vi.fn(),
      completeTour: vi.fn(),
    });

    renderNav('/');
    expect(await screen.findByRole('button', { name: 'coach.start_here_cta' })).toBeInTheDocument();
  });

  it('opens the centered add sheet with the two wardrobe actions', () => {
    renderNav('/');

    fireEvent.click(screen.getByRole('button', { name: 'nav.add' }));

    expect(screen.getByText('Add to your wardrobe')).toBeInTheDocument();
    expect(screen.getByText('wardrobe.add')).toBeInTheDocument();
    expect(screen.getByText('wardrobe.live_scan')).toBeInTheDocument();
  });
});
