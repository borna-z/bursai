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

vi.mock('framer-motion', () => ({
  motion: {
    div: ({
      children,
      whileTap,
      transition,
      ...props
    }: PropsWithChildren<Record<string, unknown>>) => <div {...props}>{children}</div>,
  },
}));

vi.mock('@/components/layout/AppLayout', () => ({
  AppLayout: ({ children }: PropsWithChildren) => <div>{children}</div>,
}));

vi.mock('@/components/layout/BursLoadingScreen', () => ({
  BursLoadingScreen: () => <div data-testid="outfits-loading">loading</div>,
}));

vi.mock('@/components/onboarding/OnboardingEmptyState', () => ({
  OutfitsOnboardingEmpty: () => <div data-testid="outfits-empty">empty</div>,
}));

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string) => ({
      'occasion.work': 'Work',
    }[key] ?? key),
  }),
}));

vi.mock('@/hooks/useOutfits', () => ({
  useOutfits: (...args: unknown[]) => useOutfitsMock(...args),
}));

vi.mock('@/components/ui/OutfitComposition', () => ({
  OutfitComposition: ({
    items,
    className,
  }: {
    items?: Array<{ id?: string }> | null;
    className?: string;
  }) => (
    <div
      data-testid="outfits-page-composition"
      data-item-count={items?.length ?? 0}
      className={className}
    />
  ),
}));

import OutfitsPage from '../Outfits';

describe('Outfits page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the redesigned outfit preview card and opens the outfit detail', () => {
    useOutfitsMock.mockReturnValue({
      data: [{
        id: 'outfit-1',
        occasion: 'work',
        explanation: 'Soft tailoring with an easy finish for long office days and polished meetings.',
        outfit_items: [{ id: 'item-1' }, { id: 'item-2' }, { id: 'item-3' }],
      }],
      isLoading: false,
    });

    render(
      <MemoryRouter initialEntries={['/outfits']}>
        <OutfitsPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Your Looks' })).toBeInTheDocument();
    expect(screen.getByText('Work')).toBeInTheDocument();
    expect(screen.getByText(/^Soft tailoring with an easy finish for long office days and/)).toBeInTheDocument();
    expect(screen.getByTestId('outfits-page-composition')).toHaveAttribute('data-item-count', '3');

    fireEvent.click(screen.getByText('Work'));

    expect(navigateMock).toHaveBeenCalledWith('/outfits/outfit-1');
  });
});
