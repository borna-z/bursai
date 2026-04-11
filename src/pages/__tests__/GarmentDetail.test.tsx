import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const navigateMock = vi.fn();
const useGarmentMock = vi.fn();
const updateMutateAsync = vi.fn();
const deleteMutateAsync = vi.fn();
const markWornMutateAsync = vi.fn();
const assessConditionMutateAsync = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
    useParams: () => ({ id: 'garment-1' }),
  };
});

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: (k: string) => k,
    locale: 'en',
  }),
}));

vi.mock('@/hooks/useGarments', () => ({
  useGarment: (...args: unknown[]) => useGarmentMock(...args),
  useUpdateGarment: () => ({
    mutateAsync: updateMutateAsync,
    isPending: false,
  }),
  useDeleteGarment: () => ({
    mutateAsync: deleteMutateAsync,
    isPending: false,
  }),
  useMarkGarmentWorn: () => ({
    mutateAsync: markWornMutateAsync,
    isPending: false,
  }),
}));

vi.mock('@/hooks/useAdvancedFeatures', () => ({
  useAssessCondition: () => ({
    mutateAsync: assessConditionMutateAsync,
    isPending: false,
  }),
  useCostPerWear: () => null,
}));

vi.mock('@/hooks/useGarmentOutfitHistory', () => ({
  useGarmentOutfitHistory: () => ({ data: [] }),
}));

vi.mock('@/hooks/useSimilarGarments', () => ({
  useSimilarGarments: () => ({ data: [] }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      update: () => ({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) }),
    }),
  },
}));

vi.mock('@/lib/edgeFunctionClient', () => ({
  invokeEdgeFunction: vi.fn().mockResolvedValue({ data: null, error: null }),
}));

vi.mock('@/lib/haptics', () => ({
  hapticLight: vi.fn(),
  hapticMedium: vi.fn(),
  hapticHeavy: vi.fn(),
  hapticSuccess: vi.fn(),
}));

vi.mock('@/lib/humanize', () => ({
  categoryLabel: (_t: unknown, v: string) => v,
  colorLabel: (_t: unknown, v: string) => v,
  fitLabel: (_t: unknown, v: string) => v,
  humanize: (v: string) => v,
  materialLabel: (_t: unknown, v: string) => v,
  patternLabel: (_t: unknown, v: string) => v,
  seasonLabel: (_t: unknown, v: string) => v,
}));

vi.mock('@/lib/styleFlowState', () => ({
  buildStyleAroundState: (id: string) => ({ garmentId: id }),
  buildStyleFlowSearch: (id: string) => `?g=${id}`,
}));

vi.mock('@/lib/garmentImage', () => ({
  getPreferredGarmentImagePath: () => 'path.jpg',
  getPreferredGarmentImageSource: () => 'upload',
  getGarmentProcessingMessage: () => null,
}));

vi.mock('@/lib/dateLocale', () => ({
  getBCP47: () => 'en-US',
}));

vi.mock('@/components/layout/AppLayout', () => ({
  AppLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/layout/PageHeader', () => ({
  PageHeader: ({ title, actions }: { title: string; actions?: ReactNode }) => (
    <div>
      <h1>{title}</h1>
      {actions}
    </div>
  ),
}));

vi.mock('@/components/layout/EmptyState', () => ({
  EmptyState: ({ title, action }: { title: string; action?: { label: string; onClick: () => void } }) => (
    <div>
      <p>{title}</p>
      {action ? <button onClick={action.onClick}>{action.label}</button> : null}
    </div>
  ),
}));

