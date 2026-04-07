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
