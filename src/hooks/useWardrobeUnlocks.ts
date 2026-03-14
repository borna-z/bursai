import { useMemo, useEffect, useRef } from 'react';
import { useGarmentCount } from '@/hooks/useGarments';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';
import { hapticSuccess } from '@/lib/haptics';

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

/** Unique milestone thresholds (for celebration detection) */
const MILESTONES = [...new Set(TIERS.filter(t => t.minGarments > 0).map(t => t.minGarments))].sort((a, b) => a - b);

export function useWardrobeUnlocks() {
  const { data: garmentCount } = useGarmentCount();
  const currentCount = garmentCount ?? 0;

  return useMemo(() => {
    const isUnlocked = (feature: string) => {
      const tier = TIERS.find(t => t.feature === feature);
      if (!tier) return true;
      return currentCount >= tier.minGarments;
    };

    const nextTier = TIERS.find(t => currentCount < t.minGarments) ?? null;
    const garmentsNeeded = nextTier ? nextTier.minGarments - currentCount : 0;

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

/**
 * Watches garment count and fires a celebratory toast
 * when the user crosses a new unlock milestone.
 * Mount once in AppLayout.
 */
export function useUnlockCelebration() {
  const { data: garmentCount } = useGarmentCount();
  const { t } = useLanguage();
  const currentCount = garmentCount ?? 0;
  const prevCountRef = useRef<number | null>(null);

  useEffect(() => {
    // Skip the initial mount (don't celebrate on page load)
    if (prevCountRef.current === null) {
      prevCountRef.current = currentCount;
      return;
    }

    const prev = prevCountRef.current;
    prevCountRef.current = currentCount;

    // Only celebrate when count increased
    if (currentCount <= prev) return;

    // Find milestones that were just crossed
    const newlyUnlocked = MILESTONES.filter(m => prev < m && currentCount >= m);
    if (newlyUnlocked.length === 0) return;

    // Get the features unlocked at the highest new milestone
    const highestMilestone = Math.max(...newlyUnlocked);
    const unlockedFeatures = TIERS
      .filter(tier => tier.minGarments === highestMilestone)
      .map(tier => t(tier.labelKey));

    hapticSuccess();

    toast(t('unlock.celebration_title'), {
      description: t('unlock.celebration_desc').replace('{features}', unlockedFeatures.join(', ')),
      duration: 5000,
    });
  }, [currentCount, t]);
}
