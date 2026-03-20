import type { GarmentImageProviderInput, GarmentImageProviderResult } from './types.ts';
import { assessGarmentEligibility } from './quality.ts';

const PHOTOROOM_REMOVE_BG_URL = 'https://sdk.photoroom.com/v1/segment';
const MIN_OUTPUT_BYTES = 2048;

export function isEligibleGarment(category: string, subcategory: string | null, title?: string | null): boolean {
  return assessGarmentEligibility(category, subcategory, title).eligible;
}

export function getGarmentEligibility(category: string, subcategory: string | null, title?: string | null) {
  return assessGarmentEligibility(category, subcategory, title);
}

class UnconfiguredGarmentImageProvider {
  readonly name = 'unconfigured';

  constructor(private readonly reason = 'Garment image provider is not configured.') {}

  async process(_input: GarmentImageProviderInput): Promise<GarmentImageProviderResult> {
    return {
      success: false,
      provider: this.name,
      confidence: null,
      error: this.reason,
    };
  }
}

class PhotoRoomGarmentImageProvider {
  readonly name = 'photoroom';

  constructor(
    private readonly apiKey: string,
    private readonly endpoint: string,
  ) {}

  async process(input: GarmentImageProviderInput): Promise<GarmentImageProviderResult> {
    try {
      const originalResponse = await fetch(input.originalImageUrl);
      if (!originalResponse.ok) {
        return {
          success: false,
          provider: this.name,
          confidence: null,
          error: `Unable to download original image (${originalResponse.status}).`,
        };
      }

      const originalContentType = originalResponse.headers.get('content-type') || 'image/png';
      const originalBytes = new Uint8Array(await originalResponse.arrayBuffer());
      if (originalBytes.byteLength === 0) {
        return {
          success: false,
          provider: this.name,
          confidence: null,
          error: 'Original garment image is empty.',
        };
      }

      const formData = new FormData();
      formData.append(
        'image_file',
        new Blob([originalBytes], { type: originalContentType }),
        `garment-${input.garmentId}`,
      );
      formData.append('format', 'png');
      formData.append('size', 'hd');
      formData.append('crop', 'true');

      const providerResponse = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'x-api-key': this.apiKey,
        },
        body: formData,
      });

      if (!providerResponse.ok) {
        const providerError = await providerResponse.text();
        return {
          success: false,
          provider: this.name,
          confidence: null,
          error: `PhotoRoom request failed (${providerResponse.status}): ${providerError.slice(0, 160)}`,
        };
      }

      const outputContentType = providerResponse.headers.get('content-type') || 'image/png';
      if (!outputContentType.startsWith('image/')) {
        return {
          success: false,
          provider: this.name,
          confidence: null,
          error: 'PhotoRoom returned a non-image response.',
        };
      }

      const outputBytes = new Uint8Array(await providerResponse.arrayBuffer());
      if (outputBytes.byteLength < MIN_OUTPUT_BYTES) {
        return {
          success: false,
          provider: this.name,
          confidence: null,
          error: 'PhotoRoom output was too small to trust.',
        };
      }

      return {
        success: true,
        provider: this.name,
        confidence: 0.78,
        outputContentType,
        outputBytes,
        notes: [`support-profile:${input.supportProfile}`],
      };
    } catch (error) {
      return {
        success: false,
        provider: this.name,
        confidence: null,
        error: error instanceof Error ? error.message : 'PhotoRoom request failed.',
      };
    }
  }
}

function resolveProvider() {
  const provider = Deno.env.get('GARMENT_IMAGE_PROVIDER')?.toLowerCase().trim();

  if (!provider) {
    return new UnconfiguredGarmentImageProvider();
  }

  if (provider === 'photoroom') {
    const apiKey = Deno.env.get('PHOTOROOM_API_KEY')?.trim();
    const endpoint = Deno.env.get('PHOTOROOM_API_BASE_URL')?.trim() || PHOTOROOM_REMOVE_BG_URL;

    if (!apiKey) {
      return new UnconfiguredGarmentImageProvider('PHOTOROOM_API_KEY is not configured.');
    }

    return new PhotoRoomGarmentImageProvider(apiKey, endpoint);
  }

  return new UnconfiguredGarmentImageProvider();
}

export const garmentImageProvider = resolveProvider();
