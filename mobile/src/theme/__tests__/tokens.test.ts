// M45 — guard rail: prevent silent regression of the accent-on-accentFg contrast.
// Apple/Play accessibility reviews flag <4.5:1 contrast on interactive surfaces.
// If a future token tweak drops below AA, this test fails before it can land.

import { light, dark } from '../tokens';

function relativeLuminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const linearize = (c: number): number =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

function contrast(fg: string, bg: string): number {
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const [lighter, darker] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (lighter + 0.05) / (darker + 0.05);
}

describe('theme tokens — WCAG AA contrast invariants', () => {
  test('light theme: accentFg on accent ≥ 4.5:1 (WCAG AA normal text)', () => {
    const ratio = contrast(light.accentFg, light.accent);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  test('dark theme: accentFg on accent ≥ 4.5:1 (WCAG AA normal text)', () => {
    const ratio = contrast(dark.accentFg, dark.accent);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  test('light theme: fg on bg ≥ 7:1 (WCAG AAA body text)', () => {
    const ratio = contrast(light.fg, light.bg);
    expect(ratio).toBeGreaterThanOrEqual(7);
  });

  test('dark theme: fg on bg ≥ 7:1 (WCAG AAA body text)', () => {
    const ratio = contrast(dark.fg, dark.bg);
    expect(ratio).toBeGreaterThanOrEqual(7);
  });
});
