import { useLanguage } from '@/contexts/LanguageContext';

interface InsightsHeroStatsProps {
  garmentCount: number;
  outfitCount: number;
  wearCount: number;
}

export function InsightsHeroStats({ garmentCount, outfitCount, wearCount }: InsightsHeroStatsProps) {
  const { t } = useLanguage();

  const stats = [
    { value: garmentCount, label: t('insights.garments') || 'Garments' },
    { value: outfitCount, label: t('insights.outfits') || 'Outfits' },
    { value: wearCount, label: t('insights.wears') || 'Wears' },
  ];

  return (
    <div className="mx-[var(--page-px)] mb-4 grid grid-cols-3 gap-[10px]">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="bg-card/30 border-[0.5px] border-border/40 rounded-[14px] py-[14px] px-3 text-center"
        >
          <div
            className="text-foreground"
            style={{ fontSize: 26, fontFamily: 'DM Sans, sans-serif', fontWeight: 600, lineHeight: 1.1 }}
          >
            {stat.value}
          </div>
          <div
            className="mt-1 uppercase tracking-wider text-foreground"
            style={{ fontSize: 9, opacity: 0.3 }}
          >
            {stat.label}
          </div>
        </div>
      ))}
    </div>
  );
}
