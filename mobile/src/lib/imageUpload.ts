// Image resize + upload helper for the AddPiece + LiveScan flows.
//
// Resize: longest side capped at 1024px, WebP @ q=0.85. Same recipe the web's
// `compressImage` uses (`src/lib/imageCompression.ts`), so the analyzer +
// render pipelines see equivalent input quality + payload size across both
// clients. N6 (W-PERF1): switched from JPEG@1200 to WEBP@1024 to drop the
// post-resize payload by ~40-55% on typical photos. Smaller payload =
// faster upload AND faster analyze (the base64 round-trip to Gemini is the
// main "scan/AI is slow on mobile" contributor, audit §4.3).
//
// SaveFormat.WEBP: Expo SDK 54 / expo-image-manipulator 14 supports WEBP
// natively on iOS 14+ and Android (all RN-supported levels). Older WebP
// quirks were resolved in SDK 53; nothing to feature-flag.
//
// Binary upload: SDK 54 deprecated FileSystem.readAsStringAsync (throws at
// runtime), so we use the new `File(uri).bytes()` API which returns a
// Uint8Array directly. supabase-js v2's storage client accepts ArrayBuffer /
// Uint8Array in React Native — Blob round-tripping via fetch() was the older
// pattern but is unreliable under Hermes. The Uint8Array path is the
// recommended Expo SDK 54+ way.
//
// Storage path scheme: `<userId>/<timestamp>-<random>.webp`. The userId prefix
// is enforced by the bucket's RLS policy (see web's useStorage) so writes
// outside the user's own folder fail. Timestamp + random keep collisions
// vanishingly unlikely without needing an extra DB lookup for uniqueness.

import * as ImageManipulator from 'expo-image-manipulator';
import { File as FsFile, Paths } from 'expo-file-system';

import { supabase } from './supabase';
import {
  MASK_SAVE_TIMEOUT_MS,
  removeBackground,
  type MaskResult,
  type MaskStatus,
} from './backgroundRemoval';

const BUCKET = 'garments';
const MAX_DIMENSION = 1024;
const COMPRESS_QUALITY = 0.85;

/**
 * MIME type emitted by `resizeForGarment`. Exported so call sites that build
 * data URLs (`data:<mime>;base64,...`) for the analyze edge function stay in
 * lockstep with the encoder format — switching JPEG → WebP here used to
 * silently leave callers building `data:image/jpeg;...` URLs around WebP
 * bytes, which Gemini happens to accept but is wrong on its face. N6.
 */
export const GARMENT_IMAGE_MIME = 'image/webp';

/**
 * Storage extension matching `GARMENT_IMAGE_MIME`. Kept distinct so the
 * `<userId>/<timestamp>-<random>.<ext>` scheme stays readable on the
 * supabase storage browser.
 */
const GARMENT_IMAGE_EXT = 'webp';

export interface UploadResult {
  storagePath: string;
  maskedStoragePath?: string;
  maskStatus?: MaskStatus;
}

export interface UploadMaskMetadata {
  maskedStoragePath?: string;
  maskStatus: MaskStatus;
}

/**
 * Wave R-B — per-garment storage variants. New garments live under
 * `garments/{userId}/{garmentId}/<kind>.webp` so the raw + masked +
 * studio render co-locate under a single folder and orphan cleanup
 * stays trivial. Pre-R-B rows keep their flat `<userId>/<ts>-<rand>.webp`
 * layout — display + render paths read whatever the row carries.
 */
export type GarmentImageKind = 'raw' | 'masked';

function uploadVariantPath(userId: string, garmentId: string, kind: GarmentImageKind): string {
  return `${userId}/${garmentId}/${kind}.${GARMENT_IMAGE_EXT}`;
}

function uploadMaskedSidecarPath(rawStoragePath: string): string {
  return rawStoragePath.replace(
    new RegExp(`\\.${GARMENT_IMAGE_EXT}$`),
    `.masked.${GARMENT_IMAGE_EXT}`,
  );
}

const uploadMaskMetadata = new Map<string, UploadMaskMetadata>();

export function getUploadMaskMetadata(storagePath: string): UploadMaskMetadata | null {
  return uploadMaskMetadata.get(storagePath) ?? null;
}

function rememberUploadMaskMetadata(
  storagePath: string,
  metadata: UploadMaskMetadata,
): void {
  uploadMaskMetadata.set(storagePath, metadata);
}

