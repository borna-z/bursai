import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BatchUploadProgress } from '@/components/wardrobe/BatchUploadProgress';

const {
  uploadGarmentImageMock,
  analyzeGarmentMock,
  finalizeCandidateMock,
  updateMock,
  selectMock,
  selectEqMock,
  eqMock,
  invokeEdgeFunctionMock,
  toastSuccessMock,
} = vi.hoisted(() => ({
  uploadGarmentImageMock: vi.fn(),
  analyzeGarmentMock: vi.fn(),
  finalizeCandidateMock: vi.fn(),
  updateMock: vi.fn(),
  selectMock: vi.fn(),
  selectEqMock: vi.fn(),
  eqMock: vi.fn(),
  invokeEdgeFunctionMock: vi.fn(),
  toastSuccessMock: vi.fn(),
}));

vi.mock('@/lib/analytics', () => ({
  trackEvent: vi.fn(),
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

vi.mock('@/lib/finalizeCandidate', () => ({
  finalizeCandidate: finalizeCandidateMock,
}));

vi.mock('sonner', () => ({
  toast: { success: toastSuccessMock },
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
        confidence: 0.9,
        ai_raw: { source: 'test' },
      },
      error: null,
    });
    finalizeCandidateMock.mockReset().mockResolvedValue({
      garmentId: 'garment-1',
      storagePath: 'user-1/actual-upload.webp',
    });
    updateMock.mockClear();
    selectMock.mockClear();
    selectEqMock.mockClear();
    eqMock.mockClear();
    invokeEdgeFunctionMock.mockReset().mockResolvedValue({
      data: { enrichment: { refined_title: 'Blue shirt' } },
      error: null,
    });
    toastSuccessMock.mockReset();
  });

  it('reuses the exact uploaded path for analysis and persistence', async () => {
    const file = new File(['image'], 'source.heic', { type: 'image/heic' });

    render(<BatchUploadProgress files={[file]} onComplete={vi.fn()} onCancel={vi.fn()} />);

    await waitFor(() => expect(uploadGarmentImageMock).toHaveBeenCalled());
    await waitFor(() => expect(analyzeGarmentMock).toHaveBeenCalledWith('user-1/actual-upload.webp', 'fast'));
    await waitFor(() =>
      expect(finalizeCandidateMock).toHaveBeenCalledWith(expect.objectContaining({
        source: 'batch_add',
        userId: 'user-1',
        existingStoragePath: 'user-1/actual-upload.webp',
        existingGarmentId: expect.any(String),
        analysis: expect.objectContaining({
          title: 'Blue shirt',
          category: 'top',
        }),
      })),
    );
  });

  it('queues only low-confidence garments for quick approval', async () => {
    const file = new File(['image'], 'uncertain.jpg', { type: 'image/jpeg' });
    analyzeGarmentMock.mockResolvedValueOnce({
      data: {
        title: 'Dark top',
        category: 'top',
        subcategory: 'shirt',
        color_primary: 'blue',
        season_tags: ['spring'],
        formality: 3,
        confidence: 0.42,
        ai_provider: 'burs_ai',
        ai_raw: { source: 'test' },
      },
      error: null,
    });

    render(<BatchUploadProgress files={[file]} onComplete={vi.fn()} onCancel={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('batch.quick_review')).toBeInTheDocument());
    expect(finalizeCandidateMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'common.add' }));

    await waitFor(() => expect(finalizeCandidateMock).toHaveBeenCalledWith(expect.objectContaining({
      source: 'batch_add',
      existingStoragePath: 'user-1/actual-upload.webp',
      confidence: 0.42,
      analysis: expect.objectContaining({
        title: 'Dark top',
      }),
    })));
  });

  it('auto-saves high-confidence single garments without review', async () => {
    const file = new File(['image'], 'confident.jpg', { type: 'image/jpeg' });

    render(<BatchUploadProgress files={[file]} onComplete={vi.fn()} onCancel={vi.fn()} />);

    await waitFor(() => expect(finalizeCandidateMock).toHaveBeenCalledWith(expect.objectContaining({
      source: 'batch_add',
      existingStoragePath: 'user-1/actual-upload.webp',
      analysis: expect.objectContaining({ title: 'Blue shirt' }),
    })));
    expect(screen.queryByText('batch.quick_review')).not.toBeInTheDocument();
  });

  it('queues multi-garment photos as sequential review items', async () => {
    const file = new File(['image'], 'multi.jpg', { type: 'image/jpeg' });
    analyzeGarmentMock.mockResolvedValueOnce({
      data: {
        title: 'Layered outfit',
        category: 'top',
        subcategory: 'shirt',
        color_primary: 'blue',
        season_tags: ['spring'],
        formality: 3,
        confidence: 0.91,
        image_contains_multiple_garments: true,
        detected_garments: [
          {
            title: 'Blue shirt',
            category: 'top',
            subcategory: 'shirt',
            color_primary: 'blue',
            season_tags: ['spring'],
            formality: 3,
            confidence: 0.88,
          },
          {
            title: 'White sneakers',
            category: 'shoes',
            subcategory: 'sneakers',
            color_primary: 'white',
            season_tags: ['spring'],
            formality: 2,
            confidence: 0.86,
          },
        ],
        ai_provider: 'burs_ai',
        ai_raw: { source: 'test' },
      },
      error: null,
    });

    render(<BatchUploadProgress files={[file]} onComplete={vi.fn()} onCancel={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('batch.quick_review')).toBeInTheDocument());
    expect(screen.getByText('Blue shirt')).toBeInTheDocument();
    expect(screen.getByText('White sneakers')).toBeInTheDocument();
    const reviewItems = screen.getAllByText('batch.multi_review_item');
    expect(reviewItems).toHaveLength(2);
    expect(finalizeCandidateMock).not.toHaveBeenCalled();
  });

  it('keeps the review queue stable while approving one item from a multi-garment photo', async () => {
    const file = new File(['image'], 'multi.jpg', { type: 'image/jpeg' });
    analyzeGarmentMock.mockResolvedValueOnce({
      data: {
        title: 'Layered outfit',
        category: 'top',
        subcategory: 'shirt',
        color_primary: 'blue',
        season_tags: ['spring'],
        formality: 3,
        confidence: 0.91,
        image_contains_multiple_garments: true,
        detected_garments: [
          {
            title: 'Blue shirt',
            category: 'top',
            subcategory: 'shirt',
            color_primary: 'blue',
            season_tags: ['spring'],
            formality: 3,
            confidence: 0.88,
          },
          {
            title: 'White sneakers',
            category: 'shoes',
            subcategory: 'sneakers',
            color_primary: 'white',
            season_tags: ['spring'],
            formality: 2,
            confidence: 0.86,
          },
        ],
        ai_provider: 'burs_ai',
        ai_raw: { source: 'test' },
      },
      error: null,
    });

    render(<BatchUploadProgress files={[file]} onComplete={vi.fn()} onCancel={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('Blue shirt')).toBeInTheDocument());

    fireEvent.click(screen.getAllByRole('button', { name: /add/i })[0]);

    await waitFor(() => expect(finalizeCandidateMock).toHaveBeenCalledWith(expect.objectContaining({
      source: 'batch_add',
      existingStoragePath: 'user-1/actual-upload.webp',
      analysis: expect.objectContaining({ title: 'Blue shirt' }),
    })));
    expect(screen.getByText('White sneakers')).toBeInTheDocument();
  });

  it('does not auto-complete while review items are still pending', async () => {
    const onComplete = vi.fn();
    const file = new File(['image'], 'uncertain.jpg', { type: 'image/jpeg' });

    analyzeGarmentMock.mockResolvedValueOnce({
      data: {
        title: 'Dark top',
        category: 'top',
        subcategory: 'shirt',
        color_primary: 'blue',
        season_tags: ['spring'],
        formality: 3,
        confidence: 0.42,
        ai_provider: 'burs_ai',
        ai_raw: { source: 'test' },
      },
      error: null,
    });

    render(<BatchUploadProgress files={[file]} onComplete={onComplete} onCancel={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('batch.quick_review')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('batch.review_still_needed')).toBeInTheDocument());

    expect(onComplete).not.toHaveBeenCalled();
    expect(toastSuccessMock).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'common.continue' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'common.skip' }));

    await waitFor(() => expect(screen.getByText('batch.review_complete')).toBeInTheDocument());
    const continueButton = screen.getByRole('button', { name: 'common.continue' });
    expect(onComplete).not.toHaveBeenCalled();

    fireEvent.click(continueButton);

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    expect(toastSuccessMock).toHaveBeenCalledTimes(1);
  });
});
