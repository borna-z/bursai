import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const { setThemeMock, setLocaleMock, isAdminMock } = vi.hoisted(() => ({
  setThemeMock: vi.fn(),
  setLocaleMock: vi.fn(),
  isAdminMock: vi.fn(() => ({ data: false })),
}));

vi.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => ({ theme: 'light', accentColor: 'blue', setTheme: setThemeMock, setAccentColor: vi.fn() }),
}));

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: (k: string) => k, locale: 'en', setLocale: setLocaleMock }),
}));

vi.mock('@/hooks/useIsAdmin', () => ({
  useIsAdmin: () => isAdminMock(),
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

vi.mock('@/components/settings/AccentColorPicker', () => ({
  AccentColorPicker: () => <div data-testid="accent-picker">accent</div>,
}));

vi.mock('@/components/ui/select', () => {
  const Select = ({ value, onValueChange, children }: { value: string; onValueChange: (v: string) => void; children: ReactNode }) => (
    <select data-testid="locale-select" value={value} onChange={(e) => onValueChange(e.target.value)}>
      {children}
    </select>
  );
  const SelectItem = ({ value, children }: { value: string; children: ReactNode }) => (
    <option value={value}>{children}</option>
  );
  const Pass = ({ children }: { children?: ReactNode }) => <>{children}</>;
  return {
    Select,
    SelectContent: Pass,
    SelectItem,
    SelectTrigger: Pass,
    SelectValue: () => null,
  };
});

import SettingsAppearance from '../settings/SettingsAppearance';

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <SettingsAppearance />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('SettingsAppearance', () => {
  beforeEach(() => {
    setThemeMock.mockReset();
    setLocaleMock.mockReset();
    isAdminMock.mockReturnValue({ data: false });
  });

  it('renders all three theme options', () => {
    renderPage();
    expect(screen.getByText('settings.theme.light')).toBeInTheDocument();
    expect(screen.getByText('settings.theme.dark')).toBeInTheDocument();
    expect(screen.getByText('settings.theme.auto')).toBeInTheDocument();
  });

  it('calls setTheme when a theme option is clicked', () => {
    renderPage();
    fireEvent.click(screen.getByText('settings.theme.dark'));
    expect(setThemeMock).toHaveBeenCalledWith('dark');
  });

  it('renders accent color picker', () => {
    renderPage();
    expect(screen.getByTestId('accent-picker')).toBeInTheDocument();
  });

  it('hides language selector for non-admin users', () => {
    renderPage();
    expect(screen.queryByTestId('locale-select')).not.toBeInTheDocument();
  });

  it('shows language selector for admins and fires setLocale on change', () => {
    isAdminMock.mockReturnValue({ data: true });
    renderPage();
    const select = screen.getByTestId('locale-select') as HTMLSelectElement;
    expect(select).toBeInTheDocument();
    fireEvent.change(select, { target: { value: 'sv' } });
    expect(setLocaleMock).toHaveBeenCalledWith('sv');
  });

  it('renders visual preview and interface-mode labels', () => {
    renderPage();
    expect(screen.getByText('settings.visual_preview')).toBeInTheDocument();
    expect(screen.getByText('settings.interface_mode')).toBeInTheDocument();
  });
});
