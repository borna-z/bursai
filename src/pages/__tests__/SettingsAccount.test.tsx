import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const {
  navigateMock,
  signOutMock,
  mutateAsyncMock,
  invokeEdgeFunctionMock,
  toastSuccessMock,
  toastErrorMock,
} = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  signOutMock: vi.fn().mockResolvedValue(undefined),
  mutateAsyncMock: vi.fn().mockResolvedValue({}),
  invokeEdgeFunctionMock: vi.fn().mockResolvedValue({ data: { success: true }, error: null }),
  toastSuccessMock: vi.fn(),
  toastErrorMock: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});

vi.mock('sonner', () => ({
  toast: { success: toastSuccessMock, error: toastErrorMock },
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'u1', email: 'test@example.com' },
    signOut: signOutMock,
    loading: false,
  }),
}));

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: (k: string) => k, locale: 'en', setLocale: vi.fn() }),
}));

vi.mock('@/hooks/useProfile', () => ({
  useProfile: () => ({ data: { id: 'u1', display_name: 'Test User', preferences: {} }, isLoading: false }),
  useUpdateProfile: () => ({ mutateAsync: mutateAsyncMock, isPending: false }),
}));

vi.mock('@/hooks/useSubscription', () => ({
  useSubscription: () => ({ subscription: null, isPremium: false, limits: { garments: 10 }, isLoading: false }),
}));

vi.mock('@/lib/edgeFunctionClient', () => ({
  invokeEdgeFunction: invokeEdgeFunctionMock,
}));

vi.mock('@/lib/haptics', () => ({ hapticLight: vi.fn() }));

vi.mock('@/components/layout/AppLayout', () => ({
  AppLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/components/layout/PageHeader', () => ({
  PageHeader: ({ title }: { title: string }) => <header>{title}</header>,
}));
vi.mock('@/components/ui/animated-page', () => ({
  AnimatedPage: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/components/PremiumSection', () => ({
  PremiumSection: () => <div data-testid="premium-section" />,
}));

vi.mock('@/components/ui/alert-dialog', () => {
  const Pass = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return {
    AlertDialog: Pass,
    AlertDialogTrigger: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    AlertDialogContent: Pass,
    AlertDialogHeader: Pass,
    AlertDialogFooter: Pass,
    AlertDialogTitle: Pass,
    AlertDialogDescription: Pass,
    AlertDialogAction: ({ children, onClick }: { children?: ReactNode; onClick?: () => void }) => (
      <button onClick={onClick}>{children}</button>
    ),
    AlertDialogCancel: ({ children }: { children?: ReactNode }) => <button>{children}</button>,
  };
});

import SettingsAccount from '../settings/SettingsAccount';

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <SettingsAccount />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('SettingsAccount', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    signOutMock.mockClear();
    mutateAsyncMock.mockReset().mockResolvedValue({});
    invokeEdgeFunctionMock.mockReset().mockResolvedValue({ data: { success: true }, error: null });
    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();
  });

  it('renders the user email from auth', () => {
    renderPage();
    expect(screen.getByText('test@example.com')).toBeInTheDocument();
  });

  it('pre-fills display name from profile', () => {
    renderPage();
    const input = screen.getByPlaceholderText('settings.your_name') as HTMLInputElement;
    expect(input.value).toBe('Test User');
  });

  it('saves display name via updateProfile', async () => {
    renderPage();
    fireEvent.click(screen.getByText('settings.save'));
    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalledWith({ display_name: 'Test User' });
    });
    expect(toastSuccessMock).toHaveBeenCalled();
  });

  it('shows error toast when save fails', async () => {
    mutateAsyncMock.mockRejectedValueOnce(new Error('nope'));
    renderPage();
    fireEvent.click(screen.getByText('settings.save'));
    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalled();
    });
  });

  it('delete account flow calls edge function, sign out, and navigates', async () => {
    renderPage();
    fireEvent.click(screen.getByText('settings.delete_permanently'));
    await waitFor(() => {
      expect(invokeEdgeFunctionMock).toHaveBeenCalledWith('delete_user_account', expect.any(Object));
    });
    await waitFor(() => expect(signOutMock).toHaveBeenCalled());
    expect(navigateMock).toHaveBeenCalledWith('/auth');
  });

  it('shows error toast when delete edge function fails', async () => {
    invokeEdgeFunctionMock.mockResolvedValueOnce({ data: null, error: new Error('boom') });
    renderPage();
    fireEvent.click(screen.getByText('settings.delete_permanently'));
    await waitFor(() => expect(toastErrorMock).toHaveBeenCalled());
    expect(signOutMock).not.toHaveBeenCalled();
  });

  it('navigates to privacy when export shortcut is clicked', () => {
    renderPage();
    fireEvent.click(screen.getByText('settings.export'));
    expect(navigateMock).toHaveBeenCalledWith('/settings/privacy');
  });
});
