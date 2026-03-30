import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';

interface HomeStatsStripProps {
  garmentCount: number;
  outfitCount: number;
  streakDays: number;
}

export function HomeStatsStrip({ garmentCount, outfitCount, streakDays }: HomeStatsStripProps) {
  const { t } = useLanguage();

  const stats = [
    { value: garmentCount, label: t('home.stat_pieces') || 'Pieces' },
    { value: outfitCount, label: t('home.stat_outfits') || 'Outfits' },
    { value: streakDays, label: t('home.stat_streak') || 'Day Streak' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.15 }}
      className="stats-strip surface-secondary rounded-[1.25rem]"
    >
      {stats.map((stat) => (
        <div key={stat.label}>
          <span className="text-[1.35rem] font-semibold tracking-[-0.04em] text-foreground">
            {stat.value}
          </span>
          <span className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground/60">
            {stat.label}
          </span>
        </div>
      ))}
    </motion.div>
  );
}
