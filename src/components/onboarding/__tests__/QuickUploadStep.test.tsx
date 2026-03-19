import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QuickUploadStep } from '@/components/onboarding/QuickUploadStep';

const uploadGarmentImageMock = vi.fn();
const analyzeGarmentMock = vi.fn();
const insertMock = vi.fn();

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: (key: string) => key }),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

vi.mock('@/hooks/useStorage', () => ({
  useStorage: () => ({ uploadGarmentImage: uploadGarmentImageMock }),
}));

vi.mock('@/hooks/useAnalyzeGarment', () => ({
  useAnalyzeGarment: () => ({ analyzeGarment: analyzeGarmentMock }),
}));

vi.mock('@/hooks/useIsDark', () => ({
  useIsDark: () => false,
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: insertMock,
    })),
  },
}));

describe('QuickUploadStep', () => {
  beforeEach(() => {
    uploadGarmentImageMock.mockReset().mockResolvedValue('user-1/uploaded-path.png');
    analyzeGarmentMock.mockReset().mockResolvedValue({
      data: {
        title: 'Black tee',
        category: 'top',
        subcategory: 't-shirt',
        color_primary: 'black',
        color_secondary: null,
        pattern: null,
        material: 'cotton',
        fit: 'regular',
        season_tags: ['spring'],
        formality: 2,
        ai_provider: 'burs_ai',
        ai_raw: { source: 'test' },
      },
      error: null,
    });
    insertMock.mockReset().mockResolvedValue({ error: null });
  });

  it('uses the shared analyzeGarment contract and persists the returned analysis', async () => {
    render(<QuickUploadStep onComplete={vi.fn()} onSkip={vi.fn()} />);

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['image'], 'shirt.png', { type: 'image/png' });

    fireEvent.change(fileInput, { target: { files: [file] } });
    fireEvent.click(await screen.findByRole('button', { name: /Add 1 garment/i }));

    await waitFor(() => expect(uploadGarmentImageMock).toHaveBeenCalled());
    await waitFor(() => expect(analyzeGarmentMock).toHaveBeenCalledWith('user-1/uploaded-path.png'));
    await waitFor(() =>
      expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({
        image_path: 'user-1/uploaded-path.png',
        title: 'Black tee',
        category: 'top',
        imported_via: 'quick_upload',
        ai_provider: 'burs_ai',
      })),
    );
  });
});
