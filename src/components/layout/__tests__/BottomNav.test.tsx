import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useFirstRunCoach } from '@/hooks/useFirstRunCoach';
import { render, screen } from '@testing-library/react';
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
  it('renders all primary destinations including insights', () => {
    renderNav();
    expect(screen.getByText('Today')).toBeInTheDocument();
    expect(screen.getByText('Wardrobe')).toBeInTheDocument();
    expect(screen.getByText('Plan')).toBeInTheDocument();
    expect(screen.getByLabelText('Style Me')).toBeInTheDocument();
    expect(screen.getByText('Insights')).toBeInTheDocument();
  });

  it('renders navigation landmark', () => {
    renderNav();
    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument();
  });

  it('keeps safe-area spacing separate from the centered nav row', () => {
    const { container } = renderNav();
    const nav = screen.getByRole('navigation', { name: 'Main navigation' });

    expect(nav.className).not.toContain('safe-bottom');
    expect(container.querySelector('[aria-hidden="true"].safe-bottom')).toBeInTheDocument();
  });

  it('marks active tab with the active foreground treatment', () => {
    renderNav('/wardrobe');
    const wardrobeLink = screen.getByText('Wardrobe').closest('a');
    expect(wardrobeLink?.className).toContain('text-foreground');
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
    expect(screen.queryByRole('button', { name: /take me there/i })).not.toBeInTheDocument();
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
    expect(await screen.findByRole('button', { name: /take me there/i })).toBeInTheDocument();
  });
});
