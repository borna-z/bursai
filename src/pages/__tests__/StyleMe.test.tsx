import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { RouterProvider, createMemoryRouter, useLocation } from 'react-router-dom';

vi.mock('@/components/layout/AppLayout', () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/skeletons', () => ({
  ChatPageSkeleton: () => <div data-testid="chat-page-skeleton" />,
}));

function LocationProbe() {
  const location = useLocation();
  return (
    <div>
      <div data-testid="pathname">{location.pathname}</div>
      <div data-testid="search">{location.search}</div>
      <div data-testid="state">{JSON.stringify(location.state)}</div>
    </div>
  );
}

describe('StyleMe', () => {
  it('redirects /ai to /ai/generate while preserving search and route state', async () => {
    const StyleMe = (await import('../StyleMe')).default;
    const router = createMemoryRouter(
      [
        { path: '/ai', element: <StyleMe /> },
        { path: '/ai/generate', element: <LocationProbe /> },
      ],
      {
        initialEntries: [{
          pathname: '/ai',
          search: '?garments=g-1%2Cg-2',
          state: { prefillMessage: 'Refine this outfit for me.' },
        }],
      },
    );

    render(<RouterProvider router={router} />);

    await waitFor(() => {
      expect(screen.getByTestId('pathname')).toHaveTextContent('/ai/generate');
    });

    expect(screen.getByTestId('search')).toHaveTextContent('?garments=g-1%2Cg-2');
    expect(screen.getByTestId('state')).toHaveTextContent('Refine this outfit for me.');
  });
});
