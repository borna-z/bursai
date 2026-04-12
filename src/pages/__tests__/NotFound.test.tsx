import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const navigateMock = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('@/lib/logger', () => ({ logger: { warn: vi.fn() } }));
vi.mock('@/lib/haptics', () => ({ hapticLight: vi.fn() }));

vi.mock('@/components/ui/animated-page', () => ({
  AnimatedPage: ({ children, className }: { children: ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}));

import NotFound from '../NotFound';

describe('NotFound page', () => {
  it('renders 404 heading and description', () => {
    render(
      <MemoryRouter initialEntries={['/bogus']}>
        <NotFound />
      </MemoryRouter>,
    );
    expect(screen.getByText('404')).toBeInTheDocument();
    expect(screen.getByText('Page not found')).toBeInTheDocument();
  });

  it('navigates home when the return button is clicked', () => {
    render(
      <MemoryRouter initialEntries={['/bogus']}>
        <NotFound />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByText('Return to Home'));
    expect(navigateMock).toHaveBeenCalledWith('/');
  });
});