vi.mock('@/components/ui/animated-page', () => ({
  AnimatedPage: ({ children, className }: { children: ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}));

vi.mock('@/components/ui/lazy-image', () => ({
  LazyImage: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: ({ className }: { className?: string }) => <div data-testid="skeleton" className={className} />,
}));

vi.mock('@/components/garment/GarmentEnrichmentPanel', () => ({
  GarmentEnrichmentPanel: () => <div data-testid="enrichment-panel" />,
  SpecRow: ({ label, value }: { label: string; value: string }) => <div>{label}: {value}</div>,
  extractEnrichment: () => null,
}));

vi.mock('@/components/garment/GarmentOutfitHistory', () => ({
  GarmentOutfitHistory: () => <div data-testid="outfit-history" />,
}));

vi.mock('@/components/garment/GarmentSimilarItems', () => ({
  GarmentSimilarItems: () => <div data-testid="similar-items" />,
}));

vi.mock('@/components/wardrobe/GarmentProcessingBadge', () => ({
  GarmentProcessingBadge: () => null,
}));

vi.mock('@/components/wardrobe/RenderPendingOverlay', () => ({
  RenderPendingOverlay: () => null,
}));

// Alert dialog: render children inline so actions are clickable without interactive state
vi.mock('@/components/ui/alert-dialog', () => {
  const Pass = ({ children }: { children?: ReactNode }) => <>{children}</>;
  return {
    AlertDialog: Pass,
    AlertDialogAction: ({ children, onClick }: { children: ReactNode; onClick?: () => void; className?: string }) => (
      <button onClick={onClick}>{children}</button>
    ),
    AlertDialogCancel: ({ children }: { children: ReactNode }) => <button>{children}</button>,
    AlertDialogContent: Pass,
    AlertDialogDescription: Pass,
    AlertDialogFooter: Pass,
    AlertDialogHeader: Pass,
    AlertDialogTitle: Pass,
    AlertDialogTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  };
});

import GarmentDetailPage from '../GarmentDetail';

const mockGarment = {
  id: 'garment-1',
  title: 'Blue Oxford Shirt',
  category: 'top',
  subcategory: 'shirt',
  color_primary: 'blue',
  color_secondary: null,
  material: 'cotton',
  pattern: 'solid',
  fit: 'regular',
  season_tags: ['spring', 'summer'],
  wear_count: 5,
  last_worn_at: '2026-04-01T00:00:00Z',
  in_laundry: false,
  purchase_price: null,
  purchase_currency: 'SEK',
  condition_score: null,
  condition_notes: null,
  image_path: 'path.jpg',
  image_processing_status: 'ready',
  render_status: 'ready',
  enrichment_status: 'none',
  ai_raw: null,
  ai_analyzed_at: null,
  source_url: null,
  created_at: '2026-03-01T00:00:00Z',
  formality: 3,
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/wardrobe/garment-1']}>
        <GarmentDetailPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('GarmentDetail page', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    updateMutateAsync.mockReset().mockResolvedValue(undefined);
    deleteMutateAsync.mockReset().mockResolvedValue(undefined);
    markWornMutateAsync.mockReset().mockResolvedValue(undefined);
    assessConditionMutateAsync.mockReset().mockResolvedValue(undefined);
    useGarmentMock.mockReset();
  });

  it('renders skeletons while the garment is loading', () => {
    useGarmentMock.mockReturnValue({ data: undefined, isLoading: true });

    renderPage();

    expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(0);
  });

  it('renders a not-found state when the garment is missing and lets the user go back', () => {
    useGarmentMock.mockReturnValue({ data: null, isLoading: false });

    renderPage();

    expect(screen.getByText('garment.not_found')).toBeInTheDocument();
    fireEvent.click(screen.getByText('common.back'));
    expect(navigateMock).toHaveBeenCalledWith('/wardrobe');
  });

  it('renders the garment title and category when data loads', () => {
    useGarmentMock.mockReturnValue({ data: mockGarment, isLoading: false });

    renderPage();

    expect(screen.getByText('Blue Oxford Shirt')).toBeInTheDocument();
    expect(screen.getAllByText(/top/).length).toBeGreaterThan(0);
  });

  it('navigates to the edit route when the edit action is pressed', () => {
    useGarmentMock.mockReturnValue({ data: mockGarment, isLoading: false });

    renderPage();

    fireEvent.click(screen.getByLabelText('garment.edit_garment_aria'));
    expect(navigateMock).toHaveBeenCalledWith('/wardrobe/garment-1/edit');
  });

  it('fires the mark-worn mutation when the mark worn button is pressed', async () => {
    useGarmentMock.mockReturnValue({ data: mockGarment, isLoading: false });

    renderPage();

    fireEvent.click(screen.getByText('garment.mark_worn_button'));
    await Promise.resolve();
    expect(markWornMutateAsync).toHaveBeenCalledWith('garment-1');
  });

  it('fires the delete mutation and redirects back to /wardrobe', async () => {
    useGarmentMock.mockReturnValue({ data: mockGarment, isLoading: false });

    renderPage();

    fireEvent.click(screen.getByText('common.delete'));
    await Promise.resolve();
    await Promise.resolve();
    expect(deleteMutateAsync).toHaveBeenCalledWith('garment-1');
    expect(navigateMock).toHaveBeenCalledWith('/wardrobe');
  });

  it('navigates to the style-around flow when "style this" is pressed', () => {
    useGarmentMock.mockReturnValue({ data: mockGarment, isLoading: false });

    renderPage();

    fireEvent.click(screen.getByText('garment.style_this'));
    expect(navigateMock).toHaveBeenCalledWith(
      '/ai/chat?g=garment-1',
      { state: { garmentId: 'garment-1' } },
    );
  });
});
