import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { saveGarmentInBackground, type SaveableResult } from '@/lib/backgroundGarmentSave';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    storage: { from: vi.fn() },
    from: vi.fn(),
  },
}));

import { supabase } from '@/integrations/supabase/client';

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
  ai_raw: null,
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

  it('uploads image then inserts garment record', async () => {
    const uploadMock = vi.fn().mockResolvedValue({ error: null });
    const insertMock = vi.fn().mockResolvedValue({ error: null });
    vi.mocked(supabase.storage.from).mockReturnValue({ upload: uploadMock } as any);
    vi.mocked(supabase.from).mockReturnValue({ insert: insertMock } as any);

    await saveGarmentInBackground(makeResult(), 'user-1');

    expect(supabase.storage.from).toHaveBeenCalledWith('garments');
    expect(uploadMock).toHaveBeenCalledWith(
      'user-1/test-uuid.jpg',
      expect.any(Blob),
      expect.objectContaining({ contentType: 'image/jpeg' }),
    );
    expect(supabase.from).toHaveBeenCalledWith('garments');
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'test-uuid',
        user_id: 'user-1',
        title: 'Navy Blazer',
        category: 'tops',
        imported_via: 'live_scan',
        ai_provider: 'unknown',
      }),
    );
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-thumb');
  });

  it('skips insert when upload fails and still revokes URL', async () => {
    const uploadMock = vi.fn().mockResolvedValue({ error: { message: 'Storage full' } });
    vi.mocked(supabase.storage.from).mockReturnValue({ upload: uploadMock } as any);
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await saveGarmentInBackground(makeResult(), 'user-1');

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

    await saveGarmentInBackground(makeResult(), 'user-1');

    expect(consoleSpy).toHaveBeenCalledWith('Insert error:', expect.objectContaining({ message: 'RLS violation' }));
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-thumb');
  });
});
