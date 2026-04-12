import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

const { searchCitiesMock } = vi.hoisted(() => ({
  searchCitiesMock: vi.fn(),
}));

vi.mock('@/hooks/useForecast', () => ({
  searchCities: searchCitiesMock,
}));
vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import { useLocationSuggestions } from '../useLocationSuggestions';

describe('useLocationSuggestions', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    searchCitiesMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns no suggestions for short queries', () => {
    const { result } = renderHook(() => useLocationSuggestions('a'));
    expect(result.current.suggestions).toEqual([]);
    expect(result.current.hasSearched).toBe(false);
    expect(searchCitiesMock).not.toHaveBeenCalled();
  });

  it('debounces and returns results from searchCities', async () => {
    searchCitiesMock.mockResolvedValue([
      {
        display_name: 'Stockholm, Sweden',
        short_name: 'Stockholm, Sweden',
        lat: 59.3,
        lon: 18.0,
        country_code: 'se',
        flag: 'SE',
      },
    ]);
    const { result } = renderHook(() => useLocationSuggestions('Stockholm'));
    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      vi.advanceTimersByTime(300);
      await Promise.resolve();
    });

    await vi.waitFor(() => {
      expect(result.current.suggestions.length).toBe(1);
      expect(result.current.hasSearched).toBe(true);
    });
  });

  it('sets error when searchCities throws', async () => {
    searchCitiesMock.mockRejectedValue(new Error('network'));
    const { result } = renderHook(() => useLocationSuggestions('Berlin'));
    await act(async () => {
      vi.advanceTimersByTime(300);
      await Promise.resolve();
    });
    await vi.waitFor(() => {
      expect(result.current.error).toBeTruthy();
      expect(result.current.suggestions).toEqual([]);
    });
  });

  it('clear() resets state without re-fetching', () => {
    const { result } = renderHook(() => useLocationSuggestions('Paris'));
    act(() => {
      result.current.clear();
    });
    expect(result.current.suggestions).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.hasSearched).toBe(false);
  });
});
