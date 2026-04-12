import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const navigateMock = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1' }, loading: false }),
}));

const useFlatGarmentsMock = vi.fn();

vi.mock('@/hooks/useGarments', () => ({
  useFlatGarments: () => useFlatGarmentsMock(),
}));

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: (k: string) => ({
      'genimg.title': 'Generate Images',
      'genimg.desc': 'Generate product photos for all garments.',
      'genimg.total': 'Total',
      'genimg.generated': 'Generated',
      'genimg.failed': 'Failed',
      'genimg.generate_all': 'Generate All',
      'genimg.generating': 'Generating...',
      'genimg.retry': 'Retry',
      'genimg.processing': 'Processing',
      'genimg.done': 'Done',
    }[k] ?? k),
    locale: 'en',
  }),
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

vi.mock('@/components/ui/progress', () => ({
  Progress: ({ value }: { value: number }) => <div data-testid="progress" data-value={value} />,
}));

vi.mock('@/lib/haptics', () => ({ hapticLight: vi.fn() }));

const invokeMock = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: { invoke: (...args: unknown[]) => invokeMock(...args) },
  },
}));

import GenerateImages from '../settings/GenerateImages';

describe('GenerateImages page', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    invokeMock.mockReset();
    useFlatGarmentsMock.mockReturnValue({
      data: [
        { id: 'g1', title: 'White Shirt' },
        { id: 'g2', title: 'Blue Pants' },
      ],
    });
  });

  it('renders the title and garment count', () => {
    render(<GenerateImages />);
    expect(screen.getByText('Generate Images')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('Total')).toBeInTheDocument();
  });

  it('renders the description text', () => {
    render(<GenerateImages />);
    expect(screen.getByText('Generate product photos for all garments.')).toBeInTheDocument();
  });

  it('disables the generate button when no garments are available', () => {
    useFlatGarmentsMock.mockReturnValue({ data: [] });
    render(<GenerateImages />);
    const btn = screen.getByRole('button', { name: /generate all/i });
    expect(btn).toBeDisabled();
  });

  it('starts generation on button click', async () => {
    invokeMock.mockResolvedValue({
      data: { results: [{ id: 'g1', success: true }, { id: 'g2', success: true }] },
      error: null,
    });

    render(<GenerateImages />);
    fireEvent.click(screen.getByRole('button', { name: /generate all/i }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith('generate_garment_images', expect.objectContaining({
        body: { garment_ids: ['g1', 'g2'] },
      }));
    });
  });

  it('shows 0 garments when data is undefined', () => {
    useFlatGarmentsMock.mockReturnValue({ data: undefined });
    render(<GenerateImages />);
    expect(screen.getByText('0')).toBeInTheDocument();
  });
});
