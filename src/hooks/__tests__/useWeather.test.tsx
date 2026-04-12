import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const { mockGetCoordsFromCity, mockUseLanguage } = vi.hoisted(() => ({
  mockGetCoordsFromCity: vi.fn(),
  mockUseLanguage: vi.fn(() => ({ locale: 'en', t: (k: string) => k })),
}));

vi.mock('@/hooks/useForecast', () => ({
  getCoordinatesFromCity: (...args: unknown[]) => mockGetCoordsFromCity(...args),
}));

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: (...args: unknown[]) => mockUseLanguage(...args),
}));

import { useWeather } from '../useWeather';

const createWrapper = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
};

const sampleApiResponse = {
  current: {
    temperature_2m: 12.4,
    weather_code: 61,
    wind_speed_10m: 18,
    is_day: 1,
  },
};

describe('useWeather', () => {
  let originalFetch: typeof fetch;
  let originalGeo: typeof navigator.geolocation;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    originalGeo = navigator.geolocation;
    vi.clearAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    Object.defineProperty(navigator, 'geolocation', { value: originalGeo, writable: true, configurable: true });
  });

  it('returns initial loading state with no data', () => {
    globalThis.fetch = vi.fn(() => new Promise(() => {})) as unknown as typeof fetch;
    mockGetCoordsFromCity.mockResolvedValue({ lat: 1, lon: 2 });
    const { result } = renderHook(() => useWeather({ city: 'Stockholm' }), { wrapper: createWrapper() });
    expect(result.current.weather).toBeNull();
    expect(result.current.isLoading).toBe(true);
  });

  it('fetches weather using a provided city', async () => {
    mockGetCoordsFromCity.mockResolvedValue({ lat: 59.3, lon: 18.0 });
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => sampleApiResponse,
    })) as unknown as typeof fetch;

    const { result } = renderHook(() => useWeather({ city: 'Stockholm' }), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.weather).not.toBeNull());

    expect(result.current.weather?.location).toBe('Stockholm');
    expect(result.current.weather?.temperature).toBe(12);
    // weather_code 61 → rain
    expect(result.current.weather?.precipitation).toBe('rain');
    // wind 18 → medium
    expect(result.current.weather?.wind).toBe('medium');
    expect(result.current.weather?.is_day).toBe(true);
  });

  it('returns an error when the API call fails', async () => {
    mockGetCoordsFromCity.mockResolvedValue({ lat: 1, lon: 2 });
    globalThis.fetch = vi.fn(async () => ({ ok: false })) as unknown as typeof fetch;

    const { result } = renderHook(() => useWeather({ city: 'Nowhere' }), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.error).toContain('Could not fetch');
  });

  it('falls back to Stockholm coords when no city and no geolocation', async () => {
    Object.defineProperty(navigator, 'geolocation', { value: undefined, writable: true, configurable: true });
    let meteoUrl = '';
    globalThis.fetch = vi.fn(async (url: string) => {
      if (url.includes('open-meteo')) {
        meteoUrl = url;
        return { ok: true, json: async () => sampleApiResponse } as unknown as Response;
      }
      return { ok: true, json: async () => ({ address: { city: 'Stockholm' } }) } as unknown as Response;
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useWeather(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.weather).not.toBeNull());
    expect(meteoUrl).toContain('latitude=59.3293');
  });

  it('reverse geocodes when no city is provided but geolocation succeeds', async () => {
    Object.defineProperty(navigator, 'geolocation', {
      value: {
        getCurrentPosition: (success: PositionCallback) => {
          success({
            coords: { latitude: 40.7, longitude: -74.0 },
          } as GeolocationPosition);
        },
      },
      writable: true,
      configurable: true,
    });

    globalThis.fetch = vi.fn(async (url: string) => {
      if (url.includes('open-meteo')) {
        return { ok: true, json: async () => sampleApiResponse } as unknown as Response;
      }
      return {
        ok: true,
        json: async () => ({ address: { city: 'New York' } }),
      } as unknown as Response;
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useWeather(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.weather).not.toBeNull());
    expect(result.current.weather?.location).toBe('New York');
  });
});
