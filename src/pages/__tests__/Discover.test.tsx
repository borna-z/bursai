import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: (k: string) => ({
      'discover.title': 'Discover',
      'discover.subtitle_new': 'Explore your style',
      'discover.progress_heading': 'Progress',
    }[k] ?? k),
    locale: 'en',
  }),
}));

vi.mock('@/components/layout/AppLayout', () => ({
  AppLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/animated-page', () => ({
  AnimatedPage: ({ children, className }: { children: ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}));

vi.mock('@/components/discover/WardrobeProgress', () => ({
  WardrobeProgress: () => <div data-testid="wardrobe-progress">wardrobe progress</div>,
}));

vi.mock('@/components/discover/DiscoverStyleTools', () => ({
  DiscoverStyleTools: () => <div data-testid="style-tools">style tools</div>,
}));

vi.mock('@/components/discover/WardrobeGapSection', () => ({
  WardrobeGapSection: () => <div data-testid="gap-section">gap section</div>,
}));

import DiscoverPage from '../Discover';

describe('Discover page', () => {
  it('renders the page title and subtitle', () => {
    render(
      <MemoryRouter>
        <DiscoverPage />
      </MemoryRouter>,
    );
    expect(screen.getByText('Discover')).toBeInTheDocument();
    expect(screen.getByText('Explore your style')).toBeInTheDocument();
  });

  it('renders the progress heading', () => {
    render(
      <MemoryRouter>
        <DiscoverPage />
      </MemoryRouter>,
    );
    expect(screen.getByText('Progress')).toBeInTheDocument();
  });

  it('renders the DiscoverStyleTools section', () => {
    render(
      <MemoryRouter>
        <DiscoverPage />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('style-tools')).toBeInTheDocument();
  });

  it('renders the WardrobeGapSection', () => {
    render(
      <MemoryRouter>
        <DiscoverPage />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('gap-section')).toBeInTheDocument();
  });

  it('renders the WardrobeProgress component', () => {
    render(
      <MemoryRouter>
        <DiscoverPage />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('wardrobe-progress')).toBeInTheDocument();
  });
});
