import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const {
  mutateAsyncMock,
  profileDataMock,
  pushStateMock,
  toastSuccessMock,
  toastErrorMock,
} = vi.hoisted(() => ({
  mutateAsyncMock: vi.fn().mockResolvedValue({}),
  profileDataMock: vi.fn(() => ({ preferences: { morningReminder: false } })),
  pushStateMock: vi.fn(() => ({
    supported: true,
    isSubscribed: false,
    permission: 'default',
    loading: false,
    subscribe: vi.fn().mockResolvedValue(true),
    unsubscribe: vi.fn().mockResolvedValue(undefined),
  })),
  toastSuccessMock: vi.fn(),
  toastErrorMock: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: { success: toastSuccessMock, error: toastErrorMock },
}));

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: (k: string) => k }),
}));

vi.mock('@/hooks/useProfile', () => ({
  useProfile: () => ({ data: profileDataMock() }),
  useUpdateProfile: () => ({ mutateAsync: mutateAsyncMock, isPending: false }),
}));

vi.mock('@/hooks/usePushNotifications', () => ({
  usePushNotifications: () => pushStateMock(),
}));

vi.mock('@/components/settings/CalendarSection', () => ({
  CalendarSection: () => <div data-testid="calendar-section" />,
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

vi.mock('@/components/ui/switch', () => ({
  Switch: ({ checked, onCheckedChange, disabled }: { checked: boolean; onCheckedChange: (v: boolean) => void; disabled?: boolean }) => (
    <button
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
    >
      {checked ? 'on' : 'off'}
    </button>
  ),
}));

import SettingsNotifications from '../settings/SettingsNotifications';

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <SettingsNotifications />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('SettingsNotifications', () => {
  beforeEach(() => {
    mutateAsyncMock.mockReset().mockResolvedValue({});
    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();
    profileDataMock.mockReturnValue({ preferences: { morningReminder: false } });
    pushStateMock.mockReturnValue({
      supported: true,
      isSubscribed: false,
      permission: 'default',
      loading: false,
      subscribe: vi.fn().mockResolvedValue(true),
      unsubscribe: vi.fn().mockResolvedValue(undefined),
    });
  });

  it('renders the morning reminder row off by default', () => {
    renderPage();
    const switches = screen.getAllByRole('switch');
    // Morning reminder is the first switch
    expect(switches[0]).toHaveAttribute('aria-checked', 'false');
  });

  it('reflects preference state from useProfile', () => {
    profileDataMock.mockReturnValue({ preferences: { morningReminder: true } });
    renderPage();
    const switches = screen.getAllByRole('switch');
    expect(switches[0]).toHaveAttribute('aria-checked', 'true');
  });

  it('toggling morning reminder fires updateProfile with the right shape', async () => {
    renderPage();
    fireEvent.click(screen.getAllByRole('switch')[0]);
    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalledWith({
        preferences: expect.objectContaining({ morningReminder: true }),
      });
    });
  });

  it('shows push notification row when supported', () => {
    renderPage();
    expect(screen.getByText('settings.push_notifications')).toBeInTheDocument();
  });

  it('hides push notification row and shows not-supported row when unsupported', () => {
    pushStateMock.mockReturnValue({
      supported: false,
      isSubscribed: false,
      permission: 'default',
      loading: false,
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
    });
    renderPage();
    expect(screen.queryByText('settings.push_notifications')).not.toBeInTheDocument();
    expect(screen.getByText('settings.push_not_supported')).toBeInTheDocument();
  });

  it('subscribing to push shows success toast', async () => {
    const subscribeMock = vi.fn().mockResolvedValue(true);
    pushStateMock.mockReturnValue({
      supported: true,
      isSubscribed: false,
      permission: 'default',
      loading: false,
      subscribe: subscribeMock,
      unsubscribe: vi.fn(),
    });
    renderPage();
    const switches = screen.getAllByRole('switch');
    fireEvent.click(switches[1]); // push toggle
    await waitFor(() => expect(subscribeMock).toHaveBeenCalled());
    await waitFor(() => expect(toastSuccessMock).toHaveBeenCalled());
  });

  it('shows error toast when preference update fails', async () => {
    mutateAsyncMock.mockRejectedValueOnce(new Error('nope'));
    renderPage();
    fireEvent.click(screen.getAllByRole('switch')[0]);
    await waitFor(() => expect(toastErrorMock).toHaveBeenCalled());
  });
});
