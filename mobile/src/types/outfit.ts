// Outfit + planned-outfit domain types — sourced from the canonical web Database
// type so any schema regen propagates here. Mirrors mobile/src/types/garment.ts:
// the type-only carve-out into ../../../src/integrations/supabase/types is the
// only allowed reach into the web app (see mobile/CLAUDE.md "Anti-patterns").
//
// `OutfitWithItems` shapes the joined select used by every consumer hook —
// outfit row + outfit_items + nested garment row. Kept here (not inline in the
// hook) so screens can declare prop types against the joined shape without
// importing the hook module.
//
// Note on column names: this file follows the actual DB schema (worn_at on
// outfits, date on planned_outfits, no last_worn_at column on outfits). The
// W3 spec uses some legacy names; the implementation uses the schema.

import type { Database } from '../../../src/integrations/supabase/types';

export type Outfit = Database['public']['Tables']['outfits']['Row'];
export type OutfitItem = Database['public']['Tables']['outfit_items']['Row'];
export type PlannedOutfit = Database['public']['Tables']['planned_outfits']['Row'];

export type OutfitInsert = Database['public']['Tables']['outfits']['Insert'];
export type OutfitUpdate = Database['public']['Tables']['outfits']['Update'];
export type PlannedOutfitInsert = Database['public']['Tables']['planned_outfits']['Insert'];

type Garment = Database['public']['Tables']['garments']['Row'];

export type OutfitItemWithGarment = OutfitItem & {
  garment: Garment | null;
};

export interface OutfitWithItems extends Outfit {
  outfit_items: OutfitItemWithGarment[];
}

export interface PlannedOutfitWithOutfit extends PlannedOutfit {
  outfit: OutfitWithItems | null;
}
