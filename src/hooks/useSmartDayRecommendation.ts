import { useMemo } from 'react';
import { useFlatGarments } from '@/hooks/useGarments';
import { inferOccasionFromEvent } from '@/hooks/useCalendarSync';
import type { CalendarEvent } from '@/hooks/useCalendarSync';
import type { Garment } from '@/hooks/useGarments';

export interface OccasionSlot {
  occasion: string;
  formality: number;
  eventTitle: string;
  garments: Garment[];
}

export interface SmartRecommendation {
  slots: OccasionSlot[];
  hasRecommendation: boolean;
}

function getTargetCategories(occasion: string): string[] {
  switch (occasion) {
    case 'träning':
      return ['överdel', 'underdel', 'skor', 'sportjacka'];
    case 'jobb':
      return ['överdel', 'underdel', 'skor', 'jacka'];
    case 'fest':
      return ['överdel', 'underdel', 'skor', 'accessoar'];
    case 'dejt':
      return ['överdel', 'underdel', 'skor'];
    default:
      return ['överdel', 'underdel', 'skor'];
  }
}

function formalityRange(occasion: string): [number, number] {
  switch (occasion) {
    case 'träning': return [1, 2];
    case 'jobb':    return [3, 5];
    case 'fest':    return [4, 5];
    case 'dejt':    return [3, 4];
    default:        return [1, 5];
  }
}

export function useSmartDayRecommendation(events: CalendarEvent[] | null | undefined): SmartRecommendation {
  const { data: garments } = useFlatGarments();

  return useMemo(() => {
    if (!events || events.length === 0 || !garments || garments.length === 0) {
      return { slots: [], hasRecommendation: false };
    }

    // Map events to occasions (deduplicate by occasion)
    const seen = new Set<string>();
    const slots: OccasionSlot[] = [];

    for (const event of events) {
      const inferred = inferOccasionFromEvent(event.title);
      if (!inferred) continue;
      const { occasion, formality } = inferred;
      if (seen.has(occasion)) continue;
      seen.add(occasion);

      const [minF, maxF] = formalityRange(occasion);
      const targetCats = getTargetCategories(occasion);
      
      // Pick up to 1 garment per category
      const picked: Garment[] = [];
      for (const cat of targetCats) {
        if (picked.length >= 3) break;
        const match = garments.find(g =>
          g.category === cat &&
          !g.in_laundry &&
          (g.formality === null || (g.formality >= minF && g.formality <= maxF)) &&
          !picked.includes(g)
        );
        if (match) picked.push(match);
      }

      if (picked.length > 0) {
        slots.push({ occasion, formality, eventTitle: event.title, garments: picked });
      }

      if (slots.length >= 2) break; // Max 2 occasion slots
    }

    return { slots, hasRecommendation: slots.length > 0 };
  }, [events, garments]);
}
