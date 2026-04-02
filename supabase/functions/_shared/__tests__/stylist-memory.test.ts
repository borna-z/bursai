import { describe, expect, it } from 'vitest';
import { buildStylistMemorySummary } from '../stylist-memory';

describe('buildStylistMemorySummary', () => {
  it('surfaces strong taste signals, planner reliability, and pair memory', () => {
    const result = buildStylistMemorySummary({
      signals: [
        { signal_type: 'save', value: null, metadata: null, created_at: '2026-04-01T10:00:00Z' },
        { signal_type: 'wear_confirm', value: null, metadata: null, created_at: '2026-04-01T11:00:00Z' },
        { signal_type: 'wear_confirm', value: null, metadata: null, created_at: '2026-04-01T12:00:00Z' },
        { signal_type: 'planned_follow_through', value: null, metadata: null, created_at: '2026-04-01T12:30:00Z' },
        { signal_type: 'swap_choice', value: 'shoes', metadata: { slot: 'shoes' }, created_at: '2026-04-01T13:00:00Z' },
        { signal_type: 'swap_choice', value: 'shoes', metadata: { slot: 'shoes' }, created_at: '2026-04-01T14:00:00Z' },
        { signal_type: 'rating', value: '5', metadata: null, created_at: '2026-04-01T15:00:00Z' },
        { signal_type: 'quick_reaction', value: 'polished', metadata: null, created_at: '2026-04-01T16:00:00Z' },
        { signal_type: 'quick_reaction', value: 'too formal', metadata: null, created_at: '2026-04-01T17:00:00Z' },
      ],
      garments: [
        { id: 'g-1', title: 'Cream Tee', category: 'top', color_primary: 'cream', formality: 1, wear_count: 8 },
        { id: 'g-2', title: 'Navy Trouser', category: 'bottom', color_primary: 'navy', formality: 3, wear_count: 6 },
        { id: 'g-3', title: 'Black Loafer', category: 'shoes', color_primary: 'black', formality: 4, wear_count: 4 },
      ],
      pairMemory: [
        {
          garment_a_id: 'g-1',
          garment_b_id: 'g-2',
          positive_count: 3,
          negative_count: 0,
          last_positive_at: '2026-04-01T10:00:00Z',
          last_negative_at: null,
        },
        {
          garment_a_id: 'g-2',
          garment_b_id: 'g-3',
          positive_count: 0,
          negative_count: 2,
          last_positive_at: null,
          last_negative_at: '2026-04-01T10:00:00Z',
        },
      ],
      dna: {
        archetype: 'Modern Classic',
        formalityCenter: 2.6,
      },
    });

    expect(result.promptBlock).toContain('Lean into Modern Classic');
    expect(result.promptBlock).toContain('Wear-backed palette');
    expect(result.promptBlock).toContain('Planner follow-through is solid');
    expect(result.promptBlock).toContain('The user keeps tweaking shoes');
    expect(result.promptBlock).toContain('Proven garment pairings');
    expect(result.promptBlock).toContain('Avoid repeating weak pairings');
    expect(result.insightCount).toBeGreaterThanOrEqual(6);
  });
});
