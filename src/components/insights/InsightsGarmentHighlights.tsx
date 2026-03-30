import { motion } from 'framer-motion';
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
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.08 }}
      className="grid grid-cols-2 gap-3"
    >
      {mostWorn && (
        <button
          type="button"
          onClick={() => { hapticLight(); onSelectGarment(mostWorn.id); }}
          className="surface-secondary flex flex-col items-center gap-2 rounded-[1.25rem] p-3 text-center transition-colors cursor-pointer"
        >
          <Heart className="h-4 w-4 text-accent" />
          <div className="h-16 w-16 overflow-hidden rounded-[0.85rem] bg-secondary/40">
            <LazyImageSimple
              imagePath={getPreferredGarmentImagePath(mostWorn as Parameters<typeof getPreferredGarmentImagePath>[0])}
              alt={mostWorn.title || ''}
              className="h-full w-full"
            />
          </div>
          <p className="truncate text-[13px] font-semibold text-foreground">{mostWorn.title}</p>
          <p className="text-[11px] text-muted-foreground/60">
            {(mostWorn as HighlightGarment & { wearCountLast30?: number }).wearCountLast30 ?? mostWorn.wear_count ?? 0}x worn
          </p>
        </button>
      )}

      {forgotten && (
        <button
          type="button"
          onClick={() => { hapticLight(); onSelectGarment(forgotten.id); }}
          className="surface-secondary flex flex-col items-center gap-2 rounded-[1.25rem] p-3 text-center transition-colors cursor-pointer"
        >
          <Clock className="h-4 w-4 text-muted-foreground/50" />
          <div className="h-16 w-16 overflow-hidden rounded-[0.85rem] bg-secondary/40">
            <LazyImageSimple
              imagePath={getPreferredGarmentImagePath(forgotten as Parameters<typeof getPreferredGarmentImagePath>[0])}
              alt={forgotten.title || ''}
              className="h-full w-full"
            />
          </div>
          <p className="truncate text-[13px] font-semibold text-foreground">{forgotten.title}</p>
          <p className="text-[11px] text-muted-foreground/60">
            {daysSince(forgotten.created_at)}d ago
          </p>
        </button>
      )}
    </motion.div>
  );
}
