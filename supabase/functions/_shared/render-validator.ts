/**
 * Render validator — post-generation structural checks.
 *
 * Extracted from `supabase/functions/render_garment_image/index.ts`. The
 * Gemini-vision validation gate (reject-shoe-on-mannequin / missing-item /
 * logo-missing) lives in `_shared/render-eligibility.ts` already; this
 * module owns the cheap byte-level checks that run BEFORE we call the
 * vision validator:
 *
 *   - magic byte recognition (PNG / JPEG / WebP)
 *   - dimension extraction (PNG / JPEG)
 *   - input-size / dimension thresholds
 *   - output-size / dimension thresholds
 *
 * Threshold tunables stay as exported constants — keep current values.
 */

export const INPUT_MIN_DIMENSION = 400;
export const INPUT_MIN_BYTES = 4096;
export const INPUT_MAX_BYTES = 20 * 1024 * 1024;

export const OUTPUT_MIN_BYTES = 30 * 1024;
export const OUTPUT_MAX_BYTES = 10 * 1024 * 1024;
export const OUTPUT_MIN_DIMENSION = 512;

export type ImageFormat = "png" | "jpeg" | "webp";

export type ValidationOk = { ok: true };

export type ValidationError =
  | { ok: false; code: "input_too_small"; bytes: number; message: string }
  | { ok: false; code: "input_too_large"; bytes: number; message: string }
  | { ok: false; code: "input_low_resolution"; width: number; height: number; message: string }
  | { ok: false; code: "output_bad_magic"; message: string }
  | { ok: false; code: "output_too_small"; bytes: number; message: string }
  | { ok: false; code: "output_too_large"; bytes: number; message: string }
  | { ok: false; code: "output_low_resolution"; width: number; height: number; message: string };

export type ValidationResult = ValidationOk | ValidationError;

export function isValidImageMagic(bytes: Uint8Array): ImageFormat | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) return "png";
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) return "jpeg";
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
    && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) return "webp";
  return null;
}

function readUint32BE(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3];
}

export function extractImageDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  const format = isValidImageMagic(bytes);
  if (!format) return null;

  if (format === "png") {
    if (bytes.length < 24) return null;
    return {
      width: readUint32BE(bytes, 16),
      height: readUint32BE(bytes, 20),
    };
  }

  if (format === "jpeg") {
    let offset = 2;
    while (offset < bytes.length - 8) {
      if (bytes[offset] !== 0xFF) return null;
      const marker = bytes[offset + 1];
      offset += 2;
      if (marker === 0xFF) continue;
      if (marker === 0xC0 || marker === 0xC1 || marker === 0xC2 || marker === 0xC3) {
        if (offset + 7 > bytes.length) return null;
        const height = (bytes[offset + 3] << 8) | bytes[offset + 4];
        const width = (bytes[offset + 5] << 8) | bytes[offset + 6];
        return { width, height };
      }
      if (offset + 2 > bytes.length) return null;
      const segmentLength = (bytes[offset] << 8) | bytes[offset + 1];
      if (segmentLength < 2) return null;
      offset += segmentLength;
    }
    return null;
  }

  return null;
}

export function validateInputImage(bytes: Uint8Array): ValidationResult {
  if (bytes.length < INPUT_MIN_BYTES) {
    return {
      ok: false,
      code: "input_too_small",
      bytes: bytes.length,
      message: `Source image too small (${bytes.length} bytes). Re-upload a clearer photo.`,
    };
  }
  if (bytes.length > INPUT_MAX_BYTES) {
    return {
      ok: false,
      code: "input_too_large",
      bytes: bytes.length,
      message: `Source image too large (${bytes.length} bytes).`,
    };
  }
  const dims = extractImageDimensions(bytes);
  if (dims && (dims.width < INPUT_MIN_DIMENSION || dims.height < INPUT_MIN_DIMENSION)) {
    return {
      ok: false,
      code: "input_low_resolution",
      width: dims.width,
      height: dims.height,
      message: `Source image resolution too low (${dims.width}×${dims.height}). Use a clearer photo (min ${INPUT_MIN_DIMENSION}×${INPUT_MIN_DIMENSION}).`,
    };
  }
  return { ok: true };
}

export function validateOutputImage(bytes: Uint8Array): ValidationResult {
  const format = isValidImageMagic(bytes);
  if (!format) {
    return {
      ok: false,
      code: "output_bad_magic",
      message: "Output bytes did not match any known image format.",
    };
  }
  if (bytes.length < OUTPUT_MIN_BYTES) {
    return {
      ok: false,
      code: "output_too_small",
      bytes: bytes.length,
      message: `Output too small (${bytes.length} bytes, min ${OUTPUT_MIN_BYTES}).`,
    };
  }
  if (bytes.length > OUTPUT_MAX_BYTES) {
    return {
      ok: false,
      code: "output_too_large",
      bytes: bytes.length,
      message: `Output too large (${bytes.length} bytes).`,
    };
  }
  const dims = extractImageDimensions(bytes);
  if (dims && (dims.width < OUTPUT_MIN_DIMENSION || dims.height < OUTPUT_MIN_DIMENSION)) {
    return {
      ok: false,
      code: "output_low_resolution",
      width: dims.width,
      height: dims.height,
      message: `Output resolution too low (${dims.width}×${dims.height}, min ${OUTPUT_MIN_DIMENSION}×${OUTPUT_MIN_DIMENSION}).`,
    };
  }
  return { ok: true };
}
