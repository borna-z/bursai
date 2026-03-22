import { describe, expect, it } from 'vitest';

import { getBulkAddSelectionLimit, PREMIUM_BULK_ADD_SELECTION_LIMIT } from '@/lib/bulkAddLimits';

describe('getBulkAddSelectionLimit', () => {
  it('caps premium-style unlimited selection at 50 files', () => {
    expect(getBulkAddSelectionLimit(Infinity)).toBe(PREMIUM_BULK_ADD_SELECTION_LIMIT);
  });

  it('respects free-plan remaining garment slots below the premium batch cap', () => {
    expect(getBulkAddSelectionLimit(4)).toBe(4);
  });

  it('caps large finite remaining counts at the premium batch ceiling', () => {
    expect(getBulkAddSelectionLimit(120)).toBe(PREMIUM_BULK_ADD_SELECTION_LIMIT);
  });

  it('never returns a negative selection count', () => {
    expect(getBulkAddSelectionLimit(-3)).toBe(0);
  });
});
