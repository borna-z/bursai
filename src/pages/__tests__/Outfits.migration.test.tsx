import type { PropsWithChildren } from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/hooks/useOutfits', () => ({
  useOutfits: () => ({ data: [], isLoading: false, error: null }),
}));

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: (k: string) => k, locale: 'en' }),
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
  OutfitPreviewCard: () => <div data-testid="outfit-card" />,
}));

vi.mock('@/components/ui/animated-page', () => ({
  AnimatedPage: ({ children, className }: PropsWithChildren<{ className?: string }>) => (
    <div className={className}>{children}</div>
  ),
}));

vi.mock('@/lib/haptics', () => ({ hapticLight: vi.fn() }));

import Outfits from '../Outfits';

describe('Outfits PageHeader migration', () => {
  it('renders a canonical PageHeader element', () => {
    const { container } = render(
      <MemoryRouter>
        <Outfits />
      </MemoryRouter>,
    );
    const header = container.querySelector('header[data-variant]');
    expect(header).not.toBeNull();
  });

  it('does not use the legacy -mx-5 negative-margin hack on the header', () => {
    const { container } = render(
      <MemoryRouter>
        <Outfits />
      </MemoryRouter>,
    );
    const header = container.querySelector('header');
    expect(header?.className ?? '').not.toContain('-mx-5');
  });
});
