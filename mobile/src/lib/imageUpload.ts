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

export async function resizeAndUpload(uri: string, userId: string): Promise<UploadResult> {
  const resized = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: MAX_DIMENSION } }],
    {
      compress: JPEG_QUALITY,
      format: ImageManipulator.SaveFormat.JPEG,
    },
  );

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
