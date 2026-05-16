import type { AnalysisResult } from '../../hooks/useAnalyzeGarment';

export type AddGarmentSource =
  | 'add_photo'
  | 'batch_add'
  | 'live_scan'
  | 'manual_enhance'
  | 'retry';

export interface AddGarmentParams {
  garmentId?: string;
  storagePath: string;
  maskedStoragePath?: string;
  maskStatus?: 'masked' | 'unavailable' | 'failed' | null;
  analysis: AnalysisResult;
  source: AddGarmentSource;
  enableStudioQuality: boolean;
  title?: string;
  category?: string;
  price?: number | null;
  subcategory?: string | null;
  color_primary?: string | null;
  color_secondary?: string | null;
  material?: string | null;
  pattern?: string | null;
  fit?: string | null;
  season_tags?: string[];
  formality?: number | null;
  aiOverridden?: Partial<{
    title: boolean;
    category: boolean;
    subcategory: boolean;
    color_primary: boolean;
    color_secondary: boolean;
    material: boolean;
    pattern: boolean;
    fit: boolean;
    season_tags: boolean;
    formality: boolean;
  }>;
}

export class OfflineQueuedError extends Error {
  constructor() {
    super('Saved offline — will sync when you are back online.');
    this.name = 'OfflineQueuedError';
  }
}

export const ADD_GARMENT_ACTION = 'add-garment-save';
