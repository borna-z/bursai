import { Sparkles } from 'lucide-react';
import type { Garment } from '@/hooks/useGarments';
import { Button } from '@/components/ui/button';
import { LazyImageSimple } from '@/components/ui/lazy-image';
import { getPreferredGarmentImagePath } from '@/lib/garmentImage';
import { useLanguage } from '@/contexts/LanguageContext';

interface HomeWearNextPanelProps {
  unusedGarments: Garment[];
  sleepingBeautiesCount: number;
  onOpenUnused: () => void;
  onStyleAroundGem: (garmentId: string) => void;
}

export function HomeWearNextPanel({
  unusedGarments,
  sleepingBeautiesCount,
  onOpenUnused,
  onStyleAroundGem,
}: HomeWearNextPanelProps) {
  const { t } = useLanguage();

  if (unusedGarments.length === 0) {
    return null;
  }

  const spotlight = unusedGarments[0];
  const companion = unusedGarments[1] ?? null;

  return (
    <section
      data-testid="home-wear-next"
      className="surface-secondary rounded-[1.25rem] p-5"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="label-editorial text-muted-foreground/60">
            {sleepingBeautiesCount >= 3 ? t('home.wear_sleeping_beauties') : t('home.wear_next_label')}
          </p>
          <h2 className="mt-1 font-['Playfair_Display'] italic text-[1.25rem] tracking-[-0.03em] text-foreground">
            {t('home.wear_bring_back')}
          </h2>
        </div>
        <p className="text-[0.74rem] uppercase tracking-[0.18em] text-muted-foreground/60">
          {t('home.wear_waiting').replace('{count}', String(unusedGarments.length))}
        </p>
      </div>

      <button
        type="button"
        onClick={() => onStyleAroundGem(spotlight.id)}
        className="mt-4 grid w-full gap-4 rounded-[1.1rem] bg-secondary/45 p-4 text-left sm:grid-cols-[128px_minmax(0,1fr)]"
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-1">
          <LazyImageSimple
            imagePath={getPreferredGarmentImagePath(spotlight)}
            alt={spotlight.title || spotlight.category || 'Garment'}
            className="aspect-[4/5] rounded-[1.1rem] bg-background"
          />
          {companion ? (
            <LazyImageSimple
              imagePath={getPreferredGarmentImagePath(companion)}
              alt={companion.title || companion.category || 'Garment'}
              className="aspect-[4/5] rounded-[1.1rem] bg-background opacity-80"
            />
          ) : null}
        </div>

        <div className="flex flex-col justify-between gap-4">
          <div>
            <p className="text-[0.72rem] uppercase tracking-[0.18em] text-muted-foreground/70">
              {t('home.wear_spotlight')}
            </p>
            <h3 className="mt-2 text-[1.05rem] font-medium tracking-[-0.025em] text-foreground">
              {spotlight.title || `${spotlight.color_primary || ''} ${spotlight.category || 'Garment'}`.trim()}
            </h3>
            <p className="mt-2 text-[0.92rem] leading-6 text-foreground">
              {t('home.wear_rescue_desc')}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={(e) => { e.stopPropagation(); onStyleAroundGem(spotlight.id); }}
              className="h-11 rounded-full px-4"
            >
              <Sparkles className="size-4" />
              {t('home.wear_style_this')}
            </Button>
            <Button
              variant="ghost"
              onClick={(e) => { e.stopPropagation(); onOpenUnused(); }}
              className="h-11 text-[0.82rem] font-medium text-muted-foreground underline underline-offset-4"
            >
              {t('home.wear_open_rotation')}
            </Button>
          </div>
        </div>
      </button>
    </section>
  );
}
