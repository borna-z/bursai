// Image resize + upload helper for the AddPiece + LiveScan flows.
//
// Resize: longest side capped at 1200px, JPEG @ q=0.85. Same recipe the web's
// useStorage uses (compressImage), so the analyzer + render pipelines see the
// same input quality across both clients.
//
// Binary upload: SDK 54 deprecated FileSystem.readAsStringAsync (throws at
// runtime), so we use the new `File(uri).bytes()` API which returns a
// Uint8Array directly. supabase-js v2's storage client accepts ArrayBuffer /
// Uint8Array in React Native — Blob round-tripping via fetch() was the older
// pattern but is unreliable under Hermes. The Uint8Array path is the
// recommended Expo SDK 54+ way.
//
// Storage path scheme: `<userId>/<timestamp>-<random>.jpg`. The userId prefix
// is enforced by the bucket's RLS policy (see web's useStorage) so writes
// outside the user's own folder fail. Timestamp + random keep collisions
// vanishingly unlikely without needing an extra DB lookup for uniqueness.

import * as ImageManipulator from 'expo-image-manipulator';
import { File as FsFile } from 'expo-file-system';

import { supabase } from './supabase';

const BUCKET = 'garments';
const MAX_DIMENSION = 1200;
const JPEG_QUALITY = 0.85;

export interface UploadResult {
  storagePath: string;
}

/**
 * Resize a source URI to the canonical analyze/render input format. Returns the
 * raw ImageManipulator output so callers that need both the resized URI AND a
 * base64 payload (parallel-flow Step 2) can grab them in one shot rather than
 * paying for two manipulateAsync passes. Pass `wantBase64: true` to also get
 * `result.base64` populated — the manipulator itself reads the bytes once.
 */
export async function resizeForGarment(
  uri: string,
  options: { wantBase64?: boolean } = {},
): Promise<ImageManipulator.ImageResult> {
  return ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: MAX_DIMENSION } }],
    {
      compress: JPEG_QUALITY,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: options.wantBase64 === true,
    },
  );
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
  const bytes = await new FsFile(resized.uri).bytes();

  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  const storagePath = `${userId}/${timestamp}-${random}.jpg`;

  const { error } = await supabase.storage.from(BUCKET).upload(storagePath, bytes, {
    contentType: 'image/jpeg',
    upsert: false,
  });

  if (error) throw error;

  return { storagePath };
}

export async function resizeAndUpload(uri: string, userId: string): Promise<UploadResult> {
  const resized = await resizeForGarment(uri);
  return uploadManipulatedImage(resized, userId);
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
    await supabase.storage.from(BUCKET).remove([storagePath]);
  } catch (err) {
    console.warn('[imageUpload] orphan cleanup failed:', err);
  }
}
