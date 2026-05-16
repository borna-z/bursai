import { describe, expect, it } from 'vitest';

import {
  extractImageDimensions,
  INPUT_MAX_BYTES,
  INPUT_MIN_BYTES,
  INPUT_MIN_DIMENSION,
  isValidImageMagic,
  OUTPUT_MAX_BYTES,
  OUTPUT_MIN_BYTES,
  OUTPUT_MIN_DIMENSION,
  validateInputImage,
  validateOutputImage,
} from '../render-validator';

function pngBytes(width: number, height: number, totalBytes = INPUT_MIN_BYTES * 2): Uint8Array {
  const arr = new Uint8Array(totalBytes);
  arr.set([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], 0);
  arr.set([0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52], 8);
  arr[16] = (width >> 24) & 0xFF;
  arr[17] = (width >> 16) & 0xFF;
  arr[18] = (width >> 8) & 0xFF;
  arr[19] = width & 0xFF;
  arr[20] = (height >> 24) & 0xFF;
  arr[21] = (height >> 16) & 0xFF;
  arr[22] = (height >> 8) & 0xFF;
  arr[23] = height & 0xFF;
  return arr;
}

function jpegBytes(width: number, height: number, totalBytes = INPUT_MIN_BYTES * 2): Uint8Array {
  const arr = new Uint8Array(totalBytes);
  arr.set([0xFF, 0xD8, 0xFF, 0xC0, 0x00, 0x11, 0x08], 0);
  arr[7] = (height >> 8) & 0xFF;
  arr[8] = height & 0xFF;
  arr[9] = (width >> 8) & 0xFF;
  arr[10] = width & 0xFF;
  return arr;
}

function webpBytes(totalBytes = INPUT_MIN_BYTES * 2): Uint8Array {
  const arr = new Uint8Array(totalBytes);
  arr.set([0x52, 0x49, 0x46, 0x46], 0);
  arr.set([0x57, 0x45, 0x42, 0x50], 8);
  return arr;
}

describe('render-validator', () => {
  it('isValidImageMagic recognizes PNG/JPEG/WebP', () => {
    expect(isValidImageMagic(pngBytes(100, 100))).toEqual("png");
    expect(isValidImageMagic(jpegBytes(100, 100))).toEqual("jpeg");
    expect(isValidImageMagic(webpBytes())).toEqual("webp");
  });

  it('isValidImageMagic returns null for unknown bytes', () => {
    const bogus = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0A, 0x0B]);
    expect(isValidImageMagic(bogus)).toEqual(null);
    expect(isValidImageMagic(new Uint8Array(4))).toEqual(null);
  });

  it('extractImageDimensions PNG IHDR', () => {
    const dims = extractImageDimensions(pngBytes(1024, 768));
    expect(dims).toEqual({ width: 1024, height: 768 });
  });

  it('extractImageDimensions JPEG SOF0', () => {
    const dims = extractImageDimensions(jpegBytes(800, 600));
    expect(dims).toEqual({ width: 800, height: 600 });
  });

  it('validateInputImage accepts a healthy PNG', () => {
    const out = validateInputImage(pngBytes(800, 1000));
    expect(out.ok).toEqual(true);
  });

  it('validateInputImage rejects too-small bytes', () => {
    const tiny = new Uint8Array(INPUT_MIN_BYTES - 1);
    tiny.set([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], 0);
    const out = validateInputImage(tiny);
    expect(out.ok).toEqual(false);
    if (out.ok === false) expect(out.code).toEqual("input_too_small");
  });

  it('validateInputImage rejects too-large bytes', () => {
    const huge = pngBytes(INPUT_MIN_DIMENSION, INPUT_MIN_DIMENSION, INPUT_MAX_BYTES + 1);
    const out = validateInputImage(huge);
    expect(out.ok).toEqual(false);
    if (out.ok === false) expect(out.code).toEqual("input_too_large");
  });

  it('validateInputImage rejects low resolution', () => {
    const small = pngBytes(INPUT_MIN_DIMENSION - 1, INPUT_MIN_DIMENSION - 1);
    const out = validateInputImage(small);
    expect(out.ok).toEqual(false);
    if (out.ok === false) expect(out.code).toEqual("input_low_resolution");
  });

  it('validateOutputImage accepts a healthy PNG', () => {
    const out = validateOutputImage(pngBytes(800, 1000, OUTPUT_MIN_BYTES + 1));
    expect(out.ok).toEqual(true);
  });

  it('validateOutputImage rejects bad magic', () => {
    const arr = new Uint8Array(OUTPUT_MIN_BYTES * 2);
    const out = validateOutputImage(arr);
    expect(out.ok).toEqual(false);
    if (out.ok === false) expect(out.code).toEqual("output_bad_magic");
  });

  it('validateOutputImage rejects too-small output', () => {
    const small = pngBytes(800, 1000, OUTPUT_MIN_BYTES - 1);
    const out = validateOutputImage(small);
    expect(out.ok).toEqual(false);
    if (out.ok === false) expect(out.code).toEqual("output_too_small");
  });

  it('validateOutputImage rejects too-large output', () => {
    const huge = pngBytes(OUTPUT_MIN_DIMENSION, OUTPUT_MIN_DIMENSION, OUTPUT_MAX_BYTES + 1);
    const out = validateOutputImage(huge);
    expect(out.ok).toEqual(false);
    if (out.ok === false) expect(out.code).toEqual("output_too_large");
  });

  it('validateOutputImage rejects output dims below 512', () => {
    const small = pngBytes(OUTPUT_MIN_DIMENSION - 1, OUTPUT_MIN_DIMENSION - 1, OUTPUT_MIN_BYTES + 1);
    const out = validateOutputImage(small);
    expect(out.ok).toEqual(false);
    if (out.ok === false) expect(out.code).toEqual("output_low_resolution");
  });

  it('threshold constants match documented values', () => {
    expect(INPUT_MIN_DIMENSION).toEqual(400);
    expect(INPUT_MIN_BYTES).toEqual(4096);
    expect(INPUT_MAX_BYTES).toEqual(20 * 1024 * 1024);
    expect(OUTPUT_MIN_BYTES).toEqual(30 * 1024);
    expect(OUTPUT_MAX_BYTES).toEqual(10 * 1024 * 1024);
    expect(OUTPUT_MIN_DIMENSION).toEqual(512);
  });
});
