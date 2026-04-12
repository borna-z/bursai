import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

const { mockUseFlatGarments, mockInferOccasion } = vi.hoisted(() => ({
  mockUseFlatGarments: vi.fn(),
  mockInferOccasion: vi.fn(),
}));

vi.mock('@/hooks/useGarments', () => ({
  useFlatGarments: (...args: unknown[]) => mockUseFlatGarments(...args),
}));

vi.mock('@/hooks/useCalendarSync', () => ({
  inferOccasionFromEvent: (...args: unknown[]) => mockInferOccasion(...args),
}));

import { useSmartDayRecommendation } from '../useSmartDayRecommendation';
import type { CalendarEvent } from '@/hooks/useCalendarSync';

const ev = (title: string): CalendarEvent => ({
  id: title,
  title,
  date: '2026-01-01',
  start_time: null,
  end_time: null,
  provider: null,
});

const garment = (over: Partial<Record<string, unknown>> = {}) => ({
  id: Math.random().toString(),
  category: 'top',
  in_laundry: false,
  formality: 3,
  color_primary: 'black',
  ...over,
});

describe('useSmartDayRecommendation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns no recommendation when there are no events', () => {
    mockUseFlatGarments.mockReturnValue({ data: [garment()] });
    const { result } = renderHook(() => useSmartDayRecommendation([]));
    expect(result.current.hasRecommendation).toBe(false);
    expect(result.current.slots).toEqual([]);
  });

  it('returns no recommendation when garments are empty', () => {
    mockUseFlatGarments.mockReturnValue({ data: [] });
    const { result } = renderHook(() => useSmartDayRecommendation([ev('meeting')]));
    expect(result.current.hasRecommendation).toBe(false);
  });

  it('returns no recommendation when events is null', () => {
    mockUseFlatGarments.mockReturnValue({ data: [garment()] });
    const { result } = renderHook(() => useSmartDayRecommendation(null));
    expect(result.current.hasRecommendation).toBe(false);
  });

  it('skips events without an inferred occasion', () => {
    mockUseFlatGarments.mockReturnValue({ data: [garment()] });
    mockInferOccasion.mockReturnValue(null);
    const { result } = renderHook(() => useSmartDayRecommendation([ev('mystery thing')]));
    expect(result.current.slots.length).toBe(0);
  });

  it('builds a slot using matched garments for a known occasion', () => {
    const top = garment({ id: 't', category: 'top', formality: 4 });
    const bottom = garment({ id: 'b', category: 'bottom', formality: 4 });
    const shoes = garment({ id: 's', category: 'shoes', formality: 4 });
    mockUseFlatGarments.mockReturnValue({ data: [top, bottom, shoes] });
    mockInferOccasion.mockReturnValue({ occasion: 'work', formality: 4, confidence: 0.9 });

    const { result } = renderHook(() => useSmartDayRecommendation([ev('Work meeting')]));
    expect(result.current.hasRecommendation).toBe(true);
    expect(result.current.slots[0].occasion).toBe('work');
    expect(result.current.slots[0].garments.length).toBeGreaterThan(0);
  });

  it('deduplicates events that map to the same occasion', () => {
    mockUseFlatGarments.mockReturnValue({
      data: [
        garment({ category: 'top' }),
        garment({ category: 'bottom' }),
        garment({ category: 'shoes' }),
      ],
    });
    mockInferOccasion.mockReturnValue({ occasion: 'work', formality: 4, confidence: 0.9 });
    const { result } = renderHook(() =>
      useSmartDayRecommendation([ev('meeting 1'), ev('meeting 2')])
    );
    expect(result.current.slots.length).toBe(1);
  });

  it('caps slots at 2', () => {
    mockUseFlatGarments.mockReturnValue({
      data: [
        garment({ category: 'top' }),
        garment({ category: 'bottom' }),
        garment({ category: 'shoes' }),
      ],
    });
    let toggle = 0;
    mockInferOccasion.mockImplementation(() => {
      toggle++;
      if (toggle === 1) return { occasion: 'work', formality: 4, confidence: 1 };
      if (toggle === 2) return { occasion: 'party', formality: 4, confidence: 1 };
      return { occasion: 'date', formality: 4, confidence: 1 };
    });
    const { result } = renderHook(() =>
      useSmartDayRecommendation([ev('a'), ev('b'), ev('c')])
    );
    expect(result.current.slots.length).toBeLessThanOrEqual(2);
  });
});
