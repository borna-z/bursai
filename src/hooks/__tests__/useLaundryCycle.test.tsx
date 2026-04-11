import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

const { useFlatGarmentsMock, usePlannedOutfitsMock } = vi.hoisted(() => ({
  useFlatGarmentsMock: vi.fn(),
  usePlannedOutfitsMock: vi.fn(),
}));

vi.mock('@/hooks/useGarments', () => ({
  useFlatGarments: useFlatGarmentsMock,
}));

vi.mock('@/hooks/usePlannedOutfits', () => ({
  usePlannedOutfits: usePlannedOutfitsMock,
}));

import { useLaundryCycle } from '../useLaundryCycle';

interface FakeGarment {
  id: string;
  in_laundry: boolean;
  title?: string;
}

function garment(id: string, inLaundry = false): FakeGarment {
  return { id, in_laundry: inLaundry, title: `Garment ${id}` };
}

function plannedOutfit(id: string, date: string, garmentIds: string[]) {
  return {
    id: `pl-${id}`,
    date,
    outfit: {
      id,
      outfit_items: garmentIds.map((gid, idx) => ({
        id: `oi-${id}-${idx}`,
        garment_id: gid,
        garment: { id: gid },
      })),
    },
  };
}

describe('useLaundryCycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useFlatGarmentsMock.mockReturnValue({ data: [] });
    usePlannedOutfitsMock.mockReturnValue({ data: [] });
  });

  it('returns empty state with no garments or planned outfits', () => {
    const { result } = renderHook(() => useLaundryCycle());
    expect(result.current.inLaundryCount).toBe(0);
    expect(result.current.alerts).toEqual([]);
    expect(result.current.nonUrgent).toEqual([]);
  });

  it('returns no alerts when nothing is in laundry', () => {
    useFlatGarmentsMock.mockReturnValue({
      data: [garment('g1'), garment('g2')],
    });
    usePlannedOutfitsMock.mockReturnValue({
      data: [plannedOutfit('o1', '2026-04-12', ['g1', 'g2'])],
    });

    const { result } = renderHook(() => useLaundryCycle());
    expect(result.current.inLaundryCount).toBe(0);
    expect(result.current.alerts).toEqual([]);
  });

  it('creates an alert for a garment in laundry needed by a planned outfit', () => {
    useFlatGarmentsMock.mockReturnValue({
      data: [garment('g1', true), garment('g2')],
    });
    usePlannedOutfitsMock.mockReturnValue({
      data: [plannedOutfit('o1', '2026-04-12', ['g1', 'g2'])],
    });

    const { result } = renderHook(() => useLaundryCycle());
    expect(result.current.inLaundryCount).toBe(1);
    expect(result.current.alerts).toHaveLength(1);
    expect(result.current.alerts[0].garment.id).toBe('g1');
    expect(result.current.alerts[0].neededDate).toBe('2026-04-12');
    expect(result.current.alerts[0].outfitId).toBe('o1');
  });

  it('treats laundry garments not needed by any plan as nonUrgent', () => {
    useFlatGarmentsMock.mockReturnValue({
      data: [garment('g1', true), garment('g2', true)],
    });
    usePlannedOutfitsMock.mockReturnValue({
      data: [plannedOutfit('o1', '2026-04-12', ['g1'])],
    });

    const { result } = renderHook(() => useLaundryCycle());
    expect(result.current.inLaundryCount).toBe(2);
    expect(result.current.alerts).toHaveLength(1);
    expect(result.current.nonUrgent).toHaveLength(1);
    expect(result.current.nonUrgent[0].id).toBe('g2');
  });

  it('sorts alerts by nearest needed date', () => {
    useFlatGarmentsMock.mockReturnValue({
      data: [garment('g1', true), garment('g2', true)],
    });
    usePlannedOutfitsMock.mockReturnValue({
      data: [
        plannedOutfit('later', '2026-04-20', ['g2']),
        plannedOutfit('sooner', '2026-04-12', ['g1']),
      ],
    });

    const { result } = renderHook(() => useLaundryCycle());
    expect(result.current.alerts.map((a) => a.garment.id)).toEqual(['g1', 'g2']);
  });

  it('dedupes when the same laundry garment appears in multiple planned outfits', () => {
    useFlatGarmentsMock.mockReturnValue({
      data: [garment('g1', true)],
    });
    usePlannedOutfitsMock.mockReturnValue({
      data: [
        plannedOutfit('o1', '2026-04-12', ['g1']),
        plannedOutfit('o2', '2026-04-15', ['g1']),
      ],
    });

    const { result } = renderHook(() => useLaundryCycle());
    expect(result.current.alerts).toHaveLength(1);
    expect(result.current.alerts[0].outfitId).toBe('o1');
  });

  it('skips planned entries without an outfit', () => {
    useFlatGarmentsMock.mockReturnValue({
      data: [garment('g1', true)],
    });
    usePlannedOutfitsMock.mockReturnValue({
      data: [{ id: 'pl-empty', date: '2026-04-12', outfit: null }],
    });

    const { result } = renderHook(() => useLaundryCycle());
    expect(result.current.inLaundryCount).toBe(1);
    expect(result.current.alerts).toEqual([]);
    expect(result.current.nonUrgent).toHaveLength(1);
  });

  it('memoizes result when inputs are unchanged between renders', () => {
    const garments = [garment('g1', true)];
    const planned = [plannedOutfit('o1', '2026-04-12', ['g1'])];
    useFlatGarmentsMock.mockReturnValue({ data: garments });
    usePlannedOutfitsMock.mockReturnValue({ data: planned });

    const { result, rerender } = renderHook(() => useLaundryCycle());
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });
});
