import { enqueue as enqueueOffline, isOnlineNow } from '../offlineQueue';
import type { Garment } from '../../types/garment';
import { withUploadMaskMetadata } from './persistGarmentRaw';
import {
  persistGarmentWithMetadata,
  type PersistGarmentWithMetadataOptions,
} from './persistGarmentWithMetadata';
import { ADD_GARMENT_ACTION, OfflineQueuedError, type AddGarmentParams } from './types';

export async function persistGarmentWithOfflineQueue(
  params: AddGarmentParams,
  options?: PersistGarmentWithMetadataOptions,
): Promise<Garment> {
  const resolvedParams = withUploadMaskMetadata(params);
  if (!(await isOnlineNow())) {
    await enqueueOffline(ADD_GARMENT_ACTION, resolvedParams);
    throw new OfflineQueuedError();
  }
  try {
    return await persistGarmentWithMetadata(resolvedParams, options);
  } catch (err) {
    if (!(await isOnlineNow())) {
      await enqueueOffline(ADD_GARMENT_ACTION, resolvedParams);
      throw new OfflineQueuedError();
    }
    throw err;
  }
}
