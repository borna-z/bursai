import { describe, expect, it } from 'vitest';
import { deflateSync } from 'node:zlib';
import { assessGarmentEligibility, assessProcessedImageQuality } from '../../../supabase/functions/_shared/garment-image-processing/quality';

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Buffer {
  const typeBytes = Buffer.from(type, 'ascii');
  const crcInput = Buffer.concat([typeBytes, Buffer.from(data)]);
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  typeBytes.copy(out, 4);
  Buffer.from(data).copy(out, 8);
  out.writeUInt32BE(crc32(crcInput), 8 + data.length);
  return out;
}

function makePng(width: number, height: number, alphaForPixel: (x: number, y: number) => number): Uint8Array {
  const raw = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (width * 4 + 1);
    raw[rowStart] = 0;
    for (let x = 0; x < width; x += 1) {
      const pixelStart = rowStart + 1 + x * 4;
      raw[pixelStart] = 220;
      raw[pixelStart + 1] = 220;
      raw[pixelStart + 2] = 220;
      raw[pixelStart + 3] = alphaForPixel(x, y);
    }
  }

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

describe('assessGarmentEligibility', () => {
  it('keeps support conservative around tops and outerwear', () => {
    expect(assessGarmentEligibility('top', 't_shirt').eligible).toBe(true);
    expect(assessGarmentEligibility('outerwear', 'jacket').profile).toBe('outerwear');
    expect(assessGarmentEligibility('bottom', 'pants').eligible).toBe(false);
  });
});

describe('assessProcessedImageQuality', () => {
  it('accepts a centered supported garment cutout', async () => {
    const png = makePng(800, 800, (x, y) => (x >= 220 && x < 580 && y >= 120 && y < 680 ? 255 : 0));
    const result = await assessProcessedImageQuality(png, 'image/png', 'tops');

    expect(result.accepted).toBe(true);
    expect(result.confidence).toBeGreaterThanOrEqual(0.72);
    expect(result.issues).toEqual([]);
  });

  it('rejects weak outputs that still include edge/background spill', async () => {
    const png = makePng(800, 800, (x, y) => (x >= 10 && x < 790 && y >= 12 && y < 792 ? 255 : 0));
    const result = await assessProcessedImageQuality(png, 'image/png', 'tops');

    expect(result.accepted).toBe(false);
    expect(result.issues.join(' ')).toMatch(/border|background|width|height/i);
  });

  it('rejects non-png outputs to preserve transparency-safe fallback behavior', async () => {
    const png = makePng(800, 800, (x, y) => (x >= 220 && x < 580 && y >= 120 && y < 680 ? 255 : 0));
    const result = await assessProcessedImageQuality(png, 'image/jpeg', 'tops');

    expect(result.accepted).toBe(false);
    expect(result.issues[0]).toMatch(/PNG/);
  });
});
