import { describe, expect, it } from 'vitest';
import { extractPlaceholders, placeholderSetsMatch } from '../placeholders';

describe('extractPlaceholders', () => {
  it('returns empty set for plain string', () => {
    expect(extractPlaceholders('hello world')).toEqual(new Set());
  });
  it('captures single placeholder', () => {
    expect(extractPlaceholders('hi {name}')).toEqual(new Set(['name']));
  });
  it('captures multiple unique placeholders', () => {
    expect(extractPlaceholders('{count} of {total}')).toEqual(new Set(['count', 'total']));
  });
  it('deduplicates repeated placeholders', () => {
    expect(extractPlaceholders('{x} and {x}')).toEqual(new Set(['x']));
  });
  it('ignores non-placeholder braces', () => {
    expect(extractPlaceholders('not { a } placeholder { 1 }')).toEqual(new Set());
  });
});

describe('placeholderSetsMatch', () => {
  it('matches when both empty', () => {
    expect(placeholderSetsMatch('hi', 'hej')).toBe(true);
  });
  it('matches when same placeholders', () => {
    expect(placeholderSetsMatch('hi {name}', 'hej {name}')).toBe(true);
  });
  it('mismatches when target drops a placeholder', () => {
    expect(placeholderSetsMatch('hi {name}', 'hej')).toBe(false);
  });
  it('mismatches when target invents a placeholder', () => {
    expect(placeholderSetsMatch('hi', 'hej {who}')).toBe(false);
  });
  it('mismatches when placeholder renamed', () => {
    expect(placeholderSetsMatch('hi {name}', 'hej {namn}')).toBe(false);
  });
});
