import type { PropsWithChildren } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const navigateMock = vi.fn();
const useInsightsMock = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: (k: string) => k, locale: 'en' }),
}));

vi.mock('@/hooks/useInsights', () => ({
  useInsights: () => useInsightsMock(),
}));

vi.mock('@/components/layout/AppLayout', () => ({
  AppLayout: ({ children }: PropsWithChildren) => <div>{children}</div>,
}));

vi.mock('@/components/layout/PageHeader', () => ({
  PageHeader: ({ title, actions }: { title: string; actions?: React.ReactNode }) => (
    <div><h1>{title}</h1>{actions}</div>
  ),
}));

vi.mock('@/components/layout/EmptyState', () => ({
  EmptyState: ({ title, description }: { title: string; description: string }) => (
    <div data-testid="empty-state"><p>{title}</p><p>{description}</p></div>
  ),
}));

vi.mock('@/components/ui/animated-page', () => ({
  AnimatedPage: ({ children, className }: PropsWithChildren<{ className?: string }>) => (
    <div className={className}>{children}</div>
  ),
}));

vi.mock('@/components/ui/lazy-image', () => ({
  LazyImageSimple: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

vi.mock('@/lib/haptics', () => ({
  hapticLight: vi.fn(),
}));

vi.mock('@/lib/styleFlowState', () => ({
  buildStyleFlowSearch: (ids: string[]) => `?ids=${ids.join(',')}`,
}));

import UsedGarments from '../UsedGarments';

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/insights/used']}>
      <UsedGarments />
    </MemoryRouter>,
  );
}

describe('UsedGarments page', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    useInsightsMock.mockReset();
  });

  it('shows skeletons when loading', () => {
    useInsightsMock.mockReturnValue({ data: undefined, isLoading: true });
    const { container } = renderPage();
    expect(container.querySelectorAll('.skeleton-shimmer').length).toBeGreaterThan(0);
  });

  it('renders empty state when no used garments', () => {
    useInsightsMock.mockReturnValue({ data: { usedGarments: [] }, isLoading: false });
    renderPage();
    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
  });

  it('renders used garment cards and navigates on tap', () => {
    useInsightsMock.mockReturnValue({
      data: {
        usedGarments: [
          { id: 'g1', title: 'Denim jacket', wearCountLast30: 5, category: 'outerwear' },
          { id: 'g2', title: 'White tee', wearCountLast30: 8, category: 'top' },
        ],
      },
      isLoading: false,
    });

    renderPage();
    expect(screen.getByText('Denim jacket')).toBeInTheDocument();
    expect(screen.getByText('White tee')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Denim jacket'));
    expect(navigateMock).toHaveBeenCalledWith('/wardrobe/g1');
  });

  it('renders the generate-from-used action button when garments exist', () => {
    useInsightsMock.mockReturnValue({
      data: { usedGarments: [{ id: 'g1', title: 'Denim', wearCountLast30: 3 }] },
      isLoading: false,
    });

    renderPage();
    const btn = screen.getByRole('button', { name: /insights\.generate_from_used/i });
    fireEvent.click(btn);
    expect(navigateMock).toHaveBeenCalledWith(expect.stringContaining('/ai/generate?ids=g1'));
  });
});
