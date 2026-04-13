import type { PropsWithChildren } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const {
  navigateMock,
  useOutfitMock,
  updateOutfitMutateAsync,
  markWornMutateAsync,
  undoMarkWornMutateAsync,
  useWeatherMock,
  toastSuccessMock,
  toastErrorMock,
} = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  useOutfitMock: vi.fn(),
  updateOutfitMutateAsync: vi.fn(),
  markWornMutateAsync: vi.fn(),
  undoMarkWornMutateAsync: vi.fn(),
  useWeatherMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  toastErrorMock: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
    useParams: () => ({ id: 'outfit-1' }),
    useLocation: () => ({ pathname: '/outfits/outfit-1', state: null, search: '' }),
  };
});

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: (k: string) => k, locale: 'en' }),
}));

vi.mock('@/hooks/useOutfits', () => ({
  useOutfit: () => useOutfitMock(),
  useUpdateOutfit: () => ({ mutateAsync: updateOutfitMutateAsync, isPending: false }),
  useMarkOutfitWorn: () => ({ mutateAsync: markWornMutateAsync, isPending: false }),
  useUndoMarkWorn: () => ({ mutateAsync: undoMarkWornMutateAsync, isPending: false }),
}));

vi.mock('@/hooks/useSwapGarment', () => ({
  useSwapGarment: () => ({
    candidates: [],
    isLoadingCandidates: false,
    fetchCandidates: vi.fn(),
    swapGarment: vi.fn(),
    isSwapping: false,
    clearCandidates: vi.fn(),
  }),
}));

vi.mock('@/hooks/useWeather', () => ({
  useWeather: () => useWeatherMock(),
}));

vi.mock('@/hooks/usePhotoFeedback', () => ({
  useOutfitFeedback: () => ({ data: null }),
  useSubmitPhotoFeedback: () => ({ mutate: vi.fn(), mutateAsync: vi.fn() }),
}));

vi.mock('@/hooks/useFeedbackSignals', () => ({
  useFeedbackSignals: () => ({ record: vi.fn() }),
}));

