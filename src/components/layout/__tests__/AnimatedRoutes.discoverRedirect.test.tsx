import type { PropsWithChildren } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: PropsWithChildren) => <>{children}</>,
  motion: {
    div: ({ children, ...props }: PropsWithChildren<Record<string, unknown>>) => <div {...props}>{children}</div>,
  },
  useReducedMotion: () => false,
}));

vi.mock('@/components/auth/ProtectedRoute', () => ({
  ProtectedRoute: ({ children }: PropsWithChildren<{ skipOnboardingCheck?: boolean }>) => <>{children}</>,
}));

vi.mock('@/components/layout/BursLoadingScreen', () => ({
  BursLoadingScreen: () => <div data-testid="routes-loading">loading</div>,
}));

vi.mock('@/pages/GarmentGaps', () => ({
  default: () => <div data-testid="gaps-page">Gaps page</div>,
}));

import { AnimatedRoutes } from '../AnimatedRoutes';

function LocationProbe() {
  const location = useLocation();

  return (
    <div data-testid="location-probe">
      {`${location.pathname}${location.search}${location.hash}`}
    </div>
  );
}

function renderRoutes(initialEntry: string) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <LocationProbe />
      <AnimatedRoutes />
    </MemoryRouter>,
  );
}

describe('AnimatedRoutes discover redirect', () => {
  it('renders the canonical /gaps route', async () => {
    renderRoutes('/gaps');

    expect(await screen.findByTestId('gaps-page')).toBeInTheDocument();
    expect(screen.getByTestId('location-probe')).toHaveTextContent('/gaps');
  });

  it('redirects /discover to /gaps', async () => {
    renderRoutes('/discover');

    expect(await screen.findByTestId('gaps-page')).toBeInTheDocument();
    expect(screen.getByTestId('location-probe')).toHaveTextContent('/gaps');
  });
});
