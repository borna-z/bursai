// Garment domain types — sourced from the canonical Supabase Database type so
// any schema change post-`supabase gen types` propagates to mobile
// automatically. The path now points at `supabase/types.gen.ts` so the import
// survives the post-launch deletion of the web `src/` tree (N5).

import type { Database } from '../../../supabase/types.gen';

export type Garment = Database['public']['Tables']['garments']['Row'];
export type GarmentInsert = Database['public']['Tables']['garments']['Insert'];
export type GarmentUpdate = Database['public']['Tables']['garments']['Update'];

export type SmartFilter = 'rarely_worn' | 'most_worn' | 'new';

export interface GarmentFilters {
  category?: string;
  color?: string;
  season?: string;
  inLaundry?: boolean;
  smartFilter?: SmartFilter | null;
  search?: string;
  sortBy?: 'created_at' | 'wear_count' | 'last_worn_at';
}
