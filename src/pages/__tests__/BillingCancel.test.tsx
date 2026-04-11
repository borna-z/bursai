import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const navigateMock = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string) => ({
      'billing.cancel_title': 'Checkout cancelled',
      'billing.cancel_desc': 'No charge was made.',
      'billing.cancel_contact': 'Questions? Reach out any time.',
      'billing.back_to_app': 'Back to app',
    }[key] ?? key),
    locale: 'en',
  }),
}));

vi.mock('@/lib/haptics', () => ({
  hapticLight: vi.fn(),
}));

import BillingCancel from '../BillingCancel';

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/billing/cancel']}>
      <BillingCancel />
    </MemoryRouter>,
  );
}

describe('BillingCancel page', () => {
  beforeEach(() => {
    navigateMock.mockReset();
  });

  it('renders the cancelled title and description', () => {
    renderPage();

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Checkout cancelled');
    expect(screen.getByText('No charge was made.')).toBeInTheDocument();
  });

  it('shows the contact message', () => {
    renderPage();

    expect(screen.getByText('Questions? Reach out any time.')).toBeInTheDocument();
  });

  it('renders a back-to-app button', () => {
    renderPage();

    expect(screen.getByRole('button', { name: /back to app/i })).toBeInTheDocument();
  });

  it('navigates home when the back button is clicked', () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: /back to app/i }));
    expect(navigateMock).toHaveBeenCalledWith('/');
  });

  it('does not auto-navigate on mount', () => {
    renderPage();

    expect(navigateMock).not.toHaveBeenCalled();
  });
});
