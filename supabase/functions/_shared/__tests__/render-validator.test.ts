import { assertEquals } from "https://deno.land/std@0.220.0/assert/mod.ts";

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
} from "../render-validator.ts";

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

Deno.test("isValidImageMagic recognizes PNG/JPEG/WebP", () => {
  assertEquals(isValidImageMagic(pngBytes(100, 100)), "png");
  assertEquals(isValidImageMagic(jpegBytes(100, 100)), "jpeg");
  assertEquals(isValidImageMagic(webpBytes()), "webp");
});

Deno.test("isValidImageMagic returns null for unknown bytes", () => {
  const bogus = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0A, 0x0B]);
  assertEquals(isValidImageMagic(bogus), null);
  assertEquals(isValidImageMagic(new Uint8Array(4)), null);
});

Deno.test("extractImageDimensions PNG IHDR", () => {
  const dims = extractImageDimensions(pngBytes(1024, 768));
  assertEquals(dims, { width: 1024, height: 768 });
});

Deno.test("extractImageDimensions JPEG SOF0", () => {
  const dims = extractImageDimensions(jpegBytes(800, 600));
  assertEquals(dims, { width: 800, height: 600 });
});

Deno.test("validateInputImage accepts a healthy PNG", () => {
  const out = validateInputImage(pngBytes(800, 1000));
  assertEquals(out.ok, true);
});

Deno.test("validateInputImage rejects too-small bytes", () => {
  const tiny = new Uint8Array(INPUT_MIN_BYTES - 1);
  tiny.set([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], 0);
  const out = validateInputImage(tiny);
  assertEquals(out.ok, false);
  if (out.ok === false) assertEquals(out.code, "input_too_small");
});

Deno.test("validateInputImage rejects too-large bytes", () => {
  const huge = pngBytes(INPUT_MIN_DIMENSION, INPUT_MIN_DIMENSION, INPUT_MAX_BYTES + 1);
  const out = validateInputImage(huge);
  assertEquals(out.ok, false);
  if (out.ok === false) assertEquals(out.code, "input_too_large");
});

Deno.test("validateInputImage rejects low resolution", () => {
  const small = pngBytes(INPUT_MIN_DIMENSION - 1, INPUT_MIN_DIMENSION - 1);
  const out = validateInputImage(small);
  assertEquals(out.ok, false);
  if (out.ok === false) assertEquals(out.code, "input_low_resolution");
});

Deno.test("validateOutputImage accepts a healthy PNG", () => {
  const out = validateOutputImage(pngBytes(800, 1000, OUTPUT_MIN_BYTES + 1));
  assertEquals(out.ok, true);
});

Deno.test("validateOutputImage rejects bad magic", () => {
  const arr = new Uint8Array(OUTPUT_MIN_BYTES * 2);
  const out = validateOutputImage(arr);
  assertEquals(out.ok, false);
  if (out.ok === false) assertEquals(out.code, "output_bad_magic");
});

Deno.test("validateOutputImage rejects too-small output", () => {
  const small = pngBytes(800, 1000, OUTPUT_MIN_BYTES - 1);
  const out = validateOutputImage(small);
  assertEquals(out.ok, false);
  if (out.ok === false) assertEquals(out.code, "output_too_small");
});

Deno.test("validateOutputImage rejects too-large output", () => {
  const huge = pngBytes(OUTPUT_MIN_DIMENSION, OUTPUT_MIN_DIMENSION, OUTPUT_MAX_BYTES + 1);
  const out = validateOutputImage(huge);
  assertEquals(out.ok, false);
  if (out.ok === false) assertEquals(out.code, "output_too_large");
});

Deno.test("validateOutputImage rejects output dims below 512", () => {
  const small = pngBytes(OUTPUT_MIN_DIMENSION - 1, OUTPUT_MIN_DIMENSION - 1, OUTPUT_MIN_BYTES + 1);
  const out = validateOutputImage(small);
  assertEquals(out.ok, false);
  if (out.ok === false) assertEquals(out.code, "output_low_resolution");
});

Deno.test("threshold constants match documented values", () => {
  assertEquals(INPUT_MIN_DIMENSION, 400);
  assertEquals(INPUT_MIN_BYTES, 4096);
  assertEquals(INPUT_MAX_BYTES, 20 * 1024 * 1024);
  assertEquals(OUTPUT_MIN_BYTES, 30 * 1024);
  assertEquals(OUTPUT_MAX_BYTES, 10 * 1024 * 1024);
  assertEquals(OUTPUT_MIN_DIMENSION, 512);
});
