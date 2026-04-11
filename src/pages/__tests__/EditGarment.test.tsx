import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const navigateMock = vi.fn();
const useGarmentMock = vi.fn();
const updateMutateAsync = vi.fn();
const toastErrorMock = vi.fn();
const toastSuccessMock = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
    useParams: () => ({ id: 'garment-42' }),
  };
});

vi.mock('sonner', () => ({
  toast: {
    error: (...args: unknown[]) => toastErrorMock(...args),
    success: (...args: unknown[]) => toastSuccessMock(...args),
  },
}));

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: (k: string) => k, locale: 'en' }),
}));

vi.mock('@/hooks/useGarments', () => ({
  useGarment: (...args: unknown[]) => useGarmentMock(...args),
  useUpdateGarment: () => ({
    mutateAsync: updateMutateAsync,
    isPending: false,
  }),
}));

vi.mock('@/lib/haptics', () => ({
  hapticLight: vi.fn(),
}));

vi.mock('@/lib/garmentImage', () => ({
  getPreferredGarmentImagePath: () => 'path.jpg',
}));

vi.mock('@/components/layout/AppLayout', () => ({
  AppLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/layout/PageHeader', () => ({
  PageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
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

vi.mock('@/components/wardrobe/RenderPendingOverlay', () => ({
  RenderPendingOverlay: () => null,
}));

vi.mock('@/components/ui/slider', () => ({
  Slider: ({ value }: { value: number[] }) => <div data-testid="slider">{value?.[0]}</div>,
}));

vi.mock('@/components/ui/select', () => {
  const Pass = ({ children }: { children?: ReactNode }) => <>{children}</>;
  return {
    Select: Pass,
    SelectTrigger: Pass,
    SelectValue: Pass,
    SelectContent: Pass,
    SelectItem: Pass,
  };
});

import EditGarmentPage from '../EditGarment';

const mockGarment = {
  id: 'garment-42',
  title: 'Old Title',
  category: 'top',
  subcategory: 'shirt',
  color_primary: 'blue',
  color_secondary: null,
  pattern: 'solid',
  material: 'cotton',
  fit: 'regular',
  season_tags: ['spring'],
  formality: 3,
  in_laundry: false,
  render_status: 'ready',
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/wardrobe/garment-42/edit']}>
      <EditGarmentPage />
    </MemoryRouter>,
  );
}

describe('EditGarment page', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    updateMutateAsync.mockReset().mockResolvedValue(undefined);
    toastErrorMock.mockReset();
    toastSuccessMock.mockReset();
    useGarmentMock.mockReset();
  });

  it('renders a skeleton while the garment is loading', () => {
    useGarmentMock.mockReturnValue({ data: undefined, isLoading: true });

    renderPage();

    expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(0);
  });

  it('renders a not-found state that routes back to /wardrobe', () => {
    useGarmentMock.mockReturnValue({ data: null, isLoading: false });

    renderPage();

    expect(screen.getByText('garment.not_found')).toBeInTheDocument();
    fireEvent.click(screen.getByText('common.back'));
    expect(navigateMock).toHaveBeenCalledWith('/wardrobe');
  });

  it('preloads the form with the existing garment values', () => {
    useGarmentMock.mockReturnValue({ data: mockGarment, isLoading: false });

    renderPage();

    // title Input is rendered with defaultValue in state
    expect(screen.getByDisplayValue('Old Title')).toBeInTheDocument();
  });

  it('calls updateGarment and navigates back to the detail view on save', async () => {
    useGarmentMock.mockReturnValue({ data: mockGarment, isLoading: false });

    renderPage();

    const titleInput = screen.getByDisplayValue('Old Title') as HTMLInputElement;
    fireEvent.change(titleInput, { target: { value: 'New Title' } });

    fireEvent.click(screen.getByText('garment.edit_save'));
    // Flush microtasks for the async handler
    await Promise.resolve();
    await Promise.resolve();

    expect(updateMutateAsync).toHaveBeenCalledTimes(1);
    const payload = updateMutateAsync.mock.calls[0][0];
    expect(payload.id).toBe('garment-42');
    expect(payload.updates.title).toBe('New Title');
    expect(payload.updates.category).toBe('top');
    expect(payload.updates.color_primary).toBe('blue');

    expect(navigateMock).toHaveBeenCalledWith('/wardrobe/garment-42');
    expect(toastSuccessMock).toHaveBeenCalled();
  });

  it('shows an error toast when the save mutation rejects', async () => {
    useGarmentMock.mockReturnValue({ data: mockGarment, isLoading: false });
    updateMutateAsync.mockRejectedValueOnce(new Error('boom'));

    renderPage();

    fireEvent.click(screen.getByText('garment.edit_save'));
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(toastErrorMock).toHaveBeenCalled();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('cancel button goes back without firing the mutation', () => {
    useGarmentMock.mockReturnValue({ data: mockGarment, isLoading: false });

    renderPage();

    fireEvent.click(screen.getByText('common.cancel'));
    expect(navigateMock).toHaveBeenCalledWith(-1);
    expect(updateMutateAsync).not.toHaveBeenCalled();
  });

  it('disables the save button when required fields are cleared', () => {
    useGarmentMock.mockReturnValue({
      data: { ...mockGarment, title: '' },
      isLoading: false,
    });

    renderPage();

    const saveButton = screen.getByText('garment.edit_save').closest('button');
    expect(saveButton).toBeDisabled();
  });
});
