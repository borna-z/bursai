import { Heart, Clock } from 'lucide-react';

import { LazyImageSimple } from '@/components/ui/lazy-image';
import { getPreferredGarmentImagePath } from '@/lib/garmentImage';
import { hapticLight } from '@/lib/haptics';

interface HighlightGarment {
  id: string;
  title?: string | null;
  image_path?: string | null;
  rendered_image_path?: string | null;
  color_primary?: string | null;
  category?: string | null;
  wear_count?: number | null;
  created_at?: string | null;
}

interface InsightsGarmentHighlightsProps {
  mostWorn: HighlightGarment | null;
  forgotten: HighlightGarment | null;
  onSelectGarment: (id: string) => void;
}

function daysSince(dateStr: string | null | undefined): number {
  if (!dateStr) return 0;
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export function InsightsGarmentHighlights({ mostWorn, forgotten, onSelectGarment }: InsightsGarmentHighlightsProps) {
  if (!mostWorn && !forgotten) return null;

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {mostWorn && (
        <button
          type="button"
          onClick={() => { hapticLight(); onSelectGarment(mostWorn.id); }}
          className="surface-secondary flex items-center gap-3 rounded-[1.1rem] p-2.5 text-left transition-colors cursor-pointer"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/12 text-accent">
            <Heart className="h-4 w-4" />
          </div>
          <div className="h-12 w-12 overflow-hidden rounded-[0.8rem] bg-secondary/40">
            <LazyImageSimple
              imagePath={getPreferredGarmentImagePath(mostWorn as Parameters<typeof getPreferredGarmentImagePath>[0])}
              alt={mostWorn.title || ''}
              className="h-full w-full"
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground/55">Most worn</p>
            <p className="truncate text-[13px] font-semibold text-foreground">{mostWorn.title}</p>
            <p className="text-[11px] text-muted-foreground/60">
              {(mostWorn as HighlightGarment & { wearCountLast30?: number }).wearCountLast30 ?? mostWorn.wear_count ?? 0}x worn
            </p>
          </div>
        </button>
      )}

      {forgotten && (
        <button
          type="button"
          onClick={() => { hapticLight(); onSelectGarment(forgotten.id); }}
          className="surface-secondary flex items-center gap-3 rounded-[1.1rem] p-2.5 text-left transition-colors cursor-pointer"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-background/75 text-muted-foreground/60">
            <Clock className="h-4 w-4" />
          </div>
          <div className="h-12 w-12 overflow-hidden rounded-[0.8rem] bg-secondary/40">
            <LazyImageSimple
              imagePath={getPreferredGarmentImagePath(forgotten as Parameters<typeof getPreferredGarmentImagePath>[0])}
              alt={forgotten.title || ''}
              className="h-full w-full"
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground/55">Needs attention</p>
            <p className="truncate text-[13px] font-semibold text-foreground">{forgotten.title}</p>
            <p className="text-[11px] text-muted-foreground/60">
              {daysSince(forgotten.created_at)}d ago
            </p>
          </div>
        </button>
      )}
    </div>
  );
}
