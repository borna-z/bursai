export type GarmentProcessingStatus = 'pending' | 'processing' | 'ready' | 'failed';

export interface GarmentImageProviderInput {
  garmentId: string;
  userId: string;
  originalImageUrl: string;
  originalImagePath: string;
  category: string;
  subcategory: string | null;
  title: string;
}

export interface GarmentImageProviderResult {
  success: boolean;
  provider: string;
  confidence: number | null;
  outputContentType?: string;
  outputBytes?: Uint8Array;
  error?: string;
}
