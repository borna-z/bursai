export interface GapResult {
  item: string;
  category: string;
  color: string;
  reason: string;
  new_outfits: number;
  price_range: string;
  search_query: string;
}

export interface GapScanSnapshot {
  analyzedAt: string;
  results: GapResult[];
}

export type GapLaunchSource = 'home' | 'gaps' | 'unknown';

export interface GapNavigationState {
  autorun?: boolean;
  source?: GapLaunchSource;
}

export type GapViewState =
  | 'locked'
  | 'ready'
  | 'autorun'
  | 'loading'
  | 'error'
  | 'results'
  | 'no-gaps';
