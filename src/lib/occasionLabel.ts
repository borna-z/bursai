import { occasionLabel as baseOccasionLabel } from '@/lib/humanize';

/**
 * @deprecated Use `occasionLabel` from `@/lib/humanize` instead.
 */
export function getOccasionLabel(occasion: string, t: (key: string) => string): string {
  return baseOccasionLabel(t, occasion);
}
