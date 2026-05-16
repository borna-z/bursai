import { persistGarmentWithMetadata } from './persistGarmentWithMetadata';
import { persistGarmentWithOfflineQueue } from './persistGarmentWithOfflineQueue';

export {
  ADD_GARMENT_ACTION,
  OfflineQueuedError,
  type AddGarmentParams,
  type AddGarmentSource,
} from './types';
export { isOnlineNow } from '../offlineQueue';
export {
  persistGarmentRaw,
  withUploadMaskMetadata,
  type PersistGarmentRawResult,
} from './persistGarmentRaw';
export {
  persistGarmentWithMetadata,
  type PersistGarmentWithMetadataOptions,
} from './persistGarmentWithMetadata';
export { persistGarmentWithOfflineQueue } from './persistGarmentWithOfflineQueue';
export { surfaceRenderEnqueueFailureToast } from './renderEnqueueToast';

export const persistGarment = persistGarmentWithMetadata;
export const persistGarmentWithOfflineFallback = persistGarmentWithOfflineQueue;
