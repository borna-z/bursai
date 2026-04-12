import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import { useForecast } from '../useForecast';

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

describe('useForecast', () => {
  it('is disabled when enabled: false', () => {
    const { result } = renderHook(() => useForecast({ enabled: false }), { wrapper: wrapper() });
    expect(result.current.forecast).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns forecast list on success', async () => {
    // 1st: nominatim coords for "Stockholm"
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => [{ lat: '59.3', lon: '18.0' }],
    });
    // 2nd: open-meteo forecast
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        daily: {
          time: ['2026-04-11', '2026-04-12'],
          temperature_2m_max: [10, 12],
          temperature_2m_min: [3, 4],
          weather_code: [0, 3],
          precipitation_probability_max: [10, 20],
        },
      }),
    });

    const { result } = renderHook(() => useForecast({ city: 'Stockholm' }), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.forecast.length).toBe(2));
    expect(result.current.forecast[0].temperature_max).toBe(10);
  });

  it('exposes a getForecastForDate accessor', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => [{ lat: '59', lon: '18' }] });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        daily: {
          time: ['2026-04-11'],
          temperature_2m_max: [15],
          temperature_2m_min: [8],
          weather_code: [0],
          precipitation_probability_max: [5],
        },
      }),
    });
    const { result } = renderHook(() => useForecast({ city: 'Stockholm' }), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.forecast.length).toBe(1));
    expect(result.current.getForecastForDate('2026-04-11')?.temperature_max).toBe(15);
    expect(result.current.getForecastForDate('1999-01-01')).toBeNull();
  });

  it('starts in loading state when enabled', () => {
    fetchMock.mockImplementation(() => new Promise(() => {})); // never resolves
    const { result } = renderHook(() => useForecast({ city: 'Stockholm' }), { wrapper: wrapper() });
    expect(result.current.isLoading).toBe(true);
    expect(result.current.error).toBeNull();
  });
});
