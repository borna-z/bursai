import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { saveGarmentInBackground, type SaveableResult } from '@/lib/backgroundGarmentSave';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    storage: { from: vi.fn() },
    from: vi.fn(),
  },
}));

vi.mock('@/lib/edgeFunctionClient', () => ({
  invokeEdgeFunction: vi.fn(),
}));

vi.mock('@/lib/removeBackground', () => ({
  removeBackground: vi.fn(async (input: Blob) => input),
}));

import { supabase } from '@/integrations/supabase/client';
import { invokeEdgeFunction } from '@/lib/edgeFunctionClient';

const MOCK_ANALYSIS = {
  title: 'Navy Blazer',
  category: 'tops',
  subcategory: 'blazer',
  color_primary: '#1a2a5e',
  color_secondary: null,
  pattern: 'solid',
  material: 'wool',
  fit: 'slim',
  season_tags: ['fall', 'winter'],
  formality: 4,
  ai_provider: '',
  confidence: 0.42,
  ai_raw: { confidence: 0.42 },
};

function makeResult(): SaveableResult {
  return {
    analysis: MOCK_ANALYSIS as any,
    thumbnailUrl: 'blob:mock-thumb',
    blob: new Blob(['data'], { type: 'image/jpeg' }),
  };
}

describe('saveGarmentInBackground', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(),
      revokeObjectURL: vi.fn(),
    });
    vi.stubGlobal('crypto', { randomUUID: vi.fn(() => 'test-uuid') });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uploads image then inserts garment record and triggers enrichment', async () => {
    const uploadMock = vi.fn().mockResolvedValue({ error: null });
    const insertMock = vi.fn().mockResolvedValue({ error: null });
    const selectMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { ai_raw: {} }, error: null }),
      }),
    });
    const updateMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    vi.mocked(supabase.storage.from).mockReturnValue({ upload: uploadMock } as any);
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'garments') {
        return { insert: insertMock, select: selectMock, update: updateMock } as any;
      }
      return { insert: vi.fn().mockResolvedValue({ error: null }) } as any;
    });

    // Mock enrichment edge function call
    vi.mocked(invokeEdgeFunction).mockResolvedValue({
      data: { enrichment: { neckline: 'collar', refined_title: 'Navy Wool Blazer' } },
      error: null,
    });

    const saved = await saveGarmentInBackground(makeResult(), 'user-1');

    expect(saved).toEqual({
      garmentId: 'test-uuid',
      storagePath: 'user-1/test-uuid/original.jpg',
    });

    expect(supabase.storage.from).toHaveBeenCalledWith('garments');
    expect(uploadMock).toHaveBeenCalledWith(
      'user-1/test-uuid/original.jpg',
      expect.any(Blob),
      expect.objectContaining({ contentType: 'image/jpeg' }),
    );
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'test-uuid',
        user_id: 'user-1',
        title: 'Navy Blazer',
        category: 'tops',
        imported_via: 'live_scan',
        ai_provider: 'unknown',
        ai_raw: expect.objectContaining({
          confidence: 0.42,
          system_signals: expect.objectContaining({
            analysis_confidence: 0.42,
            source: 'live_scan',
          }),
        }),
        render_status: 'pending',
      }),
    );
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-thumb');

    // Verify enrichment was triggered (fire-and-forget, so it may not have completed)
    // The enrichment call is non-blocking so we just verify it was called
    await vi.waitFor(() => {
      expect(invokeEdgeFunction).toHaveBeenCalledWith('analyze_garment', {
        body: { storagePath: 'user-1/test-uuid/original.jpg', mode: 'enrich' },
      });
      expect(invokeEdgeFunction).toHaveBeenCalledWith('render_garment_image', expect.objectContaining({
        body: { garmentId: 'test-uuid', source: 'live_scan' },
      }));
    });
  });

  it('skips insert when upload fails and still revokes URL', async () => {
    const uploadMock = vi.fn().mockResolvedValue({ error: { message: 'Storage full' } });
    vi.mocked(supabase.storage.from).mockReturnValue({ upload: uploadMock } as any);
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const saved = await saveGarmentInBackground(makeResult(), 'user-1');

    expect(saved).toBeNull();
    expect(supabase.from).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith('Upload error:', expect.objectContaining({ message: 'Storage full' }));
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-thumb');
  });

  it('logs insert error but still revokes URL', async () => {
    const uploadMock = vi.fn().mockResolvedValue({ error: null });
    const insertMock = vi.fn().mockResolvedValue({ error: { message: 'RLS violation' } });
    vi.mocked(supabase.storage.from).mockReturnValue({ upload: uploadMock } as any);
    vi.mocked(supabase.from).mockReturnValue({ insert: insertMock } as any);
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const saved = await saveGarmentInBackground(makeResult(), 'user-1');

    expect(saved).toBeNull();
    expect(consoleSpy).toHaveBeenCalledWith('Insert error:', expect.objectContaining({ message: 'RLS violation' }));
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-thumb');
  });

  it('triggers duplicate detection after successful insert', async () => {
    const uploadMock = vi.fn().mockResolvedValue({ error: null });
    const insertMock = vi.fn().mockResolvedValue({ error: null });
    vi.mocked(supabase.storage.from).mockReturnValue({ upload: uploadMock } as any);
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'garments') {
        return {
          insert: insertMock,
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { ai_raw: {} }, error: null }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        } as any;
      }
      return { insert: vi.fn().mockResolvedValue({ error: null }) } as any;
    });

    vi.mocked(invokeEdgeFunction).mockResolvedValue({
      data: { enrichment: { neckline: 'crew' } },
      error: null,
    });

    await saveGarmentInBackground(makeResult(), 'user-1');

    // Wait for async background tasks
    await vi.waitFor(() => {
      const calls = vi.mocked(invokeEdgeFunction).mock.calls;
      const dupCall = calls.find(c => c[0] === 'detect_duplicate_garment');
      expect(dupCall).toBeDefined();
      expect(dupCall![1]).toEqual({
        body: expect.objectContaining({
          image_path: 'user-1/test-uuid/original.jpg',
          category: 'tops',
          color_primary: '#1a2a5e',
          exclude_garment_id: 'test-uuid',
        }),
      });
    });
  });

  it('stores the original photo as-is when studio quality is disabled', async () => {
    const uploadMock = vi.fn().mockResolvedValue({ error: null });
    const insertMock = vi.fn().mockResolvedValue({ error: null });
    vi.mocked(supabase.storage.from).mockReturnValue({ upload: uploadMock } as any);
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'garments') {
        return { insert: insertMock } as any;
      }
      return { insert: vi.fn().mockResolvedValue({ error: null }) } as any;
    });

    await saveGarmentInBackground(makeResult(), 'user-1', undefined, { enableStudioQuality: false });

    expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({
      render_status: 'none',
      image_processing_status: 'ready',
      image_path: 'user-1/test-uuid/original.jpg',
      original_image_path: 'user-1/test-uuid/original.jpg',
      processed_image_path: null,
    }));

    await Promise.resolve();
    expect(vi.mocked(invokeEdgeFunction)).not.toHaveBeenCalledWith(
      'render_garment_image',
      expect.anything(),
    );
  });
});
