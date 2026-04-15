export interface CapsuleOutfit {
  day: number;
  date?: string;
  kind?: 'trip_day' | 'travel_outbound' | 'travel_return';
  occasion: string;
  items: string[];
  note: string;
}

export interface CapsuleItemObj {
  id: string;
  title: string;
  category: string;
  color_primary?: string;
  image_path?: string;
}

export interface CapsuleCoverageGap {
  code: string;
  message: string;
  missing_slots?: string[];
  uncovered_outfits?: number;
}

export interface CapsuleResult {
  capsule_items: (string | CapsuleItemObj)[];
  outfits: CapsuleOutfit[];
  packing_tips: string[];
  coverage_gaps?: CapsuleCoverageGap[];
  total_combinations: number;
  reasoning: string;
}

export interface TravelCapsuleInputSnapshot {
  destination: string;
  destCoords: { lat: number; lon: number } | null;
  dateRange: { from: string; to: string } | null;
  vibe: VibeId;
  outfitsPerDay: number;
  minimizeItems: boolean;
  includeTravelDays: boolean;
  mustHaveItems: string[];
  luggageType?: LuggageType;
  companions?: Companion;
  stylePreference?: StylePreference;
  occasions?: OccasionId[];
}

export interface SavedCapsule {
  id: string;
  destination: string;
  vibe: string;
  dateLabel: string;
  itemCount: number;
  outfitCount: number;
  result: CapsuleResult;
  input?: TravelCapsuleInputSnapshot;
  created_at: string;
}

export const VIBES = [
  { id: 'business', label: 'Business' },
  { id: 'weekend', label: 'Weekend' },
  { id: 'beach', label: 'Beach' },
  { id: 'winter', label: 'Winter' },
  { id: 'adventure', label: 'Adventure' },
  { id: 'mixed', label: 'Mixed' },
] as const;

export type VibeId = typeof VIBES[number]['id'];

export type LuggageType = 'carry_on' | 'carry_on_personal' | 'checked';
export type Companion = 'solo' | 'partner' | 'friends' | 'family';
export type StylePreference = 'casual' | 'balanced' | 'dressy';

export type OccasionId =
  | 'work' | 'dinner' | 'beach' | 'hiking'
  | 'nightlife' | 'wedding' | 'sightseeing'
  | 'airport' | 'active';

export const OCCASIONS: { id: OccasionId; labelKey: string; icon: string }[] = [
  { id: 'work', labelKey: 'travel.occasion_work', icon: 'Briefcase' },
  { id: 'dinner', labelKey: 'travel.occasion_dinner', icon: 'Wine' },
  { id: 'beach', labelKey: 'travel.occasion_beach', icon: 'Umbrella' },
  { id: 'hiking', labelKey: 'travel.occasion_hiking', icon: 'Mountain' },
  { id: 'nightlife', labelKey: 'travel.occasion_nightlife', icon: 'Music' },
  { id: 'wedding', labelKey: 'travel.occasion_wedding', icon: 'Heart' },
  { id: 'sightseeing', labelKey: 'travel.occasion_sightseeing', icon: 'Map' },
  { id: 'airport', labelKey: 'travel.occasion_airport', icon: 'Plane' },
  { id: 'active', labelKey: 'travel.occasion_active', icon: 'Dumbbell' },
];

export const LUGGAGE_LIMITS: Record<LuggageType, { garments: number; shoes: number }> = {
  carry_on: { garments: 8, shoes: 2 },
  carry_on_personal: { garments: 12, shoes: 2 },
  checked: { garments: 18, shoes: 3 },
};

/**
 * Per-category garment count override for the capsule generator.
 * Keys are normalized capsule-slot names (e.g. "top", "bottom", "shoes"),
 * values are the max number of items from that category to send to the AI.
 * `null` elsewhere in the app means "use defaults" (send everything, capped
 * by the 150-item safety ceiling).
 */
export type GarmentSelection = Record<string, number>;

export interface TravelCapsuleRow {
  id: string;
  user_id: string;
  destination: string;
  start_date: string | null;
  end_date: string | null;
  occasions: string[];
  luggage_type: string;
  companions: string;
  style_preference: string;
  result: CapsuleResult;
  created_at: string;
}
