export type GarmentSupportProfile = 'tops' | 'outerwear' | 'dress' | 'unsupported';

export interface GarmentEligibilityAssessment {
  eligible: boolean;
  profile: GarmentSupportProfile;
  normalizedCategory: string;
  normalizedSubcategory: string | null;
  reason?: string;
}

export interface ProcessedImageMetrics {
  width: number;
  height: number;
  format: 'png' | 'jpeg' | 'webp' | 'unknown';
  byteLength: number;
}

export interface ProcessedImageQualityAssessment {
  accepted: boolean;
  confidence: number;
  issues: string[];
  metrics?: ProcessedImageMetrics;
}

const SUPPORTED_TOP_SUBCATEGORIES = new Set([
  't-shirt',
  'tee',
  'shirt',
  'blouse',
  'sweater',
  'hoodie',
  'cardigan',
  'tank-top',
  'top',
]);

const SUPPORTED_OUTERWEAR_SUBCATEGORIES = new Set([
  'jacket',
  'coat',
  'blazer',
  'vest',
  'outerwear',
]);

const SUPPORTED_DRESS_SUBCATEGORIES = new Set([
  'dress',
  'romper',
  'jumpsuit',
]);

function normalizeValue(value: string | null | undefined): string | null {
  return value?.toLowerCase().replace(/_/g, '-').trim() || null;
}

export function assessGarmentEligibility(category: string, subcategory: string | null, title?: string | null): GarmentEligibilityAssessment {
  const normalizedCategory = normalizeValue(category) || '';
  const normalizedSubcategory = normalizeValue(subcategory);
  const normalizedTitle = normalizeValue(title);

  if (normalizedSubcategory && SUPPORTED_TOP_SUBCATEGORIES.has(normalizedSubcategory)) {
    return { eligible: true, profile: 'tops', normalizedCategory, normalizedSubcategory };
  }

  if (normalizedSubcategory && SUPPORTED_OUTERWEAR_SUBCATEGORIES.has(normalizedSubcategory)) {
    return { eligible: true, profile: 'outerwear', normalizedCategory, normalizedSubcategory };
  }

  if (normalizedSubcategory && SUPPORTED_DRESS_SUBCATEGORIES.has(normalizedSubcategory)) {
    return { eligible: true, profile: 'dress', normalizedCategory, normalizedSubcategory };
  }

  if (normalizedCategory === 'top') {
    return { eligible: true, profile: 'tops', normalizedCategory, normalizedSubcategory };
  }

  if (normalizedCategory === 'outerwear') {
    return { eligible: true, profile: 'outerwear', normalizedCategory, normalizedSubcategory };
  }

  if (normalizedCategory === 'dress' && normalizedTitle && !normalizedTitle.includes('set')) {
    return { eligible: true, profile: 'dress', normalizedCategory, normalizedSubcategory };
  }

  return {
    eligible: false,
    profile: 'unsupported',
    normalizedCategory,
    normalizedSubcategory,
    reason: 'Background removal currently supports tops, outerwear, and dresses only.',
  };
}

function readUint32(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
}

export async function assessProcessedImageQuality(
  bytes: Uint8Array,
  contentType: string | undefined,
  _profile: GarmentSupportProfile,
): Promise<ProcessedImageQualityAssessment> {
  const issues: string[] = [];

  if (!contentType?.startsWith('image/')) {
    issues.push('Processed output must be a valid image response.');
    return { accepted: false, confidence: 0, issues };
  }

  if (bytes.byteLength < 2048) {
    issues.push('Processed output file size is too small to trust.');
    return { accepted: false, confidence: 0, issues };
  }

  let metrics: ProcessedImageMetrics;
  try {
    metrics = inspectBasicImage(bytes);
  } catch (error) {
    issues.push(error instanceof Error ? error.message : 'Unable to validate processed image output.');
    return { accepted: false, confidence: 0, issues };
  }

  if (metrics.width < 300 || metrics.height < 300) {
    issues.push('Processed output dimensions are too small for wardrobe usage.');
  }

  if (metrics.width > 8000 || metrics.height > 8000) {
    issues.push('Processed output dimensions are unexpectedly large.');
  }

  const confidence = issues.length === 0 ? 0.9 : 0.35;

  return {
    accepted: issues.length === 0,
    confidence,
    issues,
    metrics,
  };
}

function isPng(bytes: Uint8Array): boolean {
  return bytes.length >= 24 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a;
}

function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[bytes.length - 2] === 0xff && bytes[bytes.length - 1] === 0xd9;
}

function isWebp(bytes: Uint8Array): boolean {
  return bytes.length >= 16 &&
    String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
    String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
}

function inspectBasicImage(bytes: Uint8Array): ProcessedImageMetrics {
  if (isPng(bytes)) {
    const width = readUint32(bytes, 16);
    const height = readUint32(bytes, 20);
    if (!width || !height) throw new Error('Processed PNG dimensions are invalid.');
    return { width, height, format: 'png', byteLength: bytes.byteLength };
  }

  if (isJpeg(bytes)) {
    let offset = 2;
    while (offset + 8 < bytes.length) {
      if (bytes[offset] !== 0xff) {
        offset += 1;
        continue;
      }

      const marker = bytes[offset + 1];
      if (marker === 0xd8 || marker === 0xd9) {
        offset += 2;
        continue;
      }

      const segmentLength = (bytes[offset + 2] << 8) | bytes[offset + 3];
      if (segmentLength < 2 || offset + 2 + segmentLength > bytes.length) break;

      const isSof = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
      if (isSof) {
        const height = (bytes[offset + 5] << 8) | bytes[offset + 6];
        const width = (bytes[offset + 7] << 8) | bytes[offset + 8];
        if (!width || !height) throw new Error('Processed JPEG dimensions are invalid.');
        return { width, height, format: 'jpeg', byteLength: bytes.byteLength };
      }

      offset += 2 + segmentLength;
    }

    throw new Error('Processed JPEG appears corrupted.');
  }

  if (isWebp(bytes)) {
    const chunkType = String.fromCharCode(...bytes.slice(12, 16));

    if (chunkType === 'VP8X' && bytes.length >= 30) {
      const width = 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16);
      const height = 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16);
      return { width, height, format: 'webp', byteLength: bytes.byteLength };
    }

    if (chunkType === 'VP8 ' && bytes.length >= 30) {
      const width = bytes[26] | ((bytes[27] & 0x3f) << 8);
      const height = bytes[28] | ((bytes[29] & 0x3f) << 8);
      return { width, height, format: 'webp', byteLength: bytes.byteLength };
    }

    if (chunkType === 'VP8L' && bytes.length >= 25) {
      const bits = bytes[21] | (bytes[22] << 8) | (bytes[23] << 16) | (bytes[24] << 24);
      const width = (bits & 0x3fff) + 1;
      const height = ((bits >> 14) & 0x3fff) + 1;
      return { width, height, format: 'webp', byteLength: bytes.byteLength };
    }

    throw new Error('Processed WEBP appears corrupted.');
  }

  throw new Error('Processed image format is unsupported or corrupted.');
}
