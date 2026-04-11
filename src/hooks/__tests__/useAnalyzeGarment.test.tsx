import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const { invokeEdgeFunctionMock, loggerErrorMock } = vi.hoisted(() => ({
  invokeEdgeFunctionMock: vi.fn(),
  loggerErrorMock: vi.fn(),
}));

vi.mock('@/lib/edgeFunctionClient', () => ({
  invokeEdgeFunction: invokeEdgeFunctionMock,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: (k: string) => k, locale: 'en' }),
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: loggerErrorMock, warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { useAnalyzeGarment } from '@/hooks/useAnalyzeGarment';

const validAnalysis = {
  title: 'Blue Tee',
  category: 'top',
  subcategory: 't-shirt',
  color_primary: 'blue',
  season_tags: ['summer'],
  formality: 2,
};

describe('useAnalyzeGarment', () => {
  beforeEach(() => {
    invokeEdgeFunctionMock.mockReset();
    loggerErrorMock.mockReset();
  });

  it('returns analysis data on happy path', async () => {
    invokeEdgeFunctionMock.mockResolvedValue({ data: validAnalysis, error: null });
    const { result } = renderHook(() => useAnalyzeGarment());

    let out;
    await act(async () => {
      out = await result.current.analyzeGarment('user-1/garment.png');
    });

    expect(out).toEqual({ data: validAnalysis, error: null });
  });

  it('returns error when edge function responds with error', async () => {
    invokeEdgeFunctionMock.mockResolvedValue({ data: null, error: new Error('boom') });
    const { result } = renderHook(() => useAnalyzeGarment());

    let out;
    await act(async () => {
      out = await result.current.analyzeGarment('p.png');
    });

    expect(out).toEqual({ data: null, error: 'boom' });
    expect(loggerErrorMock).toHaveBeenCalled();
  });

  it('surfaces data.error as error, not as data', async () => {
    invokeEdgeFunctionMock.mockResolvedValue({
      data: { error: 'analysis rejected' },
      error: null,
    });
    const { result } = renderHook(() => useAnalyzeGarment());

    let out;
    await act(async () => {
      out = await result.current.analyzeGarment('p.png');
    });

    expect(out).toEqual({ data: null, error: 'analysis rejected' });
  });

  it('returns unexpected error when invokeEdgeFunction rejects', async () => {
    invokeEdgeFunctionMock.mockRejectedValue(new Error('network fail'));
    const { result } = renderHook(() => useAnalyzeGarment());

    let out;
    await act(async () => {
      out = await result.current.analyzeGarment('p.png');
    });

    expect(out).toEqual({ data: null, error: 'analyze.unexpected' });
    expect(loggerErrorMock).toHaveBeenCalled();
  });

  it('forwards mode=fast with 12000ms timeout', async () => {
    invokeEdgeFunctionMock.mockResolvedValue({ data: validAnalysis, error: null });
    const { result } = renderHook(() => useAnalyzeGarment());

    await act(async () => {
      await result.current.analyzeGarment('p.png', 'fast');
    });

    expect(invokeEdgeFunctionMock).toHaveBeenCalledWith('analyze_garment', {
      timeout: 12000,
      body: { storagePath: 'p.png', locale: 'en', mode: 'fast' },
    });
  });

  it('forwards mode=full with 35000ms timeout', async () => {
    invokeEdgeFunctionMock.mockResolvedValue({ data: validAnalysis, error: null });
    const { result } = renderHook(() => useAnalyzeGarment());

    await act(async () => {
      await result.current.analyzeGarment('p.png', 'full');
    });

    expect(invokeEdgeFunctionMock).toHaveBeenCalledWith('analyze_garment', {
      timeout: 35000,
      body: { storagePath: 'p.png', locale: 'en', mode: 'full' },
    });
  });
});
