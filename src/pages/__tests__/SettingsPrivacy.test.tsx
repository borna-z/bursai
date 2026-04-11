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
  supabaseFromMock,
  toastSuccessMock,
  toastErrorMock,
} = vi.hoisted(() => {
  const mutateAsyncMock = vi.fn().mockResolvedValue({});
  const tableResult = { data: [], error: null };
  const singleFn = vi.fn().mockResolvedValue({ data: {}, error: null });
  const eqFn = vi.fn().mockResolvedValue(tableResult);
  const selectFn = vi.fn(() => ({
    eq: (...args: unknown[]) => {
      void args;
      return Object.assign(Promise.resolve(tableResult), { single: singleFn });
    },
  }));
  const supabaseFromMock = vi.fn(() => ({ select: selectFn }));
  return {
    navigateMock: vi.fn(),
    signOutMock: vi.fn().mockResolvedValue(undefined),
    mutateAsyncMock,
    invokeEdgeFunctionMock: vi.fn().mockResolvedValue({ data: { success: true }, error: null }),
    supabaseFromMock,
    toastSuccessMock: vi.fn(),
    toastErrorMock: vi.fn(),
  };
});

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});

vi.mock('sonner', () => ({
  toast: { success: toastSuccessMock, error: toastErrorMock },
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1', email: 'test@example.com' }, signOut: signOutMock }),
}));

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: (k: string) => k }),
}));

vi.mock('@/hooks/useProfile', () => ({
  useProfile: () => ({ data: { preferences: {} } }),
  useUpdateProfile: () => ({ mutateAsync: mutateAsyncMock, isPending: false }),
}));

vi.mock('@/lib/edgeFunctionClient', () => ({
  invokeEdgeFunction: invokeEdgeFunctionMock,
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: supabaseFromMock },
}));

vi.mock('@/lib/haptics', () => ({ hapticLight: vi.fn() }));
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

vi.mock('@/components/layout/AppLayout', () => ({
  AppLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/components/layout/PageHeader', () => ({
  PageHeader: ({ title }: { title: string }) => <header>{title}</header>,
}));
vi.mock('@/components/ui/animated-page', () => ({
  AnimatedPage: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/collapsible', () => ({
  Collapsible: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  CollapsibleTrigger: ({ children, onClick }: { children?: ReactNode; onClick?: () => void }) => (
    <button onClick={onClick}>{children}</button>
  ),
  CollapsibleContent: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/switch', () => ({
  Switch: ({ checked, onCheckedChange }: { checked: boolean; onCheckedChange: (v: boolean) => void }) => (
    <button role="switch" aria-checked={checked} onClick={() => onCheckedChange(!checked)}>
      {checked ? 'on' : 'off'}
    </button>
  ),
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

// Mock URL.createObjectURL / revokeObjectURL for export
beforeEach(() => {
  // @ts-expect-error test stub
  global.URL.createObjectURL = vi.fn(() => 'blob:mock');
  // @ts-expect-error test stub
  global.URL.revokeObjectURL = vi.fn();
});

import SettingsPrivacy from '../settings/SettingsPrivacy';

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <SettingsPrivacy />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('SettingsPrivacy', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    signOutMock.mockClear();
    mutateAsyncMock.mockReset().mockResolvedValue({});
    invokeEdgeFunctionMock.mockReset().mockResolvedValue({ data: { success: true }, error: null });
    supabaseFromMock.mockClear();
    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();
  });

  it('renders GDPR title and section headers', () => {
    renderPage();
    expect(screen.getByText('settings.data_sovereignty_title')).toBeInTheDocument();
    expect(screen.getByText('settings.gdpr.about_title')).toBeInTheDocument();
    expect(screen.getByText('settings.gdpr.your_data_title')).toBeInTheDocument();
    expect(screen.getByText('settings.gdpr.rights_title')).toBeInTheDocument();
  });

  it('export button queries supabase and shows success toast', async () => {
    renderPage();
    fireEvent.click(screen.getByText('settings.export'));
    await waitFor(() => {
      expect(supabaseFromMock).toHaveBeenCalledWith('garments');
    });
    expect(supabaseFromMock).toHaveBeenCalledWith('outfits');
    expect(supabaseFromMock).toHaveBeenCalledWith('profiles');
    await waitFor(() => expect(toastSuccessMock).toHaveBeenCalled());
  });

  it('toggling consent switch calls updateProfile with consent prefs', async () => {
    renderPage();
    const switches = screen.getAllByRole('switch');
    // first consent switch is analytics (starts true -> toggles off)
    fireEvent.click(switches[0]);
    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalledWith({
        preferences: expect.objectContaining({
          consent: expect.objectContaining({ analytics: false }),
        }),
      });
    });
    expect(toastSuccessMock).toHaveBeenCalled();
  });

  it('delete account flow invokes edge function, signs out, and navigates', async () => {
    renderPage();
    fireEvent.click(screen.getByText('settings.delete_permanently'));
    await waitFor(() => {
      expect(invokeEdgeFunctionMock).toHaveBeenCalledWith('delete_user_account', expect.any(Object));
    });
    await waitFor(() => expect(signOutMock).toHaveBeenCalled());
    expect(navigateMock).toHaveBeenCalledWith('/auth');
  });

  it('shows error toast when delete account fails', async () => {
    invokeEdgeFunctionMock.mockResolvedValueOnce({ data: null, error: new Error('fail') });
    renderPage();
    fireEvent.click(screen.getByText('settings.delete_permanently'));
    await waitFor(() => expect(toastErrorMock).toHaveBeenCalled());
  });

  it('rights-section links navigate to the right routes', () => {
    renderPage();
    fireEvent.click(screen.getByText('settings.gdpr.rights_edit'));
    expect(navigateMock).toHaveBeenCalledWith('/settings/account');

    fireEvent.click(screen.getByText('settings.gdpr.rights_privacy_policy'));
    expect(navigateMock).toHaveBeenCalledWith('/privacy');

    fireEvent.click(screen.getByText('settings.gdpr.rights_terms'));
    expect(navigateMock).toHaveBeenCalledWith('/terms');
  });
});