vi.mock('@/components/ui/lazy-image', () => ({
  LazyImageSimple: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

vi.mock('@/components/ui/PageBreadcrumb', () => ({
  PageBreadcrumb: () => <nav data-testid="breadcrumb" />,
}));

vi.mock('@/components/ui/sheet', () => ({
  Sheet: ({ children, open }: PropsWithChildren<{ open?: boolean }>) =>
    open ? <div data-testid="sheet">{children}</div> : null,
  SheetContent: ({ children }: PropsWithChildren) => <div>{children}</div>,
  SheetHeader: ({ children }: PropsWithChildren) => <div>{children}</div>,
  SheetTitle: ({ children }: PropsWithChildren) => <h2>{children}</h2>,
  SheetDescription: ({ children }: PropsWithChildren) => <p>{children}</p>,
}));

vi.mock('@/components/ui/switch', () => ({
  Switch: (props: Record<string, unknown>) => <input type="checkbox" {...(props as object)} />,
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, htmlFor }: PropsWithChildren<{ htmlFor?: string }>) => <label htmlFor={htmlFor}>{children}</label>,
}));

vi.mock('@/components/outfit/OutfitDetailSlots', () => ({
  SwapSheet: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="swap-sheet">swap</div> : null,
  SlotRow: ({ garmentTitle }: { garmentTitle: string }) => <div data-testid="slot-row">{garmentTitle}</div>,
}));

vi.mock('@/components/outfit/OutfitDetailActions', () => ({
  OutfitDetailActions: ({ onMarkWorn, onCreateSimilar }: { onMarkWorn: () => void; onCreateSimilar: () => void }) => (
    <div data-testid="outfit-actions">
      <button onClick={onMarkWorn}>mark worn</button>
      <button onClick={onCreateSimilar}>create similar</button>
    </div>
  ),
}));

vi.mock('sonner', () => ({ toast: { success: toastSuccessMock, error: toastErrorMock } }));
vi.mock('@/lib/haptics', () => ({ hapticLight: vi.fn(), hapticMedium: vi.fn(), hapticSuccess: vi.fn() }));
vi.mock('@/lib/nativeShare', () => ({ nativeShare: vi.fn().mockResolvedValue(false) }));
vi.mock('@/lib/stripBrands', () => ({ stripBrands: (s: string) => s }));
vi.mock('@/lib/occasionLabel', () => ({ getOccasionLabel: (x: string) => x }));
vi.mock('@/lib/garmentImage', () => ({ getPreferredGarmentImagePath: () => null }));
vi.mock('@/lib/outfitContext', () => ({
  normalizeWeather: () => ({ temperature: 16, precipitation: 'none', wind: 'low' }),
}));

import OutfitDetailPage from '../OutfitDetail';

function buildOutfit(overrides: Record<string, unknown> = {}) {
  return {
    id: 'outfit-1',
    occasion: 'casual',
    style_vibe: 'minimal',
    explanation: 'Balanced silhouette.',
    saved: false,
    share_enabled: false,
    rating: null,
    feedback: [],
    weather: null,
    outfit_items: [
      { id: 'i1', slot: 'top', garment_id: 'g1', garment: { id: 'g1', title: 'Tee', color_primary: 'white' } },
      { id: 'i2', slot: 'bottom', garment_id: 'g2', garment: { id: 'g2', title: 'Pants', color_primary: 'black' } },
    ],
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/outfits/outfit-1']}>
      <OutfitDetailPage />
    </MemoryRouter>,
  );
}

describe('OutfitDetail page', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    updateOutfitMutateAsync.mockReset();
    markWornMutateAsync.mockReset();
    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();
    useWeatherMock.mockReturnValue({ weather: { temperature: 16, precipitation: 'none', wind: 'low' } });
  });

  it('renders the loading skeleton when outfit query is loading', () => {
    useOutfitMock.mockReturnValue({ data: null, isLoading: true, refetch: vi.fn() });
    const { container } = renderPage();
    expect(container.querySelectorAll('[class*="skeleton" i]').length).toBeGreaterThan(0);
  });

  it('renders a not-found state when no outfit is returned', () => {
    useOutfitMock.mockReturnValue({ data: null, isLoading: false, refetch: vi.fn() });
    renderPage();
    expect(screen.getByText('outfit.not_found')).toBeInTheDocument();
  });

  it('renders the outfit title block and wear actions on happy path', () => {
    useOutfitMock.mockReturnValue({ data: buildOutfit(), isLoading: false, refetch: vi.fn() });
    renderPage();
    expect(screen.getByTestId('outfit-actions')).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 }).length).toBeGreaterThan(0);
  });

  it('calls markWorn mutation when the wear action is pressed', async () => {
    updateOutfitMutateAsync.mockResolvedValue({});
    markWornMutateAsync.mockResolvedValue({ garmentIds: ['g1', 'g2'] });
    useOutfitMock.mockReturnValue({ data: buildOutfit(), isLoading: false, refetch: vi.fn() });
    renderPage();
    fireEvent.click(screen.getByText('mark worn'));
    expect(markWornMutateAsync).toHaveBeenCalled();
  });

  it('routes to the generator from create similar action', () => {
    useOutfitMock.mockReturnValue({ data: buildOutfit(), isLoading: false, refetch: vi.fn() });
    renderPage();
    fireEvent.click(screen.getByText('create similar'));
    expect(navigateMock).toHaveBeenCalledWith(
      '/ai/generate',
      expect.objectContaining({ state: expect.any(Object) }),
    );
  });

  it('switches to the swap tab and renders slot rows', () => {
    useOutfitMock.mockReturnValue({ data: buildOutfit(), isLoading: false, refetch: vi.fn() });
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'outfit.tab_swap' }));
    expect(screen.getAllByTestId('slot-row').length).toBe(2);
  });
});
