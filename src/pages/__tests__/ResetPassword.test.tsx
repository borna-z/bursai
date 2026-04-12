import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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
    t: (k: string) => ({
      'auth.password_too_short': 'Password too short',
      'auth.passwords_no_match': 'Passwords do not match',
      'auth.something_wrong': 'Something went wrong',
      'auth.password_updated': 'Password updated',
      'auth.redirecting': 'Redirecting...',
      'auth.invalid_reset_link': 'Invalid or expired reset link',
      'auth.back_to_login': 'Back to login',
      'auth.set_new_password': 'Set new password',
      'auth.set_new_password_desc': 'Enter your new password below.',
      'auth.new_password': 'New password',
      'auth.min_password': 'Min 8 characters',
      'auth.confirm_password': 'Confirm password',
      'auth.update_password': 'Update password',
      'auth.updating': 'Updating...',
    }[k] ?? k),
    locale: 'en',
  }),
}));

vi.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => ({ theme: 'light', resolvedTheme: 'light', setTheme: vi.fn() }),
}));

const updateUserMock = vi.fn();
const onAuthStateChangeMock = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      onAuthStateChange: (cb: (event: string) => void) => {
        onAuthStateChangeMock(cb);
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      },
      getSession: () => Promise.resolve({ data: { session: null } }),
      updateUser: (...args: unknown[]) => updateUserMock(...args),
    },
  },
}));

vi.mock('@/lib/haptics', () => ({ hapticLight: vi.fn() }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import ResetPassword from '../ResetPassword';

function renderPage() {
  return render(
    <MemoryRouter>
      <ResetPassword />
    </MemoryRouter>,
  );
}

describe('ResetPassword page', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    updateUserMock.mockReset();
    onAuthStateChangeMock.mockReset();
    // Reset location hash/search
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...window.location, hash: '', search: '' },
    });
  });

  it('shows invalid link message when not in recovery mode', () => {
    renderPage();
    expect(screen.getByText('Invalid or expired reset link')).toBeInTheDocument();
    expect(screen.getByText('Back to login')).toBeInTheDocument();
  });

  it('navigates to /auth when Back to login is clicked', () => {
    renderPage();
    fireEvent.click(screen.getByText('Back to login'));
    expect(navigateMock).toHaveBeenCalledWith('/auth');
  });

  it('shows password form when recovery hash is present', () => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...window.location, hash: '#type=recovery', search: '' },
    });
    renderPage();
    expect(screen.getByText('Set new password')).toBeInTheDocument();
    expect(screen.getByText('Update password')).toBeInTheDocument();
  });

  it('shows password form when recovery search param is present', () => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...window.location, hash: '', search: '?type=recovery' },
    });
    renderPage();
    expect(screen.getByText('Set new password')).toBeInTheDocument();
  });

  it('calls updateUser on valid submit', async () => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...window.location, hash: '#type=recovery', search: '' },
    });
    updateUserMock.mockResolvedValue({ error: null });

    renderPage();

    const inputs = screen.getAllByPlaceholderText(/min 8|••••/i);
    fireEvent.change(inputs[0], { target: { value: 'newpass123' } });
    fireEvent.change(inputs[1], { target: { value: 'newpass123' } });
    fireEvent.click(screen.getByText('Update password'));

    await waitFor(() => {
      expect(updateUserMock).toHaveBeenCalledWith({ password: 'newpass123' });
    });
  });
});
