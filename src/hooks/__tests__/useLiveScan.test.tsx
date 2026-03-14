import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/lib/edgeFunctionClient', () => ({
  invokeEdgeFunction: vi.fn(),
}));

vi.mock('@/lib/haptics', () => ({
  hapticMedium: vi.fn(),
  hapticSuccess: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    storage: {
      from: vi.fn(),
    },
    from: vi.fn(),
  },
}));

vi.mock('@/lib/imageCompression', () => ({
  compressImage: vi.fn(),
}));

import { useLiveScan } from '@/hooks/useLiveScan';
import { useAuth } from '@/contexts/AuthContext';
import { invokeEdgeFunction } from '@/lib/edgeFunctionClient';
import { supabase } from '@/integrations/supabase/client';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

function mockAuthUser() {
  vi.mocked(useAuth).mockReturnValue({
    user: { id: 'user-1', email: 'test@test.com' } as any,
    session: {} as any,
    loading: false,
    signUp: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
  });
}

const MOCK_ANALYSIS = {
  title: 'Navy Wool Blazer',
  category: 'tops',
  subcategory: 'blazer',
  color_primary: '#1a2a5e',
  color_secondary: null,
  pattern: 'solid',
  material: 'wool',
  fit: 'slim',
  season_tags: ['fall', 'winter'],
  formality: 4,
  ai_provider: 'gemini',
  ai_raw: null,
};

function makeFakeVideo(w = 100, h = 100): HTMLVideoElement {
  return { videoWidth: w, videoHeight: h } as HTMLVideoElement;
}

function setupCanvasMock() {
  const mockBlob = new Blob(['mock-image-data'], { type: 'image/jpeg' });

  const mockCanvas = {
    width: 0,
    height: 0,
    getContext: vi.fn(() => ({ drawImage: vi.fn() })),
    toBlob: vi.fn((cb: BlobCallback) => {
      cb(mockBlob);
    }),
  };

  const originalCreate = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation((tag: string, ...args: any[]) => {
    if (tag === 'canvas') return mockCanvas as unknown as HTMLCanvasElement;
    return originalCreate(tag, ...args);
  });

  return { mockCanvas, mockBlob };
}

function setupFileReaderMock() {
  const MockFileReader = vi.fn(function (this: any) {
    this.result = 'data:image/jpeg;base64,bW9jaw==';
    this.onloadend = null;
    this.readAsDataURL = vi.fn(() => {
      Promise.resolve().then(() => this.onloadend?.());
    });
  });
  vi.stubGlobal('FileReader', MockFileReader);
}

function setupUrlMock() {
  vi.stubGlobal('URL', {
    createObjectURL: vi.fn(() => 'blob:mock-thumbnail-url'),
    revokeObjectURL: vi.fn(),
  });
}

function setupSupabaseMock() {
  const uploadMock = vi.fn().mockResolvedValue({ error: null });
  const insertMock = vi.fn().mockResolvedValue({ error: null });

  vi.mocked(supabase.storage.from).mockReturnValue({
    upload: uploadMock,
  } as any);

  vi.mocked(supabase.from).mockReturnValue({
    insert: insertMock,
  } as any);

  return { uploadMock, insertMock };
}

describe('useLiveScan', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('initialises with empty state', () => {
    mockAuthUser();

    const { result } = renderHook(() => useLiveScan(), {
      wrapper: createWrapper(),
    });

    expect(result.current.scanCount).toBe(0);
    expect(result.current.isProcessing).toBe(false);
    expect(result.current.lastResult).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('accept() is a no-op when lastResult is null', () => {
    mockAuthUser();
    setupSupabaseMock();

    const { result } = renderHook(() => useLiveScan(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.accept();
    });

    expect(result.current.scanCount).toBe(0);
    expect(result.current.lastResult).toBeNull();
    expect(supabase.storage.from).not.toHaveBeenCalled();
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('retake() clears error when lastResult is already null', () => {
    mockAuthUser();

    const { result } = renderHook(() => useLiveScan(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.retake();
    });

    expect(result.current.lastResult).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('capture() populates lastResult, then accept() clears it, increments scanCount, and triggers the background save', async () => {
    mockAuthUser();
    setupCanvasMock();
    setupFileReaderMock();
    setupUrlMock();
    const { uploadMock, insertMock } = setupSupabaseMock();

    vi.mocked(invokeEdgeFunction).mockResolvedValue({
      data: MOCK_ANALYSIS,
      error: null,
    });

    vi.stubGlobal('crypto', { randomUUID: vi.fn(() => 'mock-garment-uuid') });

    const { result } = renderHook(() => useLiveScan(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.capture(makeFakeVideo());
    });

    await waitFor(() => expect(result.current.lastResult).not.toBeNull());

    expect(result.current.isProcessing).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.lastResult?.analysis.title).toBe('Navy Wool Blazer');
    expect(result.current.lastResult?.thumbnailUrl).toBe('blob:mock-thumbnail-url');
    expect(invokeEdgeFunction).toHaveBeenCalledWith('analyze_garment', {
      body: { base64Image: expect.stringContaining('data:image/jpeg') },
    });

    act(() => {
      result.current.accept();
    });

    expect(result.current.lastResult).toBeNull();
    expect(result.current.scanCount).toBe(1);

    await act(async () => {
      await result.current.finish();
    });

    expect(supabase.storage.from).toHaveBeenCalledWith('garments');
    expect(uploadMock).toHaveBeenCalledWith(
      'user-1/mock-garment-uuid.jpg',
      expect.any(Blob),
      expect.objectContaining({ contentType: 'image/jpeg' }),
    );
    expect(supabase.from).toHaveBeenCalledWith('garments');
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'mock-garment-uuid',
        user_id: 'user-1',
        title: 'Navy Wool Blazer',
        category: 'tops',
        imported_via: 'live_scan',
      }),
    );
  });

  it('capture() sets error state when the edge function returns an error', async () => {
    mockAuthUser();
    setupCanvasMock();
    setupFileReaderMock();
    setupUrlMock();

    vi.mocked(invokeEdgeFunction).mockResolvedValue({
      data: null,
      error: new Error('AI service unavailable'),
    });

    const { result } = renderHook(() => useLiveScan(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.capture(makeFakeVideo());
    });

    await waitFor(() => expect(result.current.error).not.toBeNull());

    expect(result.current.error).toBe('AI service unavailable');
    expect(result.current.lastResult).toBeNull();
    expect(result.current.isProcessing).toBe(false);
  });
});
