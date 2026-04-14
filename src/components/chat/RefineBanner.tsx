import { X, Lock } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { LazyImageSimple } from '@/components/ui/lazy-image';
import { hapticLight } from '@/lib/haptics';
import type { GarmentBasic } from '@/hooks/useGarmentsByIds';
import { getPreferredGarmentImagePath } from '@/lib/garmentImage';

interface RefineBannerProps {
  garments: GarmentBasic[];
  onStopRefining: () => void;
}

export function RefineBanner({ garments, onStopRefining }: RefineBannerProps) {
  const { t } = useLanguage();

  return (
    <div className="flex items-center gap-2 rounded-[1.25rem] border border-accent/30 bg-accent/5 px-3 py-2 mx-[var(--page-px)]">
      <Lock className="h-3.5 w-3.5 text-accent shrink-0" />
      <div className="flex items-center gap-1.5 overflow-x-auto">
        {garments.slice(0, 4).map((g) => (
          <div key={g.id} className="h-8 w-8 shrink-0 overflow-hidden rounded-lg border border-border/40">
            <LazyImageSimple
              imagePath={getPreferredGarmentImagePath(g)}
              alt={g.title}
              className="h-full w-full object-cover"
            />
          </div>
        ))}
      </div>
      <span className="text-[12px] font-medium text-accent whitespace-nowrap">
        {t('chat.refining_look')}
      </span>
      <button
        onClick={() => {
          hapticLight();
          onStopRefining();
        }}
        className="ml-auto shrink-0 flex items-center gap-1 rounded-full border border-accent/30 px-2 py-1 text-[11px] font-medium text-accent/80 hover:bg-accent/10 active:scale-95 transition-all"
      >
        <X className="h-3 w-3" />
        {t('chat.stop_refining')}
      </button>
    </div>
  );
}
