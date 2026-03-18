import { describe, it, expect, vi, beforeEach } from 'vitest';
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

function renderNav(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <BottomNav />
    </MemoryRouter>,
  );
}

describe('BottomNav smoke', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders all 5 tab labels', () => {
    renderNav();
    expect(screen.getByText('nav.today')).toBeInTheDocument();
    expect(screen.getByText('nav.wardrobe')).toBeInTheDocument();
    expect(screen.getByText('nav.plan')).toBeInTheDocument();
    expect(screen.getByText('nav.stylist')).toBeInTheDocument();
    expect(screen.getByText('nav.insights')).toBeInTheDocument();
  });

  it('renders navigation landmark', () => {
    renderNav();
    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument();
  });

  it('marks active tab with accent color class', () => {
    renderNav('/wardrobe');
    const wardrobeLink = screen.getByText('nav.wardrobe').closest('a');
    expect(wardrobeLink?.className).toContain('text-accent');
  });
});
