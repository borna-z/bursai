import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const navigateMock = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');

  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string) => ({
      'billing.success_title': 'Upgrade complete',
      'billing.success_desc': 'Premium is now active on your account.',
      'premium.unlimited_wardrobe': 'Unlimited wardrobe',
      'pricing.unlimited_outfits': 'Unlimited outfits',
      'premium.smarter_ai': 'Smarter AI',
      'billing.start_using': 'Start using BURS',
      'billing.manage': 'Manage billing',
      'billing.cancel_title': 'Checkout cancelled',
      'billing.cancel_desc': 'Your plan did not change.',
      'billing.cancel_contact': 'Need help? Contact support.',
      'billing.back_to_app': 'Back to app',
    }[key] ?? key),
  }),
}));

import BillingCancel from '../BillingCancel';
import BillingSuccess from '../BillingSuccess';

function renderBillingSuccess() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/billing/success?session_id=test']}>
        <BillingSuccess />
      </MemoryRouter>
    </QueryClientProvider>,
  );

  return { invalidateQueriesSpy };
}

function renderBillingCancel() {
  render(
    <MemoryRouter initialEntries={['/billing/cancel']}>
      <BillingCancel />
    </MemoryRouter>,
  );
}

describe('Billing pages', () => {
  beforeEach(() => {
    navigateMock.mockReset();
  });

  it('smoke-tests the billing success page and refreshes subscription queries', async () => {
    const { invalidateQueriesSpy } = renderBillingSuccess();

    expect(screen.getByText('Upgrade complete')).toBeInTheDocument();
    expect(screen.getByText('Premium is now active on your account.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start using BURS' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Manage billing' })).toBeInTheDocument();

    await waitFor(() => {
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['subscription', 'user-1'] });
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['stripe-subscription', 'user-1'] });
    });
  });

  it('smoke-tests the billing cancel page and preserves the return action', () => {
    renderBillingCancel();

    expect(screen.getByText('Checkout cancelled')).toBeInTheDocument();
    expect(screen.getByText('Your plan did not change.')).toBeInTheDocument();

    screen.getByRole('button', { name: 'Back to app' }).click();

    expect(navigateMock).toHaveBeenCalledWith('/');
  });
});
