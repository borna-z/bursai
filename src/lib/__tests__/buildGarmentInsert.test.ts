import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildGarmentInsert } from '@/lib/buildGarmentInsert';
import type { GarmentIntakeCandidate } from '@/lib/reviewCandidate';
import type { GarmentAnalysis } from '@/hooks/useAnalyzeGarment';

vi.stubGlobal('crypto', {
  randomUUID: vi.fn(() => 'fixed-uuid-0000'),
});

function makeAnalysis(overrides: Partial<GarmentAnalysis> = {}): GarmentAnalysis {
  return {
    title: 'Blue Shirt',
    category: 'top',
    subcategory: 'shirt',
    color_primary: 'blue',
    color_secondary: 'white',
    pattern: 'solid',
    material: 'cotton',
    fit: 'regular',
    season_tags: ['spring', 'summer'],
    formality: 3,
    confidence: 0.9,
    ai_provider: 'burs_ai',
    ai_raw: { source: 'test' },
    ...overrides,
  } as GarmentAnalysis;
}

function makeCandidate(overrides: Partial<GarmentIntakeCandidate> = {}): GarmentIntakeCandidate {
  return {
    blob: new Blob(['image'], { type: 'image/jpeg' }),
    analysis: makeAnalysis(),
    userId: 'user-42',
    source: 'add_photo',
    ...overrides,
  };
}

describe('buildGarmentInsert', () => {
  beforeEach(() => {
    (crypto.randomUUID as ReturnType<typeof vi.fn>).mockReturnValue('fixed-uuid-0000');
  });

  it('builds a payload from the analysis when no overrides are provided', () => {
    const candidate = makeCandidate();
    const insert = buildGarmentInsert(candidate);

    expect(insert.id).toBe('fixed-uuid-0000');
    expect(insert.user_id).toBe('user-42');
    expect(insert.image_path).toBe('user-42/fixed-uuid-0000.jpg');
    expect(insert.title).toBe('Blue Shirt');
    expect(insert.category).toBe('top');
    expect(insert.subcategory).toBe('shirt');
    expect(insert.color_primary).toBe('blue');
    expect(insert.color_secondary).toBe('white');
    expect(insert.pattern).toBe('solid');
    expect(insert.material).toBe('cotton');
    expect(insert.fit).toBe('regular');
    expect(insert.season_tags).toEqual(['spring', 'summer']);
    expect(insert.formality).toBe(3);
    expect(insert.ai_provider).toBe('burs_ai');
    expect(insert.imported_via).toBe('add_photo');
  });

  it('uses field overrides in preference to the analysis', () => {
    const candidate = makeCandidate({
      fieldOverrides: {
        title: 'Custom Title',
        category: 'outerwear',
        subcategory: 'jacket',
        color_primary: 'green',
        color_secondary: null,
        pattern: null,
        material: 'wool',
        fit: 'loose',
        season_tags: ['winter'],
        formality: 5,
        in_laundry: true,
      },
    });
    const insert = buildGarmentInsert(candidate);

    expect(insert.title).toBe('Custom Title');
    expect(insert.category).toBe('outerwear');
    expect(insert.subcategory).toBe('jacket');
    expect(insert.color_primary).toBe('green');
    expect(insert.color_secondary).toBeNull();
    expect(insert.pattern).toBeNull();
    expect(insert.material).toBe('wool');
    expect(insert.fit).toBe('loose');
    expect(insert.season_tags).toEqual(['winter']);
    expect(insert.formality).toBe(5);
    expect(insert.in_laundry).toBe(true);
  });

  it('falls back to safe defaults when analysis fields are missing', () => {
    const candidate = makeCandidate({
      analysis: {
        title: 't',
        category: 'top',
        color_primary: 'black',
      } as unknown as GarmentAnalysis,
    });
    const insert = buildGarmentInsert(candidate);

    expect(insert.subcategory).toBeNull();
    expect(insert.color_secondary).toBeNull();
    expect(insert.pattern).toBeNull();
    expect(insert.material).toBeNull();
    expect(insert.fit).toBeNull();
    expect(insert.season_tags).toEqual([]);
    expect(insert.formality).toBe(3);
    expect(insert.ai_provider).toBe('unknown');
  });

  it('reuses an existing garment id and storage path instead of creating new ones', () => {
    const candidate = makeCandidate({
      existingGarmentId: 'garment-xyz',
    });
    const insert = buildGarmentInsert(candidate, 'user-42/garment-xyz/original.webp');

    expect(insert.id).toBe('garment-xyz');
    expect(insert.image_path).toBe('user-42/garment-xyz/original.webp');
    expect(insert.original_image_path).toBe('user-42/garment-xyz/original.webp');
  });

  it('generates a png extension when the blob is image/png', () => {
    const candidate = makeCandidate({
      blob: new Blob([''], { type: 'image/png' }),
    });
    const insert = buildGarmentInsert(candidate);
    expect(insert.image_path).toBe('user-42/fixed-uuid-0000.png');
  });

  it('omits in_laundry from the payload when no override is provided', () => {
    const candidate = makeCandidate();
    const insert = buildGarmentInsert(candidate);
    expect('in_laundry' in insert).toBe(false);
  });

  it('enables render_status pending by default and disables it when enableStudioQuality is false', () => {
    const enabled = buildGarmentInsert(makeCandidate());
    const disabled = buildGarmentInsert(makeCandidate({ enableStudioQuality: false }));
    expect(enabled.render_status).toBe('pending');
    expect(disabled.render_status).toBe('none');
  });

  it('stamps source into ai_raw system signals', () => {
    const candidate = makeCandidate({ source: 'live_scan', confidence: 0.42 });
    const insert = buildGarmentInsert(candidate);
    const aiRaw = insert.ai_raw as Record<string, unknown>;
    const signals = aiRaw.system_signals as Record<string, unknown>;
    expect(signals.source).toBe('live_scan');
    expect(signals.analysis_confidence).toBe(0.42);
  });
});
