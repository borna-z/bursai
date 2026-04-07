import { describe, expect, it } from 'vitest';
import { resolveCompleteOutfitIds } from '../completeOutfitIds';

const garments = new Map([
  ['top-1', { id: 'top-1', category: 'top', subcategory: 't-shirt', title: 'White tee' }],
  ['bottom-1', { id: 'bottom-1', category: 'bottom', subcategory: 'jeans', title: 'Blue jeans' }],
  ['shoe-1', { id: 'shoe-1', category: 'shoes', subcategory: 'sneakers', title: 'White sneakers' }],
  ['dress-1', { id: 'dress-1', category: 'dress', subcategory: 'slip dress', title: 'Black dress' }],
  ['outer-1', { id: 'outer-1', category: 'outerwear', subcategory: 'blazer', title: 'Black blazer' }],
  ['top-2', { id: 'top-2', category: 'top', subcategory: 'cardigan', title: 'Grey cardigan' }],
]);

describe('resolveCompleteOutfitIds', () => {
  it('accepts valid complete separates', () => {
    expect(resolveCompleteOutfitIds(['top-1', 'bottom-1', 'shoe-1'], garments)).toEqual([
      'top-1',
      'bottom-1',
      'shoe-1',
    ]);
  });

  it('accepts valid complete dress looks', () => {
    expect(resolveCompleteOutfitIds(['dress-1', 'shoe-1'], garments)).toEqual([
      'dress-1',
      'shoe-1',
    ]);
  });

  it('rejects separates without shoes', () => {
    expect(resolveCompleteOutfitIds(['top-1', 'bottom-1'], garments)).toEqual([]);
  });

  it('rejects single-garment outfits', () => {
    expect(resolveCompleteOutfitIds(['dress-1'], garments)).toEqual([]);
  });

  it('rejects duplicate or conflicting core slots', () => {
    expect(resolveCompleteOutfitIds(['top-1', 'top-2', 'bottom-1', 'shoe-1'], garments)).toEqual([]);
    expect(resolveCompleteOutfitIds(['dress-1', 'bottom-1', 'shoe-1'], garments)).toEqual([]);
  });

  it('keeps optional outerwear when the outfit is otherwise complete', () => {
    expect(resolveCompleteOutfitIds(['top-1', 'bottom-1', 'shoe-1', 'outer-1'], garments)).toEqual([
      'top-1',
      'bottom-1',
      'shoe-1',
      'outer-1',
    ]);
  });
});
