import type { PropsWithChildren } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const navigateMock = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
    useLocation: () => ({ state: { mustHaveItems: ['g1'], destination: 'Tokyo' }, pathname: '/plan/pick-must-haves' }),
  };
});

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: (k: string) => k, locale: 'en' }),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1' } }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => Promise.resolve({
            data: [
              { id: 'g1', title: 'Blue tee', category: 'top', color_primary: 'blue', image_url: null },
              { id: 'g2', title: 'Black trousers', category: 'bottom', color_primary: 'black', image_url: null },
              { id: 'g3', title: 'White sneakers', category: 'shoes', color_primary: 'white', image_url: null },
            ],
            error: null,
          }),
        }),
      }),
    }),
  },
}));

vi.mock('@/components/layout/AppLayout', () => ({
  AppLayout: ({ children }: PropsWithChildren) => <div>{children}</div>,
}));

vi.mock('@/components/layout/PageHeader', () => ({
  PageHeader: ({ title, actions }: { title: string; actions?: React.ReactNode }) => (
    <div><h1>{title}</h1>{actions}</div>
  ),
}));

vi.mock('@/components/ui/animated-page', () => ({
  AnimatedPage: ({ children, className }: PropsWithChildren<{ className?: string }>) => (
    <div className={className}>{children}</div>
  ),
}));

vi.mock('@/components/ui/lazy-image', () => ({
  LazyImageSimple: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

vi.mock('@/components/ui/chip', () => ({
  Chip: ({ children, onClick, selected }: PropsWithChildren<{ onClick?: () => void; selected?: boolean }>) => (
    <button onClick={onClick} data-selected={selected}>{children}</button>
  ),
}));

vi.mock('@/lib/haptics', () => ({ hapticLight: vi.fn(), hapticSuccess: vi.fn() }));
vi.mock('@/lib/garmentImage', () => ({ getPreferredGarmentImagePath: () => null }));

import PickMustHaves from '../PickMustHaves';

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/plan/pick-must-haves']}>
        <PickMustHaves />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('PickMustHaves page', () => {
  beforeEach(() => {
    navigateMock.mockReset();
  });

  it('renders the editorial heading and filter chips', async () => {
    renderPage();
    await screen.findByText('Blue tee');
    expect(screen.getByText('pickmust.title')).toBeInTheDocument();
    expect(screen.getByText('filter.all')).toBeInTheDocument();
  });

  it('renders fetched garments in the grid', async () => {
    renderPage();
    expect(await screen.findByText('Blue tee')).toBeInTheDocument();
    expect(screen.getByText('Black trousers')).toBeInTheDocument();
    expect(screen.getByText('White sneakers')).toBeInTheDocument();
  });

  it('filters the visible garments by search input', async () => {
    renderPage();
    await screen.findByText('Blue tee');
    fireEvent.change(screen.getByPlaceholderText('wardrobe.search'), { target: { value: 'blue' } });
    expect(screen.getByText('Blue tee')).toBeInTheDocument();
    expect(screen.queryByText('Black trousers')).not.toBeInTheDocument();
  });

  it('toggles selection when a garment card is clicked and reveals the floating action bar', async () => {
    renderPage();
    const tee = await screen.findByText('Blue tee');
    fireEvent.click(tee.closest('button')!);
    // floating action button appears with count
    expect(screen.getAllByText(/capsule\.done/i).length).toBeGreaterThan(0);
  });

  it('navigates back to travel capsule with selected ids on done', async () => {
    renderPage();
    const tee = await screen.findByText('Blue tee');
    fireEvent.click(tee.closest('button')!);

    // Header "Done" button
    const doneButtons = screen.getAllByRole('button', { name: /capsule\.done/i });
    fireEvent.click(doneButtons[0]);

    expect(navigateMock).toHaveBeenCalledWith(
      '/plan/travel-capsule',
      expect.objectContaining({
        state: expect.objectContaining({
          destination: 'Tokyo',
          mustHaveItems: expect.any(Array),
        }),
        replace: true,
      }),
    );
  });
});