async function uploadBytes(storagePath: string, bytes: Uint8Array, upsert: boolean): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).upload(storagePath, bytes, {
    contentType: GARMENT_IMAGE_MIME,
    upsert,
  });
  if (error) throw error;
}

async function awaitMaskWithSaveCap(maskP: Promise<MaskResult>, rawUri: string): Promise<MaskResult> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeoutP = new Promise<MaskResult>((resolve) => {
    timer = setTimeout(
      () => resolve({
        uri: rawUri,
        status: 'unavailable',
        confidence: 0,
        durationMs: 0,
      }),
      MASK_SAVE_TIMEOUT_MS,
    );
  });
  try {
    return await Promise.race([maskP, timeoutP]);
  } finally {
    if (timer) clearTimeout(timer);
    maskP.catch(() => {});
  }
}

/**
 * Wave R-C.1 — defensive HEIC→JPEG transcode. `expo-image-picker` on iOS 11+
 * returns HEIC by default for camera-roll imports. `expo-image-manipulator`
 * usually decodes HEIC fine, but trips on 10-bit HDR variants and multi-frame
 * "Live Photo" HEIC containers — the resize call fails with an opaque codec
 * error and the user sees the gallery import bounce with no save. The fix is
 * a cheap intermediate transcode at near-lossless quality first, which
 * collapses any HEIC variant to vanilla 8-bit JPEG that the WebP resize step
 * always handles. Adds ~80ms on HEIC gallery imports; no impact on camera or
 * LiveScan (which already write JPEG).
 *
 * Detection is by extension. `ph://` photo-library URIs aren't HEIC at the
 * URI level even when the underlying asset is — but iOS resolves those into
 * file copies before they reach this layer, so the extension check holds.
 */
