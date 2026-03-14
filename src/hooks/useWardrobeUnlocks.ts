import { useMemo } from 'react';
import { useGarmentCount } from '@/hooks/useGarments';

export interface UnlockTier {
  minGarments: number;
  feature: string;
  labelKey: string;
}

const TIERS: UnlockTier[] = [
  { minGarments: 0,  feature: 'wardrobe',       labelKey: 'unlock.wardrobe' },
  { minGarments: 5,  feature: 'outfit_gen',      labelKey: 'unlock.outfit_gen' },
  { minGarments: 10, feature: 'gap_analysis',    labelKey: 'unlock.gap_analysis' },
  { minGarments: 10, feature: 'travel_capsule',  labelKey: 'unlock.travel_capsule' },
  { minGarments: 20, feature: 'insights',        labelKey: 'unlock.insights' },
  { minGarments: 20, feature: 'style_report',    labelKey: 'unlock.style_report' },
];

export function useWardrobeUnlocks() {
  const { data: garmentCount } = useGarmentCount();
  const currentCount = garmentCount ?? 0;

  return useMemo(() => {
    const isUnlocked = (feature: string) => {
      const tier = TIERS.find(t => t.feature === feature);
      if (!tier) return true;
      return currentCount >= tier.minGarments;
    };

    // Find the next locked tier
    const nextTier = TIERS.find(t => currentCount < t.minGarments) ?? null;
    const garmentsNeeded = nextTier ? nextTier.minGarments - currentCount : 0;

    // Current tier index = last tier that is unlocked
    const currentTierIndex = TIERS.reduce(
      (acc, t, i) => (currentCount >= t.minGarments ? i : acc),
      0
    );

    return {
      tiers: TIERS,
      currentCount,
      currentTierIndex,
      nextTier,
      garmentsNeeded,
      isUnlocked,
    };
  }, [currentCount]);
}
