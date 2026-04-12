import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const {
  invokeEdgeFunctionMock,
  useCalendarEventsMock,
  useForecastMock,
  useProfileMock,
  useLocationMock,
} = vi.hoisted(() => ({
  invokeEdgeFunctionMock: vi.fn(),
  useCalendarEventsMock: vi.fn(),
  useForecastMock: vi.fn(),
  useProfileMock: vi.fn(),
  useLocationMock: vi.fn(),
}));

vi.mock('@/lib/edgeFunctionClient', () => ({
  invokeEdgeFunction: invokeEdgeFunctionMock,
}));
vi.mock('@/hooks/useCalendarSync', () => ({
  useCalendarEvents: useCalendarEventsMock,
}));
vi.mock('@/hooks/useForecast', () => ({
  useForecast: useForecastMock,
}));
vi.mock('@/hooks/useProfile', () => ({
  useProfile: useProfileMock,
}));
vi.mock('@/contexts/LocationContext', () => ({
  useLocation: useLocationMock,
}));
vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import { useDaySummary } from '../useDaySummary';

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

describe('useDaySummary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useProfileMock.mockReturnValue({ data: { preferences: { language: 'en' } } });
    useLocationMock.mockReturnValue({ effectiveCity: 'Stockholm' });
    useForecastMock.mockReturnValue({ getForecastForDate: vi.fn(() => null) });
  });

  it('is disabled when there are no calendar events', () => {
    useCalendarEventsMock.mockReturnValue({ data: [] });
    const { result } = renderHook(() => useDaySummary('2026-04-11'), { wrapper: wrapper() });
    expect(result.current.fetchStatus).toBe('idle');
    expect(invokeEdgeFunctionMock).not.toHaveBeenCalled();
  });

  it('calls summarize_day with events and weather when forecast available', async () => {
    useCalendarEventsMock.mockReturnValue({
      data: [{ id: 'e1', title: 'Meeting', description: 'team', start_time: '09:00', end_time: '10:00' }],
    });
    useForecastMock.mockReturnValue({
      getForecastForDate: vi.fn(() => ({
        temperature_max: 20,
        temperature_min: 10,
        precipitation_probability: 60,
      })),
    });
    invokeEdgeFunctionMock.mockResolvedValue({
      data: { summary: 'Sunny day', priorities: [], outfit_hints: [], transitions: null, intelligence: null },
      error: null,
    });
    const { result } = renderHook(() => useDaySummary('2026-04-11'), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.data).toBeTruthy());
    expect(invokeEdgeFunctionMock).toHaveBeenCalledWith(
      'summarize_day',
      expect.objectContaining({
        body: expect.objectContaining({
          weather: { temperature: 15, precipitation: 'rain' },
          locale: 'en',
        }),
      }),
    );
  });

  it('throws when edge function returns error', async () => {
    useCalendarEventsMock.mockReturnValue({
      data: [{ id: 'e1', title: 'M', description: '', start_time: '09:00', end_time: '10:00' }],
    });
    invokeEdgeFunctionMock.mockResolvedValue({ data: null, error: new Error('edge down') });
    const { result } = renderHook(() => useDaySummary('2026-04-11'), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 5000 });
  });

  it('returns null when edge function returns no summary', async () => {
    useCalendarEventsMock.mockReturnValue({
      data: [{ id: 'e1', title: 'M', description: '', start_time: '09:00', end_time: '10:00' }],
    });
    invokeEdgeFunctionMock.mockResolvedValue({ data: { summary: '' }, error: null });
    const { result } = renderHook(() => useDaySummary('2026-04-11'), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });
});
