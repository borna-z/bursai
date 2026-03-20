import { inflateSync } from 'node:zlib';

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
  hasAlpha: boolean;
  opaqueCoverage: number;
  borderTouchRatio: number;
  bboxWidthRatio: number;
  bboxHeightRatio: number;
  centerOffsetX: number;
  centerOffsetY: number;
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
    reason: 'Conservative garment restructure v2.1 currently supports tops, outerwear, and dresses only.',
  };
}

function readUint32(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
}

async function inflateZlib(bytes: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(inflateSync(bytes));
}

function paethPredictor(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

async function decodePngRgba(bytes: Uint8Array): Promise<{ width: number; height: number; rgba: Uint8Array; hasAlpha: boolean }> {
  const signature = '137,80,78,71,13,10,26,10';
  if (Array.from(bytes.slice(0, 8)).join(',') !== signature) {
    throw new Error('Processed output is not a PNG file.');
  }

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idatParts: Uint8Array[] = [];

  while (offset + 8 <= bytes.length) {
    const length = readUint32(bytes, offset);
    offset += 4;
    const chunkType = new TextDecoder().decode(bytes.slice(offset, offset + 4));
    offset += 4;
    const chunkData = bytes.slice(offset, offset + length);
    offset += length + 4; // data + crc

    if (chunkType === 'IHDR') {
      width = readUint32(chunkData, 0);
      height = readUint32(chunkData, 4);
      bitDepth = chunkData[8];
      colorType = chunkData[9];
    } else if (chunkType === 'IDAT') {
      idatParts.push(chunkData);
    } else if (chunkType === 'IEND') {
      break;
    }
  }

  if (!width || !height || !idatParts.length) {
    throw new Error('Processed PNG is missing required image chunks.');
  }

  if (bitDepth !== 8 || ![2, 6].includes(colorType)) {
    throw new Error('Processed PNG color format is unsupported.');
  }

  const bytesPerPixel = colorType === 6 ? 4 : 3;
  const raw = await inflateZlib(Uint8Array.from(idatParts.flatMap((part) => Array.from(part))));
  const stride = width * bytesPerPixel;
  const expectedLength = (stride + 1) * height;

  if (raw.length < expectedLength) {
    throw new Error('Processed PNG payload is truncated.');
  }

  const rgba = new Uint8Array(width * height * 4);
  const prev = new Uint8Array(stride);
  const row = new Uint8Array(stride);

  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (stride + 1);
    const filterType = raw[rowStart];
    row.set(raw.slice(rowStart + 1, rowStart + 1 + stride));

    for (let i = 0; i < stride; i += 1) {
      const left = i >= bytesPerPixel ? row[i - bytesPerPixel] : 0;
      const up = prev[i];
      const upLeft = i >= bytesPerPixel ? prev[i - bytesPerPixel] : 0;

      switch (filterType) {
        case 0: break;
        case 1: row[i] = (row[i] + left) & 0xff; break;
        case 2: row[i] = (row[i] + up) & 0xff; break;
        case 3: row[i] = (row[i] + Math.floor((left + up) / 2)) & 0xff; break;
        case 4: row[i] = (row[i] + paethPredictor(left, up, upLeft)) & 0xff; break;
        default: throw new Error('Processed PNG uses an unknown filter type.');
      }
    }

    for (let x = 0; x < width; x += 1) {
      const src = x * bytesPerPixel;
      const dest = (y * width + x) * 4;
      rgba[dest] = row[src];
      rgba[dest + 1] = row[src + 1];
      rgba[dest + 2] = row[src + 2];
      rgba[dest + 3] = colorType === 6 ? row[src + 3] : 255;
    }

    prev.set(row);
  }

  return { width, height, rgba, hasAlpha: colorType === 6 };
}

