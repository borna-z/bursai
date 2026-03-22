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
  useFlatGarmentsMock,
  supabaseInMock,
} = vi.hoisted(() => ({
  invokeEdgeFunctionMock: vi.fn(),
  useAuthMock: vi.fn(),
  useLanguageMock: vi.fn(),
  useWeatherMock: vi.fn(),
  useGarmentCountMock: vi.fn(),
  useFlatGarmentsMock: vi.fn(),
  supabaseInMock: vi.fn(),
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

vi.mock('@/contexts/LocationContext', () => ({
  useLocation: vi.fn(() => ({ effectiveCity: 'Oslo' })),
}));

vi.mock('@/hooks/useGarments', () => ({
  useGarmentCount: useGarmentCountMock,
  useFlatGarments: useFlatGarmentsMock,
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        in: supabaseInMock,
      }),
    }),
  },
}));

import { useAISuggestions, useAISuggestionsVisibility } from '../useAISuggestions';

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
    useFlatGarmentsMock.mockReturnValue({
      data: [
        { id: 'g1', title: 'Top', category: 'top', subcategory: null },
        { id: 'g2', title: 'Bottom', category: 'bottom', subcategory: null },
        { id: 'g7', title: 'Shoes', category: 'shoes', subcategory: null },
      ],
      isLoading: false,
    });
    supabaseInMock.mockResolvedValue({
      data: [
        { id: 'g1', title: 'Top', category: 'top', color_primary: 'black', image_path: 'top.jpg', original_image_path: 'top.jpg', processed_image_path: null, image_processing_status: 'ready', rendered_image_path: null, render_status: 'none' },
        { id: 'g2', title: 'Bottom', category: 'bottom', color_primary: 'blue', image_path: 'bottom.jpg', original_image_path: 'bottom.jpg', processed_image_path: null, image_processing_status: 'ready', rendered_image_path: null, render_status: 'none' },
        { id: 'g7', title: 'Shoes', category: 'shoes', color_primary: 'white', image_path: 'shoes.jpg', original_image_path: 'shoes.jpg', processed_image_path: null, image_processing_status: 'ready', rendered_image_path: null, render_status: 'none' },
      ],
      error: null,
    });
    invokeEdgeFunctionMock.mockResolvedValue({
      data: {
        suggestions: [{
          title: 'Look',
          garment_ids: ['g1', 'g2', 'g7'],
          garments: [
            { id: 'g1', title: 'Top', category: 'top', color_primary: 'black', image_path: 'top.jpg' },
            { id: 'g2', title: 'Bottom', category: 'bottom', color_primary: 'blue', image_path: 'bottom.jpg' },
            { id: 'g7', title: 'Shoes', category: 'shoes', color_primary: 'white', image_path: 'shoes.jpg' },
          ],
          explanation: 'Nice',
          occasion: 'daily',
        }],
      },
      error: null,
    });
  });

  it('does not run until garment count is ready and sufficient', () => {
    useGarmentCountMock.mockReturnValue({ data: 2, isLoading: false });
    useFlatGarmentsMock.mockReturnValue({ data: [], isLoading: false });
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useAISuggestions(), { wrapper });

    expect(result.current.fetchStatus).toBe('idle');
    expect(invokeEdgeFunctionMock).not.toHaveBeenCalled();
  });

  it('filters invalid standard suggestions missing a bottom', async () => {
    supabaseInMock.mockResolvedValueOnce({
      data: [
        { id: 'g3', title: 'Top', category: 'top', color_primary: 'white', image_path: 'top2.jpg', original_image_path: 'top2.jpg', processed_image_path: null, image_processing_status: 'ready', rendered_image_path: null, render_status: 'none' },
        { id: 'g4', title: 'Bottom', category: 'bottom', color_primary: 'blue', image_path: 'bottom.jpg', original_image_path: 'bottom.jpg', processed_image_path: null, image_processing_status: 'ready', rendered_image_path: null, render_status: 'none' },
        { id: 'g8', title: 'Shoes', category: 'shoes', color_primary: 'tan', image_path: 'shoes2.jpg', original_image_path: 'shoes2.jpg', processed_image_path: null, image_processing_status: 'ready', rendered_image_path: null, render_status: 'none' },
      ],
      error: null,
    });
    invokeEdgeFunctionMock.mockResolvedValueOnce({
      data: {
        suggestions: [
          {
            title: 'Bad look',
            garment_ids: ['g1', 'g2'],
            garments: [
              { id: 'g1', title: 'Top', category: 'top', color_primary: 'black', image_path: 'top.jpg' },
              { id: 'g2', title: 'Shoes', category: 'shoes', color_primary: 'black', image_path: 'shoes.jpg' },
            ],
            explanation: 'No bottom',
            occasion: 'daily',
          },
          {
            title: 'Good look',
            garment_ids: ['g3', 'g4', 'g8'],
            garments: [
              { id: 'g3', title: 'Top', category: 'top', color_primary: 'white', image_path: 'top2.jpg' },
              { id: 'g4', title: 'Bottom', category: 'bottom', color_primary: 'blue', image_path: 'bottom.jpg' },
              { id: 'g8', title: 'Shoes', category: 'shoes', color_primary: 'tan', image_path: 'shoes2.jpg' },
            ],
            explanation: 'Valid',
            occasion: 'daily',
          },
        ],
      },
      error: null,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useAISuggestions(), { wrapper });

    await waitFor(() => expect(result.current.data?.suggestions).toHaveLength(1));
    expect(result.current.data?.suggestions?.[0]?.title).toBe('Good look');
  });

  it('returns a missing-slots empty state before calling the edge function when wardrobe cannot build a visible outfit', async () => {
    useFlatGarmentsMock.mockReturnValue({
      data: [
        { id: 'g1', title: 'Top', category: 'top', subcategory: null },
        { id: 'g2', title: 'Bottom', category: 'bottom', subcategory: null },
        { id: 'g3', title: 'Jacket', category: 'outerwear', subcategory: 'jacket' },
      ],
      isLoading: false,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useAISuggestions(), { wrapper });

    await waitFor(() => expect(result.current.data?.emptyState?.missingSlots).toEqual(['shoes']));
    expect(invokeEdgeFunctionMock).not.toHaveBeenCalled();
  });

  it('keys the query by garment count so wardrobe changes do not reuse stale empty results', async () => {
    const { queryClient, wrapper } = createWrapper();

    const first = renderHook(() => useAISuggestions(), { wrapper });
    await waitFor(() => expect(first.result.current.data?.suggestions).toHaveLength(1));

    expect(queryClient.getQueryState(['ai-suggestions', 'user-1', 'en', 3, 12, 'none', 'low'])).toBeTruthy();

    useGarmentCountMock.mockReturnValue({ data: 4, isLoading: false });
    useFlatGarmentsMock.mockReturnValue({
      data: [
        { id: 'g5', title: 'Top', category: 'top', subcategory: null },
        { id: 'g6', title: 'Bottom', category: 'bottom', subcategory: null },
        { id: 'g9', title: 'Shoes', category: 'shoes', subcategory: null },
        { id: 'g10', title: 'Outerwear', category: 'outerwear', subcategory: 'jacket' },
      ],
      isLoading: false,
    });
    supabaseInMock.mockResolvedValueOnce({
      data: [
        { id: 'g5', title: 'Top', category: 'top', color_primary: 'white', image_path: 'top3.jpg', original_image_path: 'top3.jpg', processed_image_path: null, image_processing_status: 'ready', rendered_image_path: null, render_status: 'none' },
        { id: 'g6', title: 'Bottom', category: 'bottom', color_primary: 'black', image_path: 'bottom2.jpg', original_image_path: 'bottom2.jpg', processed_image_path: null, image_processing_status: 'ready', rendered_image_path: null, render_status: 'none' },
        { id: 'g9', title: 'Shoes', category: 'shoes', color_primary: 'black', image_path: 'shoes3.jpg', original_image_path: 'shoes3.jpg', processed_image_path: null, image_processing_status: 'ready', rendered_image_path: null, render_status: 'none' },
      ],
      error: null,
    });
    invokeEdgeFunctionMock.mockResolvedValueOnce({
      data: {
        suggestions: [{
          title: 'Fresh look',
          garment_ids: ['g5', 'g6', 'g9'],
          garments: [
            { id: 'g5', title: 'Top', category: 'top', color_primary: 'white', image_path: 'top3.jpg' },
            { id: 'g6', title: 'Bottom', category: 'bottom', color_primary: 'black', image_path: 'bottom2.jpg' },
            { id: 'g9', title: 'Shoes', category: 'shoes', color_primary: 'black', image_path: 'shoes3.jpg' },
          ],
          explanation: 'Updated',
          occasion: 'daily',
        }],
      },
      error: null,
    });

    const second = renderHook(() => useAISuggestions(), { wrapper });
    await waitFor(() => expect(second.result.current.data?.suggestions?.[0]?.title).toBe('Fresh look'));

    expect(queryClient.getQueryState(['ai-suggestions', 'user-1', 'en', 4, 12, 'none', 'low'])).toBeTruthy();
  });
});

