import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const { mutateAsyncMock, profileDataMock, toastSuccessMock, toastErrorMock } = vi.hoisted(() => ({
  mutateAsyncMock: vi.fn().mockResolvedValue({}),
  profileDataMock: vi.fn(() => ({
    id: 'u1',
    height_cm: 180,
    weight_kg: 75,
    preferences: {
      styleProfile: {
        gender: 'female',
        styleWords: ['minimal', 'classic'],
        favoriteColors: ['black'],
        dislikedColors: [],
        fit: 'regular',
      },
    },
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

vi.mock('@/lib/haptics', () => ({ hapticLight: vi.fn() }));

vi.mock('@/lib/mannequinPresentation', () => ({
  mannequinPresentationFromStyleProfileGender: vi.fn(() => 'neutral'),
}));

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

vi.mock('@/components/ui/select', () => {
  const Select = ({ value, onValueChange, children }: { value: string; onValueChange: (v: string) => void; children: ReactNode }) => (
    <select data-testid="style-select" value={value} onChange={(e) => onValueChange(e.target.value)}>
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

vi.mock('@/components/ui/slider', () => ({
  Slider: ({ value, onValueCommit }: { value: number[]; onValueCommit?: (v: number[]) => void }) => (
    <input
      type="range"
      data-testid="slider"
      value={value[0]}
      onChange={(e) => onValueCommit?.([Number(e.target.value)])}
    />
  ),
}));

vi.mock('@/components/ui/chip', () => ({
  Chip: ({ children, selected, onClick }: { children?: ReactNode; selected?: boolean; onClick?: () => void }) => (
    <button data-selected={selected ? 'true' : 'false'} onClick={onClick}>{children}</button>
  ),
}));

import SettingsStyle from '../settings/SettingsStyle';

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <SettingsStyle />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('SettingsStyle', () => {
  beforeEach(() => {
    mutateAsyncMock.mockReset().mockResolvedValue({});
    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();
    profileDataMock.mockReturnValue({
      id: 'u1',
      height_cm: 180,
      weight_kg: 75,
      preferences: {
        styleProfile: {
          gender: 'female',
          styleWords: ['minimal', 'classic'],
          favoriteColors: ['black'],
          dislikedColors: [],
          fit: 'regular',
        },
      },
    });
  });

  it('renders the style DNA header', () => {
    renderPage();
    expect(screen.getByText('settings.style_dna_title')).toBeInTheDocument();
  });

  it('pre-fills height and weight from profile', () => {
    renderPage();
    const heightInput = screen.getByPlaceholderText('175') as HTMLInputElement;
    const weightInput = screen.getByPlaceholderText('70') as HTMLInputElement;
    expect(heightInput.value).toBe('180');
    expect(weightInput.value).toBe('75');
  });

  it('saving body data calls updateProfile with parsed numeric values', async () => {
    renderPage();
    fireEvent.click(screen.getByText('settings.save_measurements'));
    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalledWith(
        expect.objectContaining({ height_cm: 180, weight_kg: 75 }),
      );
    });
  });

  it('toggling a selected style word removes it from the array', async () => {
    renderPage();
    // "minimal" is already selected — there may be multiple instances (chip + section summary),
    // so pick the one rendered as a Chip (has data-selected attr set to 'true')
    const minimalMatches = screen.getAllByText('minimal');
    const minimalBtn = minimalMatches.find(el => el.getAttribute('data-selected') === 'true');
    expect(minimalBtn).toBeTruthy();
    fireEvent.click(minimalBtn!);
    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalledWith(
        expect.objectContaining({
          preferences: expect.objectContaining({
            styleProfile: expect.objectContaining({
              styleWords: expect.not.arrayContaining(['minimal']),
            }),
          }),
        }),
      );
    });
  });

  it('toggling an unselected color adds it to favoriteColors', async () => {
    renderPage();
    // "white" is not selected
    const whiteBtn = screen.getAllByText('white')[0];
    fireEvent.click(whiteBtn);
    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalledWith(
        expect.objectContaining({
          preferences: expect.objectContaining({
            styleProfile: expect.objectContaining({
              favoriteColors: expect.arrayContaining(['black', 'white']),
            }),
          }),
        }),
      );
    });
  });

  it('shows "no profile" state when there is no style profile', () => {
    profileDataMock.mockReturnValue({
      id: 'u1',
      height_cm: null,
      weight_kg: null,
      preferences: {},
    });
    renderPage();
    expect(screen.getByText('settings.no_profile_title')).toBeInTheDocument();
  });

  it('shows error toast when body data save fails', async () => {
    mutateAsyncMock.mockRejectedValueOnce(new Error('nope'));
    renderPage();
    fireEvent.click(screen.getByText('settings.save_measurements'));
    await waitFor(() => expect(toastErrorMock).toHaveBeenCalled());
  });

  it('changing gender select fires updateStyleField with gender + mannequin presentation', async () => {
    renderPage();
    const selects = screen.getAllByTestId('style-select');
    // First select is gender
    fireEvent.change(selects[0], { target: { value: 'male' } });
    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalledWith(
        expect.objectContaining({
          mannequin_presentation: 'neutral',
          preferences: expect.objectContaining({
            styleProfile: expect.objectContaining({ gender: 'male' }),
          }),
        }),
      );
    });
  });
});