async function transcodeHeicIfNeeded(uri: string): Promise<string> {
  if (!/\.(heic|heif)(\?|#|$)/i.test(uri)) return uri;
  try {
    const transcoded = await ImageManipulator.manipulateAsync(
      uri,
      [],
      {
        compress: 0.95,
        format: ImageManipulator.SaveFormat.JPEG,
      },
    );
    return transcoded.uri;
  } catch {
    // Transcode failure leaves the resize step to take its own crack at the
    // source URI — manipulateAsync handles most HEIC variants directly, and
    // the small remainder that doesn't bubble up as a normal resize error
    // the caller already classifies as `compress_failed`.
    return uri;
  }
}

/**
 * Resize a source URI to the canonical analyze/render input format. Returns the
 * raw ImageManipulator output so callers that need both the resized URI AND a
 * base64 payload (parallel-flow Step 2) can grab them in one shot rather than
 * paying for two manipulateAsync passes. Pass `wantBase64: true` to also get
 * `result.base64` populated — the manipulator itself reads the bytes once.
 *
 * N6: encodes WebP @ 1024px to match web's `compressImage`. analyze_garment
 * forwards the data URL straight to Gemini, which accepts WebP; the storage
 * upload writes the same bytes with the matching `image/webp` content type.
 *
 * Wave R-C.1: HEIC sources transcode through JPEG first via
 * `transcodeHeicIfNeeded`. See helper above for rationale.
 */
export async function resizeForGarment(
  uri: string,
  options: { wantBase64?: boolean } = {},
): Promise<ImageManipulator.ImageResult> {
  const safeSource = await transcodeHeicIfNeeded(uri);
  return ImageManipulator.manipulateAsync(
    safeSource,
    [{ resize: { width: MAX_DIMENSION } }],
    {
      compress: COMPRESS_QUALITY,
      format: ImageManipulator.SaveFormat.WEBP,
      base64: options.wantBase64 === true,
    },
  );
}

/**
 * Wave R-C.2 — content:// URI defense. On Samsung One UI multi-window or with
 * 3rd-party gallery providers, `expo-image-picker` and `expo-image-manipulator`
 * can return URIs whose backing content provider revokes read access between
 * frames. Reading the bytes directly throws a generic FileSystem error and
 * the user's save bounces with no clear cause.
 *
 * The mitigation: on first read failure, copy the URI into the local cache
 * directory (which we own and can re-read freely) and retry from there. If
 * that also fails the original error bubbles up — at that point the source
 * really is unreadable and the caller's friendly-error path is the right
 * surface (Step 3 maps it to a re-scan prompt).
 *
 * Why both reads can fail: `File.copy()` reads the source the same way
 * `.bytes()` does, so a fully revoked content URI fails both. But in the
 * common multi-window case the provider is alive long enough to copy once
 * before the parent activity reclaims the grant — the copy lands the bytes
 * in our cache and the retry succeeds.
 */
async function safeReadBytes(uri: string): Promise<Uint8Array> {
  try {
    return await new FsFile(uri).bytes();
  } catch (firstErr) {
    const cacheName = `burs-fallback-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.bin`;
    const dest = new FsFile(Paths.cache, cacheName);
    try {
      new FsFile(uri).copy(dest);
      return await dest.bytes();
    } catch {
      throw firstErr;
    }
  }
}

/**
 * Uploads an already-resized ImageManipulator result. Split out from `resizeAndUpload`
 * so the parallel-analyze flow can reuse the same resized output for both the base64
 * analyze call and the storage upload (single resize, two consumers). Path scheme matches
 * `resizeAndUpload` so storage URLs are interchangeable across both call sites.
 */
export async function uploadManipulatedImage(
  resized: ImageManipulator.ImageResult,
  userId: string,
): Promise<UploadResult> {
  const maskP = removeBackground(resized.uri);
  maskP.catch(() => {});
  const bytes = await safeReadBytes(resized.uri);

  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  const storagePath = `${userId}/${timestamp}-${random}.${GARMENT_IMAGE_EXT}`;

  await uploadBytes(storagePath, bytes, false);

  const maskRes = await awaitMaskWithSaveCap(maskP, resized.uri);
  if (maskRes.status !== 'masked') {
    rememberUploadMaskMetadata(storagePath, { maskStatus: maskRes.status });
    return { storagePath, maskStatus: maskRes.status };
  }

  try {
    const masked = await ImageManipulator.manipulateAsync(
      maskRes.uri,
      [],
      {
        compress: 0.8,
        format: ImageManipulator.SaveFormat.WEBP,
      },
    );
    const maskedStoragePath = uploadMaskedSidecarPath(storagePath);
    const maskedBytes = await safeReadBytes(masked.uri);
    await uploadBytes(maskedStoragePath, maskedBytes, true);
    const metadata = { maskedStoragePath, maskStatus: 'masked' as const };
    rememberUploadMaskMetadata(storagePath, metadata);
    return { storagePath, ...metadata };
  } catch {
    rememberUploadMaskMetadata(storagePath, { maskStatus: 'failed' });
    return { storagePath, maskStatus: 'failed' };
  }
}

export async function resizeAndUpload(uri: string, userId: string): Promise<UploadResult> {
  const resized = await resizeForGarment(uri);
  return uploadManipulatedImage(resized, userId);
}

/**
 * Wave R-B — upload an already-resized image into the per-garment folder
 * layout (`{userId}/{garmentId}/<kind>.webp`). Used by the LiveScan
 * pipeline to land raw + masked side-by-side before the row exists, so
 * the garment insert can reference both paths.
 *
 * `garmentId` is the client-generated UUID stamped at capture time and
 * later used as the row primary key. Two separate uploads (raw, masked)
 * use the same garmentId so a folder-style storage browser groups them.
 */
export async function uploadGarmentVariant(
  resized: ImageManipulator.ImageResult,
  userId: string,
  garmentId: string,
  kind: GarmentImageKind,
): Promise<UploadResult> {
  const bytes = await safeReadBytes(resized.uri);
  const storagePath = uploadVariantPath(userId, garmentId, kind);
  await uploadBytes(storagePath, bytes, true);
  return { storagePath };
}

/**
 * Best-effort cleanup of an upload that no garment row references — typically because
 * the analyze_garment call after a successful upload failed, or because the user backed
 * out / Skip'd before the garment was saved. RLS on the bucket means a user can only
 * remove objects under their own `${userId}/` prefix, so this is safe to call without
 * an extra ownership check. Errors are swallowed: a leaked object is not a regression
 * worth blocking the user on.
 */
export async function deleteUpload(storagePath: string): Promise<void> {
  if (!storagePath) return;
  try {
    const metadata = uploadMaskMetadata.get(storagePath);
    uploadMaskMetadata.delete(storagePath);
    const paths = metadata?.maskedStoragePath
      ? [storagePath, metadata.maskedStoragePath]
      : [storagePath];
    await supabase.storage.from(BUCKET).remove(paths);
  } catch (err) {
    console.warn('[imageUpload] orphan cleanup failed:', err);
  }
}
