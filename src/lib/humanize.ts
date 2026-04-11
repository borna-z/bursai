/**
 * Humanize raw enum/key values for user-facing display.
 * Ensures no internal keys, underscores, or raw identifiers leak to the UI.
 */
import { CONFIDENCE_HIGH, CONFIDENCE_MEDIUM } from '@/config/constants';

/** Capitalize first letter and replace underscores/hyphens with spaces */
export function humanize(value: string | null | undefined): string {
  if (!value) return '';
  return value
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

/**
 * Try translation first, fall back to humanized version.
 * Never returns the raw translation key.
 */
export function safeLabel(
  t: (key: string) => string,
  key: string,
  raw: string,
): string {
  const translated = t(key);
  if (!translated) return humanize(raw);
  const segment = key.includes('.') ? key.slice(key.lastIndexOf('.') + 1) : key;
  const humanizedSegment = segment
    .replace(/[_-]/g, ' ')
    .replace(/^./, (c) => c.toUpperCase());
  if (translated === key || translated === humanizedSegment) return humanize(raw);
  return translated;
}

/**
 * Translate a garment category, with humanized fallback.
 */
export function categoryLabel(t: (key: string) => string, category: string): string {
  return safeLabel(t, `garment.category.${category}`, category);
}

/**
 * Translate a color name, with humanized fallback.
 * Handles both Swedish-keyed and English-keyed colors.
 */
export function colorLabel(t: (key: string) => string, color: string): string {
  return safeLabel(t, `color.${color}`, color);
}

/**
 * Translate a garment material, with humanized fallback.
 */
export function materialLabel(t: (key: string) => string, material: string): string {
  return safeLabel(t, `garment.material.${material}`, material);
}

/**
 * Translate a garment pattern, with humanized fallback.
 */
export function patternLabel(t: (key: string) => string, pattern: string): string {
  return safeLabel(t, `garment.pattern.${pattern}`, pattern);
}

/**
 * Translate a garment fit, with humanized fallback.
 */
export function fitLabel(t: (key: string) => string, fit: string): string {
  return safeLabel(t, `garment.fit.${fit}`, fit);
}

/**
 * Translate an occasion, with humanized fallback.
 * Handles mood: prefix.
 */
export function occasionLabel(t: (key: string) => string, occasion: string): string {
  if (occasion.startsWith('mood:')) {
    const moodKey = occasion.replace('mood:', '');
    return safeLabel(t, `ai.mood_${moodKey}`, moodKey);
  }
  return safeLabel(t, `occasion.${occasion.toLowerCase()}`, occasion);
}

/**
 * Translate a season tag, handling Swedish season names.
 */
export function seasonLabel(t: (key: string) => string, season: string): string {
  const SEASON_MAP: Record<string, string> = {
    'vår': 'spring', 'sommar': 'summer', 'höst': 'autumn', 'vinter': 'winter',
  };
  const key = SEASON_MAP[season] || season;
  return safeLabel(t, `garment.season.${key}`, key);
}

/**
 * Confidence level label for AI enrichment attributes.
 */
export function confidenceLabel(confidence: number): { label: string; color: string } {
  if (confidence >= CONFIDENCE_HIGH) return { label: '', color: '' };
  if (confidence >= CONFIDENCE_MEDIUM) return { label: 'Strong match', color: 'text-foreground/50' };
  return { label: '', color: '' };
}

/**
 * Format a limitation note or gap string editorially.
 * Cleans up raw strings from AI responses.
 */
export function editorialFormat(text: string): string {
  if (!text) return '';
  // Replace underscores and hyphens with spaces
  let clean = text.replace(/[_]/g, ' ');
  // Capitalize first letter of sentences
  clean = clean.charAt(0).toUpperCase() + clean.slice(1);
  // Ensure it ends with a period if it doesn't end with punctuation
  if (!/[.!?]$/.test(clean.trim())) {
    clean = clean.trim() + '.';
  }
  return clean;
}
