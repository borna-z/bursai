import type { LucideIcon } from 'lucide-react';
import type { OutfitWithItems } from '@/hooks/useOutfits';

export type HomeState =
  | 'loading'
  | 'empty_wardrobe'
  | 'outfit_planned'
  | 'weather_alert'
  | 'no_outfit';

export interface HomeQuickAction {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  accentClass: string;
  featured?: boolean;
  onClick: () => void;
}

export interface HomeCommandContext {
  state: Exclude<HomeState, 'loading'>;
  garmentCount?: number;
  todayOutfit?: OutfitWithItems | null;
  recentOutfits: OutfitWithItems[];
  weatherSummary?: string | null;
  scheduleSummary?: string | null;
  stylistLine: string;
}

export interface HomeGapResultSummary {
  item: string;
  category: string;
  color: string;
  reason: string;
  newOutfits: number;
  priceRange: string;
}

export type HomeOpportunityState =
  | { kind: 'locked'; garmentsNeeded: number; currentCount: number; targetCount: number }
  | { kind: 'ready' }
  | { kind: 'scanning' }
  | { kind: 'results'; topResult: HomeGapResultSummary; extraCount: number }
  | { kind: 'complete' }
  | { kind: 'error' };
