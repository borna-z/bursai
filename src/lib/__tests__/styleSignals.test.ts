import { describe, expect, it } from 'vitest';
import { collectOccasionSignals, collectStyleSignals } from '../styleSignals';

describe('collectStyleSignals', () => {
  it('normalizes multi-style UI labels into canonical style signals', () => {
    const signals = collectStyleSignals('Scandinavian, Relaxed, Smart Casual');

    expect(signals.has('scandinavian')).toBe(true);
    expect(signals.has('relaxed')).toBe(true);
    expect(signals.has('smart_casual')).toBe(true);
  });

  it('recognizes preppy and edgy aliases', () => {
    const signals = collectStyleSignals(['Preppy', 'biker']);

    expect(signals.has('preppy')).toBe(true);
    expect(signals.has('edgy')).toBe(true);
  });
});

describe('collectOccasionSignals', () => {
  it('maps smart-casual work language into the right occasion buckets', () => {
    const signals = collectOccasionSignals('smart_casual afterwork');

    expect(signals.has('casual')).toBe(true);
    expect(signals.has('work')).toBe(true);
    expect(signals.has('party')).toBe(true);
  });

  it('maps travel and flight language into travel intent', () => {
    const signals = collectOccasionSignals('flight day travel look');

    expect(signals.has('travel')).toBe(true);
  });
});