describe('useAISuggestionsVisibility', () => {
  beforeEach(() => {
    useWeatherMock.mockReturnValue({ weather: { temperature: 5, precipitation: 'rain', wind: 'low' } });
  });

  it('uses the effective city for weather-aware visibility checks', () => {
    useGarmentCountMock.mockReturnValue({ data: 3, isLoading: false });
    useFlatGarmentsMock.mockReturnValue({
      data: [
        { id: 'g1', title: 'Top', category: 'top', subcategory: null },
        { id: 'g2', title: 'Bottom', category: 'bottom', subcategory: null },
        { id: 'g3', title: 'Shoes', category: 'shoes', subcategory: null },
      ],
      isLoading: false,
    });

    const { wrapper } = createWrapper();
    renderHook(() => useAISuggestionsVisibility(), { wrapper });

    expect(useWeatherMock).toHaveBeenCalledWith({ city: 'Oslo' });
  });

  it('blocks the Home AI section when weather-required outerwear is missing', () => {
    useGarmentCountMock.mockReturnValue({ data: 3, isLoading: false });
    useFlatGarmentsMock.mockReturnValue({
      data: [
        { id: 'g1', title: 'Top', category: 'top', subcategory: null },
        { id: 'g2', title: 'Bottom', category: 'bottom', subcategory: null },
        { id: 'g3', title: 'Shoes', category: 'shoes', subcategory: null },
      ],
      isLoading: false,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useAISuggestionsVisibility(), { wrapper });

    expect(result.current.canShowBlock).toBe(false);
    expect(result.current.emptyState?.missingSlots).toEqual(['outerwear']);
  });
});
