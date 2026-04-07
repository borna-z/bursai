import type { ChangeEvent } from 'react';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  navigateMock,
  createGarmentMock,
  refreshSubscriptionMock,
  uploadGarmentImageMock,
  getGarmentSignedUrlMock,
  analyzeGarmentMock,
  checkDuplicatesMock,
  toastSuccessMock,
  toastErrorMock,
  triggerGarmentPostSaveIntelligenceMock,
} = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  createGarmentMock: vi.fn(),
  refreshSubscriptionMock: vi.fn(),
  uploadGarmentImageMock: vi.fn(),
  getGarmentSignedUrlMock: vi.fn(),
  analyzeGarmentMock: vi.fn(),
  checkDuplicatesMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  toastErrorMock: vi.fn(),
  triggerGarmentPostSaveIntelligenceMock: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
}));

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccessMock,
    error: toastErrorMock,
  },
}));

vi.mock('@/hooks/useGarments', () => ({
  useCreateGarment: () => ({ mutateAsync: createGarmentMock }),
  useGarmentCount: () => ({ data: 2 }),
}));

vi.mock('@/hooks/useStorage', () => ({
  useStorage: () => ({
    uploadGarmentImage: uploadGarmentImageMock,
    getGarmentSignedUrl: getGarmentSignedUrlMock,
  }),
}));

vi.mock('@/hooks/useAnalyzeGarment', () => ({
  useAnalyzeGarment: () => ({
    analyzeGarment: analyzeGarmentMock,
    isAnalyzing: false,
  }),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1' },
  }),
}));

vi.mock('@/hooks/useSubscription', () => ({
  useSubscription: () => ({
    canAddGarment: () => true,
    remainingGarments: () => 5,
    refresh: refreshSubscriptionMock,
  }),
}));

vi.mock('@/hooks/useDuplicateDetection', () => ({
  useDuplicateDetection: () => ({
    checkDuplicates: checkDuplicatesMock,
    duplicates: [],
    clearDuplicates: vi.fn(),
  }),
}));

vi.mock('@/hooks/useMedianCamera', () => ({
  useMedianCamera: () => ({
    takePhoto: vi.fn(),
    pickFromGallery: vi.fn(),
  }),
}));

vi.mock('@/lib/imageCompression', () => ({
  compressImage: vi.fn(async (file: File) => ({
    file,
    previewUrl: 'blob:preview',
  })),
}));

vi.mock('@/lib/garmentIntelligence', async () => {
  const actual = await vi.importActual<typeof import('@/lib/garmentIntelligence')>('@/lib/garmentIntelligence');
  return {
    ...actual,
    triggerGarmentPostSaveIntelligence: triggerGarmentPostSaveIntelligenceMock,
  };
});

import { useAddGarment } from '@/hooks/useAddGarment';

describe('useAddGarment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    uploadGarmentImageMock.mockResolvedValue('user-1/garment-1/original.jpg');
    getGarmentSignedUrlMock.mockResolvedValue('https://cdn.example.com/garment-1.jpg');
    analyzeGarmentMock.mockResolvedValue({
      data: {
        title: 'Navy blazer',
        category: 'top',
        subcategory: 'blazer',
        color_primary: 'navy',
        color_secondary: null,
        pattern: 'solid',
        material: 'wool',
        fit: 'regular',
        season_tags: ['autumn'],
        formality: 4,
        ai_provider: 'gemini',
        ai_raw: null,
        confidence: 0.91,
      },
      error: null,
    });
    checkDuplicatesMock.mockResolvedValue([]);
    createGarmentMock.mockResolvedValue({ id: 'garment-1' });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('opens a save-choice sheet before saving and then saves studio quality in the background', async () => {
    const t = (key: string) => ({
      'addgarment.ai_success': 'AI ready',
      'addgarment.ai_review': 'Review the detected details.',
      'addgarment.added': 'Saved.',
      'addgarment.added_desc': 'Studio-quality image is processing in the background. You can keep adding garments.',
      'addgarment.added_original_desc': 'Saved with the original photo. You can keep adding garments.',
      'addgarment.fill_required': 'Fill required fields',
      'common.something_wrong': 'Something went wrong',
    }[key] ?? key);

    const { result } = renderHook(() => useAddGarment({ t }));
    const file = new File(['image'], 'garment.jpg', { type: 'image/jpeg' });

    await act(async () => {
      const selectPromise = result.current.handleImageSelect({
        target: { files: [file] },
      } as ChangeEvent<HTMLInputElement>);
      await Promise.resolve();
      await vi.runAllTimersAsync();
      await selectPromise;
    });

    expect(result.current.step).toBe('form');
    expect(result.current.showConfirmSheet).toBe(false);

    await act(async () => {
      result.current.openSaveChoice();
    });

    expect(result.current.showConfirmSheet).toBe(true);

    await act(async () => {
      await result.current.handleSave(true);
    });

    expect(createGarmentMock).toHaveBeenCalledWith(expect.objectContaining({
      image_path: 'user-1/garment-1/original.jpg',
      title: 'Navy blazer',
      render_status: 'pending',
    }));
    expect(triggerGarmentPostSaveIntelligenceMock).toHaveBeenCalledWith(expect.objectContaining({
      garmentId: expect.any(String),
      source: 'add_photo',
    }));
    expect(refreshSubscriptionMock).toHaveBeenCalled();
    expect(toastSuccessMock).toHaveBeenCalledWith('Saved.', {
      description: 'Studio-quality image is processing in the background. You can keep adding garments.',
    });
    expect(navigateMock).not.toHaveBeenCalledWith('/wardrobe');
    expect(result.current.step).toBe('upload');
    expect(result.current.showConfirmSheet).toBe(false);
    expect(result.current.title).toBe('');
    expect(result.current.imagePreview).toBeNull();
  });

  it('saves with the original photo only when that choice is selected', async () => {
    const t = (key: string) => ({
      'addgarment.ai_success': 'AI ready',
      'addgarment.ai_review': 'Review the detected details.',
      'addgarment.added': 'Saved.',
      'addgarment.added_desc': 'Studio-quality image is processing in the background. You can keep adding garments.',
      'addgarment.added_original_desc': 'Saved with the original photo. You can keep adding garments.',
      'addgarment.fill_required': 'Fill required fields',
      'common.something_wrong': 'Something went wrong',
    }[key] ?? key);

    const { result } = renderHook(() => useAddGarment({ t }));
    const file = new File(['image'], 'garment.jpg', { type: 'image/jpeg' });

    await act(async () => {
      const selectPromise = result.current.handleImageSelect({
        target: { files: [file] },
      } as ChangeEvent<HTMLInputElement>);
      await Promise.resolve();
      await vi.runAllTimersAsync();
      await selectPromise;
    });

    expect(result.current.step).toBe('form');

    await act(async () => {
      result.current.openSaveChoice();
    });

    expect(result.current.showConfirmSheet).toBe(true);

    await act(async () => {
      await result.current.handleSave(false);
    });

    expect(createGarmentMock).toHaveBeenCalledWith(expect.objectContaining({
      render_status: 'none',
    }));
    expect(triggerGarmentPostSaveIntelligenceMock).toHaveBeenCalledWith(expect.objectContaining({
      skipRender: true,
      source: 'add_photo',
      imageProcessing: { mode: 'skip' },
    }));
    expect(toastSuccessMock).toHaveBeenCalledWith('Saved.', {
      description: 'Saved with the original photo. You can keep adding garments.',
    });
  });
});