export async function assessProcessedImageQuality(
  bytes: Uint8Array,
  contentType: string | undefined,
  profile: GarmentSupportProfile,
): Promise<ProcessedImageQualityAssessment> {
  const issues: string[] = [];

  if (!contentType?.startsWith('image/png')) {
    issues.push('Processed output must be a PNG image for transparency-safe garment acceptance.');
    return { accepted: false, confidence: 0, issues };
  }

  let decoded;
  try {
    decoded = await decodePngRgba(bytes);
  } catch (error) {
    issues.push(error instanceof Error ? error.message : 'Unable to inspect processed PNG output.');
    return { accepted: false, confidence: 0, issues };
  }

  const { width, height, rgba, hasAlpha } = decoded;
  const pixelCount = width * height;

  if (width < 600 || height < 600) issues.push('Processed output dimensions are too small for wardrobe-quality usage.');
  if (width > 5000 || height > 5000) issues.push('Processed output dimensions are unexpectedly large.');
  if (!hasAlpha) issues.push('Processed output is missing an alpha channel.');

  let nonTransparentPixels = 0;
  let borderPixels = 0;
  let borderTouched = 0;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = rgba[(y * width + x) * 4 + 3];
      const active = alpha >= 16;
      const border = x === 0 || y === 0 || x === width - 1 || y === height - 1;
      if (border) {
        borderPixels += 1;
        if (active) borderTouched += 1;
      }
      if (!active) continue;
      nonTransparentPixels += 1;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }

  if (nonTransparentPixels === 0) {
    issues.push('Processed output removed the garment entirely.');
    return { accepted: false, confidence: 0, issues, metrics: {
      width, height, hasAlpha, opaqueCoverage: 0, borderTouchRatio: 0, bboxWidthRatio: 0, bboxHeightRatio: 0, centerOffsetX: 1, centerOffsetY: 1,
    } };
  }

  const bboxWidthRatio = (maxX - minX + 1) / width;
  const bboxHeightRatio = (maxY - minY + 1) / height;
  const opaqueCoverage = nonTransparentPixels / pixelCount;
  const borderTouchRatio = borderTouched / Math.max(borderPixels, 1);
  const centerX = (minX + maxX + 1) / 2 / width;
  const centerY = (minY + maxY + 1) / 2 / height;
  const centerOffsetX = Math.abs(centerX - 0.5);
  const centerOffsetY = Math.abs(centerY - 0.5);

  const minCoverage = profile === 'tops' ? 0.1 : 0.14;
  const minHeightRatio = profile === 'dress' ? 0.45 : 0.28;
  const maxHeightRatio = profile === 'tops' ? 0.94 : 0.98;
  const minWidthRatio = 0.18;
  const maxWidthRatio = profile === 'outerwear' ? 0.95 : 0.88;
  const maxCoverage = profile === 'dress' ? 0.8 : 0.72;
  const maxCenterX = 0.16;
  const maxCenterY = 0.18;

  if (opaqueCoverage < minCoverage) issues.push('Processed garment coverage is too small to trust as a single-item result.');
  if (opaqueCoverage > maxCoverage) issues.push('Processed garment occupies too much of the frame, suggesting leftover body or background.');
  if (bboxWidthRatio < minWidthRatio || bboxWidthRatio > maxWidthRatio) issues.push('Processed garment width is outside the supported composition range.');
  if (bboxHeightRatio < minHeightRatio || bboxHeightRatio > maxHeightRatio) issues.push('Processed garment height is outside the supported composition range.');
  if (centerOffsetX > maxCenterX || centerOffsetY > maxCenterY) issues.push('Processed garment is not centered enough for wardrobe display.');
  if (borderTouchRatio > 0.015) issues.push('Processed garment touches the image border too much, indicating a weak crop.');

  const penalties = [
    width < 1200 || height < 1200 ? 0.08 : 0,
    !hasAlpha ? 0.35 : 0,
    opaqueCoverage < minCoverage ? 0.25 : 0,
    opaqueCoverage > maxCoverage ? 0.25 : 0,
    bboxWidthRatio < minWidthRatio || bboxWidthRatio > maxWidthRatio ? 0.15 : 0,
    bboxHeightRatio < minHeightRatio || bboxHeightRatio > maxHeightRatio ? 0.15 : 0,
    centerOffsetX > maxCenterX ? 0.12 : 0,
    centerOffsetY > maxCenterY ? 0.12 : 0,
    borderTouchRatio > 0.015 ? 0.18 : 0,
  ].reduce((sum, value) => sum + value, 0);

  const confidence = Math.max(0, Math.min(0.96, 0.93 - penalties));
  const threshold = profile === 'tops' ? 0.72 : 0.76;

  return {
    accepted: issues.length === 0 && confidence >= threshold,
    confidence,
    issues,
    metrics: {
      width,
      height,
      hasAlpha,
      opaqueCoverage,
      borderTouchRatio,
      bboxWidthRatio,
      bboxHeightRatio,
      centerOffsetX,
      centerOffsetY,
    },
  };
}
