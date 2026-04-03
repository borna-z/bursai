import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import { PageHeader } from '@/components/layout/PageHeader';

vi.mock('framer-motion', () => ({
  motion: {
    h1: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => <h1 {...props}>{children}</h1>,
  },
  AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

vi.mock('@/lib/haptics', () => ({
  hapticLight: vi.fn(),
}));

describe('PageHeader', () => {
  it('renders as an in-flow header when sticky is false', () => {
    const { container } = render(
      <MemoryRouter>
        <PageHeader title="Wardrobe" sticky={false} />
      </MemoryRouter>,
    );

    const header = container.querySelector('header');
    expect(header?.className).not.toContain('topbar-frost');
    expect(header?.className).not.toContain('sticky');
    expect(screen.getByRole('heading', { level: 1, name: 'Wardrobe' })).toBeInTheDocument();
  });

  it('keeps the frosted sticky treatment when sticky is true', () => {
    const { container } = render(
      <MemoryRouter>
        <PageHeader title="Plan" sticky />
      </MemoryRouter>,
    );

    const header = container.querySelector('header');
    expect(header?.className).toContain('topbar-frost');
    expect(header?.className).toContain('sticky');
  });
});
