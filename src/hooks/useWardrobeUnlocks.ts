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
const CELEBRATED_KEY = 'burs_celebrated_milestones';

function getCelebrated(): number[] {
  try { return JSON.parse(localStorage.getItem(CELEBRATED_KEY) || '[]'); }
  catch { return []; }
}

function setCelebrated(milestones: number[]) {
  localStorage.setItem(CELEBRATED_KEY, JSON.stringify(milestones));
}

/**
 * Watches garment count and fires a celebratory toast
 * when the user crosses a new unlock milestone.
 * Each milestone is celebrated only once (persisted in localStorage).
 * Mount once in AppLayout.
 */
export function useUnlockCelebration() {
  const { data: garmentCount } = useGarmentCount();
  const { t } = useLanguage();
  const hasFiredRef = useRef(false);

  useEffect(() => {
    // Wait for the query to resolve
    if (garmentCount === undefined) return;

    // Guard against double-firing in strict mode
    if (hasFiredRef.current) return;

    const celebrated = getCelebrated();
    const newlyReached = MILESTONES.filter(m => garmentCount >= m && !celebrated.includes(m));
    if (newlyReached.length === 0) return;

    hasFiredRef.current = true;

    // Persist immediately so it never fires again
    setCelebrated([...celebrated, ...newlyReached]);

    // Show toast for the highest new milestone
    const highestMilestone = Math.max(...newlyReached);
    const unlockedFeatures = TIERS
      .filter(tier => tier.minGarments === highestMilestone)
      .map(tier => t(tier.labelKey));

    hapticSuccess();

    toast(t('unlock.celebration_title'), {
      description: t('unlock.celebration_desc').replace('{features}', unlockedFeatures.join(', ')),
      duration: 5000,
    });
  }, [garmentCount, t]);
}
