import { useLanguage } from '@/contexts/LanguageContext';

interface HomeStatsStripProps {
  garmentCount: number;
  outfitCount: number;
}

export function HomeStatsStrip({ garmentCount, outfitCount }: HomeStatsStripProps) {
  const { t } = useLanguage();

  const stats = [
    { value: garmentCount, label: t('home.stat_pieces') || 'Pieces' },
    { value: outfitCount, label: t('home.stat_outfits') || 'Outfits' },
  ];

  return (
    <div className="stats-strip surface-secondary rounded-[1.25rem]">
      {stats.map((stat) => (
        <div key={stat.label}>
          <span className="text-[1.2rem] font-semibold tracking-[-0.04em] text-foreground">
            {stat.value}
          </span>
          <span className="mt-0.5 text-[9px] font-medium uppercase tracking-[0.12em] text-muted-foreground/60">
            {stat.label}
          </span>
        </div>
      ))}
    </div>
  );
}
