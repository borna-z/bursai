import { useMemo } from 'react';
import { useFlatGarments } from '@/hooks/useGarments';
import { usePlannedOutfits } from '@/hooks/usePlannedOutfits';
import type { Garment } from '@/hooks/useGarments';

export interface LaundryAlert {
  garment: Garment;
  neededDate: string;
  outfitId: string;
}

export interface LaundryOverview {
  inLaundryCount: number;
  alerts: LaundryAlert[];
  /** Garments in laundry that aren't needed soon */
  nonUrgent: Garment[];
}

export function useLaundryCycle(): LaundryOverview {
  const { data: allGarments = [] } = useFlatGarments();
  const { data: plannedOutfits = [] } = usePlannedOutfits();

  return useMemo(() => {
    const inLaundry = allGarments.filter(g => g.in_laundry);
    const laundryIds = new Set(inLaundry.map(g => g.id));

    if (laundryIds.size === 0) {
      return { inLaundryCount: 0, alerts: [], nonUrgent: [] };
    }

    const alerts: LaundryAlert[] = [];
    const alertedIds = new Set<string>();

    // Check planned outfits for garments currently in laundry
    for (const planned of plannedOutfits) {
      const outfit = (planned as any).outfit;
      if (!outfit?.outfit_items) continue;

      for (const item of outfit.outfit_items) {
        const gId = item.garment_id || item.garment?.id;
        if (gId && laundryIds.has(gId) && !alertedIds.has(gId)) {
          const garment = inLaundry.find(g => g.id === gId);
          if (garment) {
            alerts.push({
              garment,
              neededDate: planned.date,
              outfitId: outfit.id,
            });
            alertedIds.add(gId);
          }
        }
      }
    }

    // Sort by nearest date
    alerts.sort((a, b) => a.neededDate.localeCompare(b.neededDate));

    const nonUrgent = inLaundry.filter(g => !alertedIds.has(g.id));

    return {
      inLaundryCount: inLaundry.length,
      alerts,
      nonUrgent,
    };
  }, [allGarments, plannedOutfits]);
}
