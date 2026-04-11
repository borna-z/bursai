import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const mockUseAuth = vi.fn();
const mockUseProfile = vi.fn();
const mockMutateAsync = vi.fn();

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: (...args: unknown[]) => mockUseAuth(...args),
}));

vi.mock('../useProfile', () => ({
  useProfile: (...args: unknown[]) => mockUseProfile(...args),
  useUpdateProfile: vi.fn(() => ({ mutateAsync: mockMutateAsync })),
}));

import { useOnboarding } from '../useOnboarding';

describe('useOnboarding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: { id: 'user-1' } });
    mockUseProfile.mockReturnValue({ data: null, isLoading: false });
    mockMutateAsync.mockResolvedValue({});
  });

  it('returns safe defaults when profile is null', () => {
    mockUseProfile.mockReturnValue({ data: null, isLoading: false });
    const { result } = renderHook(() => useOnboarding());
    expect(result.current.completed).toBe(false);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.needsOnboarding).toBe(true);
  });

  it('reports completed=true when prefs.onboarding.completed is true', () => {
    mockUseProfile.mockReturnValue({
      data: { preferences: { onboarding: { completed: true } } },
      isLoading: false,
    });
    const { result } = renderHook(() => useOnboarding());
    expect(result.current.completed).toBe(true);
    expect(result.current.needsOnboarding).toBe(false);
  });

  it('needsOnboarding is false while loading', () => {
    mockUseProfile.mockReturnValue({ data: null, isLoading: true });
    const { result } = renderHook(() => useOnboarding());
    expect(result.current.isLoading).toBe(true);
    expect(result.current.needsOnboarding).toBe(false);
  });

  it('needsOnboarding is false when there is no user', () => {
    mockUseAuth.mockReturnValue({ user: null });
    mockUseProfile.mockReturnValue({ data: null, isLoading: false });
    const { result } = renderHook(() => useOnboarding());
    expect(result.current.needsOnboarding).toBe(false);
  });

  it('completeOnboarding no-ops when profile is missing', async () => {
    mockUseProfile.mockReturnValue({ data: null, isLoading: false });
    const { result } = renderHook(() => useOnboarding());
    await act(async () => {
      await result.current.completeOnboarding();
    });
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it('completeOnboarding merges into preferences with onboarding.completed=true', async () => {
    mockUseProfile.mockReturnValue({
      data: { preferences: { theme: 'dark', onboarding: { completed: false } } },
      isLoading: false,
    });
    const { result } = renderHook(() => useOnboarding());
    await act(async () => {
      await result.current.completeOnboarding();
    });
    expect(mockMutateAsync).toHaveBeenCalledTimes(1);
    expect(mockMutateAsync).toHaveBeenCalledWith({
      preferences: {
        theme: 'dark',
        onboarding: { completed: true },
      },
    });
  });

  it('completeOnboarding works when profile has no preferences object yet', async () => {
    mockUseProfile.mockReturnValue({
      data: { preferences: null },
      isLoading: false,
    });
    const { result } = renderHook(() => useOnboarding());
    await act(async () => {
      await result.current.completeOnboarding();
    });
    expect(mockMutateAsync).toHaveBeenCalledWith({
      preferences: { onboarding: { completed: true } },
    });
  });
});
