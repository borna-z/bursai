import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BatchUploadProgress } from '@/components/wardrobe/BatchUploadProgress';

const {
  uploadGarmentImageMock,
  analyzeGarmentMock,
  createGarmentMock,
  updateMock,
  selectMock,
  selectEqMock,
  eqMock,
  invokeEdgeFunctionMock,
} = vi.hoisted(() => ({
  uploadGarmentImageMock: vi.fn(),
  analyzeGarmentMock: vi.fn(),
  createGarmentMock: vi.fn(),
  updateMock: vi.fn(),
  selectMock: vi.fn(),
  selectEqMock: vi.fn(),
  eqMock: vi.fn(),
  invokeEdgeFunctionMock: vi.fn(),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/hooks/useStorage', () => ({
  useStorage: () => ({ uploadGarmentImage: uploadGarmentImageMock }),
}));

vi.mock('@/hooks/useAnalyzeGarment', () => ({
  useAnalyzeGarment: () => ({ analyzeGarment: analyzeGarmentMock }),
}));

vi.mock('@/hooks/useGarments', () => ({
  useCreateGarment: () => ({ mutateAsync: createGarmentMock }),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn() },
}));

vi.mock('@/lib/edgeFunctionClient', () => ({
  invokeEdgeFunction: invokeEdgeFunctionMock,
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      update: updateMock.mockReturnValue({
        eq: eqMock.mockResolvedValue({ error: null }),
      }),
      select: selectMock.mockReturnValue({
        eq: selectEqMock.mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { ai_raw: null } }),
        }),
      }),
    })),
  },
}));

describe('BatchUploadProgress', () => {
  beforeEach(() => {
    uploadGarmentImageMock.mockReset().mockResolvedValue('user-1/actual-upload.webp');
    analyzeGarmentMock.mockReset().mockResolvedValue({
      data: {
        title: 'Blue shirt',
        category: 'top',
        subcategory: 'shirt',
        color_primary: 'blue',
        season_tags: ['spring'],
        formality: 3,
        ai_provider: 'burs_ai',
        ai_raw: { source: 'test' },
      },
      error: null,
    });
    createGarmentMock.mockReset().mockResolvedValue({ id: 'garment-1' });
    updateMock.mockClear();
    selectMock.mockClear();
    selectEqMock.mockClear();
    eqMock.mockClear();
    invokeEdgeFunctionMock.mockReset().mockResolvedValue({
      data: { enrichment: { refined_title: 'Blue shirt' } },
      error: null,
    });
  });

  it('reuses the exact uploaded path for analysis and persistence', async () => {
    const file = new File(['image'], 'source.heic', { type: 'image/heic' });

    render(<BatchUploadProgress files={[file]} onComplete={vi.fn()} onCancel={vi.fn()} />);

    await waitFor(() => expect(uploadGarmentImageMock).toHaveBeenCalled());
    await waitFor(() => expect(analyzeGarmentMock).toHaveBeenCalledWith('user-1/actual-upload.webp'));
    await waitFor(() =>
      expect(createGarmentMock).toHaveBeenCalledWith(expect.objectContaining({
        image_path: 'user-1/actual-upload.webp',
        title: 'Blue shirt',
        category: 'top',
      })),
    );
    await waitFor(() =>
      expect(invokeEdgeFunctionMock).toHaveBeenCalledWith('detect_duplicate_garment', {
        body: expect.objectContaining({
          image_path: 'user-1/actual-upload.webp',
          category: 'top',
          exclude_garment_id: expect.any(String),
        }),
      }),
    );
  });
});
