import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const navigateMock = vi.fn();
const runMock = vi.fn();
const retryFailedMock = vi.fn();
const cancelMock = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

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
  Progress: ({ value }: { value?: number }) => <div data-testid="progress" data-value={value} />,
}));

vi.mock('@/lib/haptics', () => ({ hapticLight: vi.fn() }));

vi.mock('@/data/seedGarments', () => ({
  SEED_GARMENTS: [
    { title: 'Seed 1' },
    { title: 'Seed 2' },
    { title: 'Seed 3' },
  ],
}));

const useSeedReturnValue = {
  step: 'idle' as string,
  results: [] as Array<{ title: string; success: boolean; error?: string }>,
  completed: 0,
  failed: 0,
  totalToProcess: 3,
  currentItem: null as string | null,
  isRunning: false,
  progress: 0,
  getTimeRemaining: () => '~0s',
  run: runMock,
  retryFailed: retryFailedMock,
  cancel: cancelMock,
};

vi.mock('@/contexts/SeedContext', () => ({
  SeedProvider: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  useSeed: () => useSeedReturnValue,
}));

import SeedWardrobe from '../settings/SeedWardrobe';

describe('SeedWardrobe page', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    runMock.mockReset();
    retryFailedMock.mockReset();
    cancelMock.mockReset();
    // Reset to idle state
    useSeedReturnValue.step = 'idle';
    useSeedReturnValue.isRunning = false;
    useSeedReturnValue.completed = 0;
    useSeedReturnValue.failed = 0;
    useSeedReturnValue.results = [];
  });

  it('renders the title and seed count', () => {
    render(<SeedWardrobe />);
    expect(screen.getByText('Seed Wardrobe')).toBeInTheDocument();
    expect(screen.getByText('To create')).toBeInTheDocument();
  });

  it('shows the warning about deleting garments', () => {
    render(<SeedWardrobe />);
    expect(screen.getByText(/delete all existing garments/i)).toBeInTheDocument();
  });

  it('calls run when the primary button is clicked', () => {
    render(<SeedWardrobe />);
    fireEvent.click(screen.getByRole('button', { name: /delete all & create/i }));
    expect(runMock).toHaveBeenCalled();
  });

  it('shows completion state when step is done', () => {
    useSeedReturnValue.step = 'done';
    useSeedReturnValue.completed = 3;
    render(<SeedWardrobe />);
    expect(screen.getByText('Complete!')).toBeInTheDocument();
    expect(screen.getByText('3 garments created')).toBeInTheDocument();
    expect(screen.getByText('View Wardrobe')).toBeInTheDocument();
  });

  it('navigates to wardrobe after completion', () => {
    useSeedReturnValue.step = 'done';
    useSeedReturnValue.completed = 3;
    render(<SeedWardrobe />);
    fireEvent.click(screen.getByText('View Wardrobe'));
    expect(navigateMock).toHaveBeenCalledWith('/wardrobe');
  });
});
