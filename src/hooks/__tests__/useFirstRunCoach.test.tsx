import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';

const mockMutateAsync = vi.fn();
const mockUseProfile = vi.fn();
const mockUseGarmentCount = vi.fn();

vi.mock('@/hooks/useProfile', () => ({
  useProfile: (...args: unknown[]) => mockUseProfile(...args),
  useUpdateProfile: vi.fn(() => ({
    mutateAsync: mockMutateAsync,
  })),
}));

vi.mock('@/hooks/useGarments', () => ({
  useGarmentCount: (...args: unknown[]) => mockUseGarmentCount(...args),
}));

import { useFirstRunCoach } from '../useFirstRunCoach';

function createWrapper(initialPath = '/') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[initialPath]}>{children}</MemoryRouter>
      </QueryClientProvider>
    );
  };
}

describe('useFirstRunCoach', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseProfile.mockReturnValue({
      data: {
        preferences: {
          onboarding: {
            completed: true,
            toured: false,
            tour_step: 0,
          },
        },
      },
    });
    mockUseGarmentCount.mockReturnValue({ data: 0 });
    mockMutateAsync.mockResolvedValue({});
  });

  it('only activates each step on its intended route', () => {
    const { result: navResult } = renderHook(() => useFirstRunCoach(), { wrapper: createWrapper('/plan') });
    expect(navResult.current.isStepActive(0)).toBe(true);
    expect(navResult.current.isStepActive(1)).toBe(false);

    const { result: wardrobeResult } = renderHook(() => useFirstRunCoach(), { wrapper: createWrapper('/wardrobe') });
    expect(wardrobeResult.current.isStepActive(0)).toBe(false);
    expect(wardrobeResult.current.isStepActive(1)).toBe(true);

    const { result: scanResult } = renderHook(() => useFirstRunCoach(), { wrapper: createWrapper('/wardrobe/scan') });
    expect(scanResult.current.isStepActive(1)).toBe(false);
    expect(scanResult.current.isStepActive(2)).toBe(true);

    mockUseProfile.mockReturnValue({
      data: {
        preferences: {
          onboarding: {
            completed: true,
            toured: false,
            tour_step: 3,
          },
        },
      },
    });

    const { result: homeResult } = renderHook(() => useFirstRunCoach(), { wrapper: createWrapper('/') });
    expect(homeResult.current.isStepActive(3)).toBe(true);
    expect(homeResult.current.isStepActive(0)).toBe(false);
  });

  it('optimistically advances the step before the profile query refreshes', async () => {
    const { result } = renderHook(() => useFirstRunCoach(), { wrapper: createWrapper('/wardrobe') });

    await act(async () => {
      const promise = result.current.advanceStep();
      expect(result.current.currentStep).toBe(1);
      await waitFor(() => expect(mockMutateAsync).toHaveBeenCalled());
      await promise;
    });
  });

  it('hides the coach immediately when completing the tour', async () => {
    mockUseProfile.mockReturnValue({
      data: {
        preferences: {
          onboarding: {
            completed: true,
            toured: false,
            tour_step: 3,
          },
        },
      },
    });

    const { result } = renderHook(() => useFirstRunCoach(), { wrapper: createWrapper('/') });

    await act(async () => {
      const promise = result.current.completeTour();
      expect(result.current.isActive).toBe(false);
      expect(result.current.currentStep).toBe(99);
      await promise;
    });
  });
});
