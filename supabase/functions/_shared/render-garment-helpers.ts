/**
 * Render-garment helpers — pure utilities extracted from
 * `render_garment_image/index.ts`.
 *
 * Image MIME / extension normalization, byte→base64 conversion, generic
 * error-message coercion, and the per-attempt structural-rejection logger.
 * No DB, no fetch, no Deno globals.
 */

import { extractImageDimensions } from "./render-validator.ts";

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error ?? 'Unknown error');
}

// ─── Image helpers (unchanged) ───

export function extensionForMimeType(mimeType: string): string {
  switch (mimeType.toLowerCase()) {
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'image/jpeg':
    case 'image/jpg':
    default:
      return 'jpg';
  }
}

export function normalizeImageMimeType(contentType: string | null, sourceImagePath: string): string {
  const normalizedHeader = contentType?.split(';')[0]?.trim().toLowerCase();
  if (normalizedHeader && normalizedHeader.startsWith('image/')) {
    return normalizedHeader;
  }

  const extension = sourceImagePath.split('.').pop()?.toLowerCase();
  switch (extension) {
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'gif':
      return 'image/gif';
    case 'jpg':
    case 'jpeg':
    default:
      return 'image/jpeg';
  }
}

export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192) {
    const chunk = bytes.subarray(i, i + 8192);
    for (let j = 0; j < chunk.length; j++) {
      binary += String.fromCharCode(chunk[j]);
    }
  }
  return btoa(binary);
}

// Per-attempt structural-rejection logger. Restores the observability the
// pre-extraction retry loop emitted for each of `output_bad_magic` /
// `output_too_small` / `output_too_large` / `output_low_resolution`.
// Keeps the retry chain itself context-agnostic (no garmentId / no logger
// inside `_shared/render-prompt-builder.ts`).
export function logRenderAttemptRejected(params: {
  garmentId: string;
  variant: string;
  attemptIndex: number;
  errorCode: string;
  errorMessage: string;
  outputBytes: Uint8Array;
}): void {
  const { garmentId, variant, attemptIndex, errorCode, errorMessage, outputBytes } = params;
  if (errorCode === 'output_bad_magic') {
    console.warn('render_garment_image attempt rejected: bad magic bytes', {
      garmentId,
      attempt: attemptIndex + 1,
      variant,
      firstBytes: Array.from(outputBytes.slice(0, 8))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join(' '),
      bytes: outputBytes.length,
    });
  } else if (errorCode === 'output_too_small') {
    console.warn('render_garment_image attempt rejected: output too small', {
      garmentId,
      attempt: attemptIndex + 1,
      variant,
      bytes: outputBytes.length,
      errorMessage,
    });
  } else if (errorCode === 'output_too_large') {
    console.warn('render_garment_image attempt rejected: output too large', {
      garmentId,
      attempt: attemptIndex + 1,
      variant,
      bytes: outputBytes.length,
      errorMessage,
    });
  } else if (errorCode === 'output_low_resolution') {
    console.warn('render_garment_image attempt rejected: output dimensions too low', {
      garmentId,
      attempt: attemptIndex + 1,
      variant,
      dims: extractImageDimensions(outputBytes),
      errorMessage,
    });
  } else {
    console.warn('render_garment_image attempt rejected: structural', {
      garmentId,
      attempt: attemptIndex + 1,
      variant,
      errorCode,
      errorMessage,
    });
  }
}
