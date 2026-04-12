import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';

const { mockUseGarmentCount, mockToast, mockHapticSuccess, mockUseLanguage } = vi.hoisted(() => ({
  mockUseGarmentCount: vi.fn(),
  mockToast: vi.fn(),
  mockHapticSuccess: vi.fn(),
  mockUseLanguage: vi.fn(() => ({ t: (k: string) => k })),
}));

vi.mock('@/hooks/useGarments', () => ({
  useGarmentCount: (...args: unknown[]) => mockUseGarmentCount(...args),
}));

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: (...args: unknown[]) => mockUseLanguage(...args),
}));

vi.mock('sonner', () => ({
  toast: (...args: unknown[]) => mockToast(...args),
}));

vi.mock('@/lib/haptics', () => ({
  hapticSuccess: (...args: unknown[]) => mockHapticSuccess(...args),
}));

import { useWardrobeUnlocks, useUnlockCelebration } from '../useWardrobeUnlocks';

describe('useWardrobeUnlocks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('returns the base tier when garment count is 0', () => {
    mockUseGarmentCount.mockReturnValue({ data: 0 });
    const { result } = renderHook(() => useWardrobeUnlocks());
    expect(result.current.currentCount).toBe(0);
    expect(result.current.isUnlocked('wardrobe')).toBe(true);
    expect(result.current.isUnlocked('outfit_gen')).toBe(false);
    expect(result.current.nextTier?.feature).toBe('outfit_gen');
    expect(result.current.garmentsNeeded).toBe(5);
  });

  it('unlocks higher tiers as count grows', () => {
    mockUseGarmentCount.mockReturnValue({ data: 12 });
    const { result } = renderHook(() => useWardrobeUnlocks());
    expect(result.current.isUnlocked('outfit_gen')).toBe(true);
    expect(result.current.isUnlocked('gap_analysis')).toBe(true);
    expect(result.current.isUnlocked('insights')).toBe(false);
    expect(result.current.nextTier?.minGarments).toBe(20);
    expect(result.current.garmentsNeeded).toBe(8);
  });

  it('returns no nextTier when fully unlocked', () => {
    mockUseGarmentCount.mockReturnValue({ data: 100 });
    const { result } = renderHook(() => useWardrobeUnlocks());
    expect(result.current.nextTier).toBeNull();
    expect(result.current.garmentsNeeded).toBe(0);
    expect(result.current.isUnlocked('insights')).toBe(true);
  });

  it('unknown features are treated as unlocked', () => {
    mockUseGarmentCount.mockReturnValue({ data: 0 });
    const { result } = renderHook(() => useWardrobeUnlocks());
    expect(result.current.isUnlocked('mystery')).toBe(true);
  });

  it('treats undefined garmentCount as 0', () => {
    mockUseGarmentCount.mockReturnValue({ data: undefined });
    const { result } = renderHook(() => useWardrobeUnlocks());
    expect(result.current.currentCount).toBe(0);
  });
});

describe('useUnlockCelebration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('does nothing while garment count is loading', () => {
    mockUseGarmentCount.mockReturnValue({ data: undefined });
    renderHook(() => useUnlockCelebration());
    expect(mockToast).not.toHaveBeenCalled();
  });

  it('does not fire toast below the first milestone', () => {
    mockUseGarmentCount.mockReturnValue({ data: 3 });
    renderHook(() => useUnlockCelebration());
    expect(mockToast).not.toHaveBeenCalled();
  });

  it('fires toast and persists when crossing a milestone', () => {
    mockUseGarmentCount.mockReturnValue({ data: 5 });
    renderHook(() => useUnlockCelebration());
    expect(mockToast).toHaveBeenCalled();
    expect(mockHapticSuccess).toHaveBeenCalled();
    const stored = JSON.parse(localStorage.getItem('burs_celebrated_milestones') || '[]');
    expect(stored).toContain(5);
  });

  it('does not re-fire for already celebrated milestones', () => {
    localStorage.setItem('burs_celebrated_milestones', JSON.stringify([5]));
    mockUseGarmentCount.mockReturnValue({ data: 5 });
    renderHook(() => useUnlockCelebration());
    expect(mockToast).not.toHaveBeenCalled();
  });
});
