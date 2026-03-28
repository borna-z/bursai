import { useMemo } from 'react';
import { addDays, format, isSameDay, isToday } from 'date-fns';
import { motion, useReducedMotion } from 'framer-motion';

import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import type { PlannedOutfit } from '@/hooks/usePlannedOutfits';
import { hapticLight } from '@/lib/haptics';
import { getDateFnsLocale } from '@/lib/dateLocale';
import { EASE_CURVE, STAGGER_DELAY } from '@/lib/motion';
import { cn } from '@/lib/utils';

interface WeekOverviewProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  plannedOutfits: PlannedOutfit[];
  className?: string;
}

export function WeekOverview({ selectedDate, onSelectDate, plannedOutfits, className }: WeekOverviewProps) {
  const { t, locale } = useLanguage();
  const prefersReduced = useReducedMotion();
  const dateLocale = getDateFnsLocale(locale);

  const days = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 7 }, (_, i) => addDays(today, i));
  }, []);

  const plannedCount = useMemo(() => {
    return days.filter((date) => {
      const dateStr = format(date, 'yyyy-MM-dd');
      return plannedOutfits.some((planned) => planned.date === dateStr && planned.outfit_id);
    }).length;
  }, [days, plannedOutfits]);

  return (
    <section className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[0.72rem] uppercase tracking-[0.18em] text-muted-foreground/60">
            {t('plan.week_overview') || 'This week'}
          </p>
          <p className="mt-1 text-[0.86rem] text-muted-foreground">
            Seven days, one calm overview.
          </p>
        </div>
        <Badge variant="secondary" className="rounded-full px-3 py-1 text-[0.7rem] uppercase tracking-[0.14em]">
          {plannedCount}/7 {t('plan.days_planned') || 'planned'}
        </Badge>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {days.map((date, idx) => {
          const dateStr = format(date, 'yyyy-MM-dd');
          const isSelected = isSameDay(date, selectedDate);
          const isTodayDate = isToday(date);
          const hasOutfit = plannedOutfits.some((planned) => planned.date === dateStr && planned.outfit_id);

          return (
            <motion.button
              key={dateStr}
              type="button"
              onClick={() => {
                hapticLight();
                onSelectDate(date);
              }}
              initial={prefersReduced ? { opacity: 0 } : { opacity: 0, y: 8 }}
              animate={prefersReduced ? { opacity: 1 } : { opacity: 1, y: 0 }}
              transition={{ duration: 0.26, delay: idx * STAGGER_DELAY, ease: EASE_CURVE }}
              className={cn(
                'flex min-h-[72px] flex-col items-center justify-center gap-1 rounded-[1.25rem] border px-1.5 transition-colors',
                isSelected
                  ? 'border-foreground bg-foreground text-background shadow-[0_4px_12px_rgba(28,25,23,0.18)]'
                  : isTodayDate
                    ? 'border-border/60 bg-card text-foreground ring-1 ring-foreground/20'
                    : 'border-border/50 bg-background/72 text-foreground',
              )}
            >
              <span className={cn(
                'text-[0.62rem] font-medium uppercase tracking-[0.16em]',
                isSelected ? 'text-background/70' : 'text-muted-foreground/70',
              )}>
                {format(date, 'EEE', { locale: dateLocale }).slice(0, 1)}
              </span>
              <span className="text-[0.95rem] font-semibold tracking-[-0.03em]">
                {format(date, 'd')}
              </span>
              <span
                className={cn(
                  'h-1.5 w-1.5 rounded-full',
                  hasOutfit
                    ? isSelected
                      ? 'bg-background/75'
                      : 'bg-foreground/55'
                    : 'bg-transparent',
                )}
              />
            </motion.button>
          );
        })}
      </div>
    </section>
  );
}
