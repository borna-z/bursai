// Garment domain types — sourced from the canonical web Database type so any
// schema change post-`supabase gen types` propagates to mobile automatically.
//
// The web rule "never reach into ../src" has a documented carve-out for the
// auto-generated types file: the schema itself is the same on both apps, and
// duplicating the Row shape by hand here would silently drift on the next
// regen. We import strictly the type, never any runtime symbol from src/.

import type { Database } from '../../../src/integrations/supabase/types';

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
