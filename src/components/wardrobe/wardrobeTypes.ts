import type { WardrobeSmartFilter } from '@/hooks/useWardrobeView';

export interface WardrobeCommandTopState {
  title: string;
  caption: string;
  resultsLabel: string;
  searchPlaceholder: string;
}

export interface WardrobeCollectionTileModel {
  key: Exclude<WardrobeSmartFilter, null>;
  label: string;
  count: number;
  active: boolean;
}

export interface WardrobeInventoryState {
  kind: 'loading' | 'empty' | 'filtered-empty' | 'selecting' | 'results';
  title: string;
  description: string;
}
