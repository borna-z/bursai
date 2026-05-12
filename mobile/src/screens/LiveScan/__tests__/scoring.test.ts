import { scoreFrame, deriveQuality, SCORING_WEIGHTS } from '../scoring';
import type { DetectedObject, FrameMetrics } from '../types';

// A "well-framed" garment: perfectly centered (cx=0.5, cy=0.5), area=0.09
// which equals SIZE_IDEAL_MIN → sizeFit=1.0.
// Expected score: 0.30*1 + 0.30*1 + 0.25*0.8 + 0.15*1 = 0.95 ≥ 0.85.
const centered: DetectedObject = { x: 0.35, y: 0.35, width: 0.30, height: 0.30, confidence: 0.9 };
const metrics: FrameMetrics = { exposure: 0.5, sharpness: 0.8 };

describe('scoreFrame', () => {
  it('weights sum to 1', () => {
    const sum = Object.values(SCORING_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 5);
  });

  it('returns 0 with no detections', () => {
    expect(scoreFrame([], metrics).score).toBe(0);
  });

  it('returns high score for well-framed garment', () => {
    const { score, quality } = scoreFrame([centered], metrics);
    expect(score).toBeGreaterThanOrEqual(0.85);
    expect(quality).toBe('ready');
  });

  it('returns low score when off-center', () => {
    const offcenter: DetectedObject = { x: 0.0, y: 0.0, width: 0.1, height: 0.1, confidence: 0.9 };
    const { quality } = scoreFrame([offcenter], metrics);
    expect(quality).not.toBe('ready');
  });

  it('classifies low_light when exposure is dark', () => {
    const dark: FrameMetrics = { exposure: 0.1, sharpness: 0.8 };
    expect(scoreFrame([centered], dark).quality).toBe('low_light');
  });

  it('classifies too_close when box fills frame', () => {
    const huge: DetectedObject = { x: 0.05, y: 0.05, width: 0.9, height: 0.9, confidence: 0.9 };
    expect(scoreFrame([huge], metrics).quality).toBe('too_close');
  });

  it('classifies too_far when box is tiny', () => {
    const tiny: DetectedObject = { x: 0.48, y: 0.48, width: 0.05, height: 0.05, confidence: 0.9 };
    expect(scoreFrame([tiny], metrics).quality).toBe('too_far');
  });

  it('classifies not_centered when off-center but sized OK', () => {
    // x=0.0, w=0.25, h=0.30 → area=0.075 (above too_far threshold)
    // center_x=0.125, dist=0.375, centeredness=0.47 < CENTERED_THRESHOLD(0.5)
    const offset: DetectedObject = { x: 0.0, y: 0.35, width: 0.25, height: 0.30, confidence: 0.9 };
    expect(scoreFrame([offset], metrics).quality).toBe('not_centered');
  });

  it('picks the largest box when multiple detected', () => {
    const small: DetectedObject = { x: 0.0, y: 0.0, width: 0.05, height: 0.05, confidence: 0.9 };
    const { score } = scoreFrame([small, centered], metrics);
    expect(score).toBeGreaterThanOrEqual(0.85);
  });
});

describe('deriveQuality priority', () => {
  it('low_light beats not_centered', () => {
    expect(deriveQuality({ score: 0.4, sizeFit: 0.5, centeredness: 0.3, exposure: 0.1 })).toBe('low_light');
  });
  it('too_close beats not_centered', () => {
    expect(deriveQuality({ score: 0.4, sizeFit: 0.9, centeredness: 0.3, exposure: 0.5 })).toBe('too_close');
  });
});
