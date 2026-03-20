import type { GarmentImageProviderInput, GarmentImageProviderResult } from './types.ts';

const SUPPORTED_SUBCATEGORIES = new Set([
  't-shirt',
  'shirt',
  'sweater',
  'hoodie',
  'dress',
  'jacket',
  'pants',
  'skirt',
]);

function normalizeSubcategory(value: string | null): string | null {
  return value?.toLowerCase().replace(/_/g, '-').trim() || null;
}

export function isEligibleGarment(category: string, subcategory: string | null): boolean {
  const normalizedSubcategory = normalizeSubcategory(subcategory);
  if (normalizedSubcategory && SUPPORTED_SUBCATEGORIES.has(normalizedSubcategory)) {
    return true;
  }

  return ['top', 'bottom', 'outerwear', 'dress'].includes(category);
}

class UnconfiguredGarmentImageProvider {
  readonly name = 'unconfigured';

  async process(_input: GarmentImageProviderInput): Promise<GarmentImageProviderResult> {
    return {
      success: false,
      provider: this.name,
      confidence: null,
      error: 'Garment image provider is not configured.',
    };
  }
}

function resolveProvider() {
  const provider = Deno.env.get('GARMENT_IMAGE_PROVIDER')?.toLowerCase().trim();

  if (!provider) {
    return new UnconfiguredGarmentImageProvider();
  }

  // Provider adapter seam for future PhotoRoom / Claid integration.
  return new UnconfiguredGarmentImageProvider();
}

export const garmentImageProvider = resolveProvider();
