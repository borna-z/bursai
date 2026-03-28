import type { WardrobeSmartFilter, WardrobeTab } from '@/hooks/useWardrobeView';

export type WardrobeCommandActionKey = 'style' | 'add' | 'scan' | 'plan';
export type WardrobeCommandActionTone = 'primary' | 'secondary' | 'muted';

export interface WardrobeCommandActionModel {
  key: WardrobeCommandActionKey;
  label: string;
  tone: WardrobeCommandActionTone;
}

export interface WardrobeCommandTopState {
  title: string;
  caption: string;
  activeTab: WardrobeTab;
  resultsLabel: string;
  searchPlaceholder: string;
  actions: WardrobeCommandActionModel[];
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
