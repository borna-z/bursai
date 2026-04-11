import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const navigateMock = vi.fn();
const invalidateQueriesMock = vi.fn();
const useAuthMock = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
    useSearchParams: () => [new URLSearchParams(''), vi.fn()],
  };
});

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-query')>('@tanstack/react-query');
  return {
    ...actual,
    useQueryClient: () => ({
      invalidateQueries: invalidateQueriesMock,
    }),
  };
});

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string) => ({
      'billing.success_title': 'You are premium',
      'billing.success_desc': 'Thanks for supporting bursai.',
      'billing.start_using': 'Start using Burs',
      'billing.manage': 'Manage subscription',
      'premium.unlimited_wardrobe': 'Unlimited wardrobe',
      'pricing.unlimited_outfits': 'Unlimited outfits',
      'premium.smarter_ai': 'Smarter AI',
    }[key] ?? key),
    locale: 'en',
  }),
}));

vi.mock('@/lib/haptics', () => ({
  hapticLight: vi.fn(),
}));

import BillingSuccess from '../BillingSuccess';

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/billing/success']}>
        <BillingSuccess />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('BillingSuccess page', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    invalidateQueriesMock.mockReset();
    useAuthMock.mockReturnValue({ user: { id: 'user-1' }, session: {}, loading: false });
  });

  it('renders the success title and description', () => {
    renderPage();

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('You are premium');
    expect(screen.getByText('Thanks for supporting bursai.')).toBeInTheDocument();
  });

  it('lists the premium feature bullet points', () => {
    renderPage();

    expect(screen.getByText('Unlimited wardrobe')).toBeInTheDocument();
    expect(screen.getByText('Unlimited outfits')).toBeInTheDocument();
    expect(screen.getByText('Smarter AI')).toBeInTheDocument();
  });

  it('invalidates subscription queries on mount when a user is present', () => {
    renderPage();

    expect(invalidateQueriesMock).toHaveBeenCalledWith({ queryKey: ['subscription', 'user-1'] });
    expect(invalidateQueriesMock).toHaveBeenCalledWith({ queryKey: ['stripe-subscription', 'user-1'] });
  });

  it('does not invalidate queries when no user is present', () => {
    useAuthMock.mockReturnValue({ user: null, session: null, loading: false });

    renderPage();

    expect(invalidateQueriesMock).not.toHaveBeenCalled();
  });

  it('navigates home when start-using button is clicked', () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: /start using burs/i }));
    expect(navigateMock).toHaveBeenCalledWith('/');
  });

  it('navigates to settings when manage button is clicked', () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: /manage subscription/i }));
    expect(navigateMock).toHaveBeenCalledWith('/settings');
  });
});
