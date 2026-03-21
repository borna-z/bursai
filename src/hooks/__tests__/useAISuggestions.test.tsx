import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const {
  invokeEdgeFunctionMock,
  useAuthMock,
  useLanguageMock,
  useWeatherMock,
  useGarmentCountMock,
} = vi.hoisted(() => ({
  invokeEdgeFunctionMock: vi.fn(),
  useAuthMock: vi.fn(),
  useLanguageMock: vi.fn(),
  useWeatherMock: vi.fn(),
  useGarmentCountMock: vi.fn(),
}));

vi.mock('@/lib/edgeFunctionClient', () => ({
  invokeEdgeFunction: invokeEdgeFunctionMock,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: useAuthMock,
}));

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: useLanguageMock,
}));

vi.mock('@/hooks/useWeather', () => ({
  useWeather: useWeatherMock,
}));

vi.mock('@/hooks/useGarments', () => ({
  useGarmentCount: useGarmentCountMock,
}));

import { useAISuggestions } from '../useAISuggestions';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return {
    queryClient,
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  };
}

describe('useAISuggestions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthMock.mockReturnValue({
      user: { id: 'user-1' },
      session: { access_token: 'token' },
    });
    useLanguageMock.mockReturnValue({ locale: 'en' });
    useWeatherMock.mockReturnValue({
      weather: { temperature: 12, precipitation: 'none', wind: 'low' },
    });
    useGarmentCountMock.mockReturnValue({ data: 3, isLoading: false });
    invokeEdgeFunctionMock.mockResolvedValue({
      data: { suggestions: [{ title: 'Look', garment_ids: [], garments: [], explanation: 'Nice', occasion: 'daily' }] },
      error: null,
    });
  });

  it('does not run until garment count is ready and sufficient', () => {
    useGarmentCountMock.mockReturnValue({ data: 2, isLoading: false });
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useAISuggestions(), { wrapper });

    expect(result.current.fetchStatus).toBe('idle');
    expect(invokeEdgeFunctionMock).not.toHaveBeenCalled();
  });

  it('keys the query by garment count so wardrobe changes do not reuse stale empty results', async () => {
    const { queryClient, wrapper } = createWrapper();

    const first = renderHook(() => useAISuggestions(), { wrapper });
    await waitFor(() => expect(first.result.current.data).toHaveLength(1));

    expect(queryClient.getQueryState(['ai-suggestions', 'user-1', 'en', 3, 12, 'none', 'low'])).toBeTruthy();

    useGarmentCountMock.mockReturnValue({ data: 4, isLoading: false });
    invokeEdgeFunctionMock.mockResolvedValueOnce({
      data: { suggestions: [{ title: 'Fresh look', garment_ids: [], garments: [], explanation: 'Updated', occasion: 'daily' }] },
      error: null,
    });

    const second = renderHook(() => useAISuggestions(), { wrapper });
    await waitFor(() => expect(second.result.current.data?.[0]?.title).toBe('Fresh look'));

    expect(queryClient.getQueryState(['ai-suggestions', 'user-1', 'en', 4, 12, 'none', 'low'])).toBeTruthy();
  });
});
