import { useMemo } from 'react';
import { format, addDays } from 'date-fns';
import { motion } from 'framer-motion';
import { Plus, AlertTriangle, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { LazyImageSimple } from '@/components/ui/lazy-image';
import { useLanguage } from '@/contexts/LanguageContext';
import { getDateFnsLocale } from '@/lib/dateLocale';
import { EASE_CURVE } from '@/lib/motion';
import { hapticLight } from '@/lib/haptics';
import type { PlannedOutfit } from '@/hooks/usePlannedOutfits';

interface WeekOverviewProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  plannedOutfits: PlannedOutfit[];
  className?: string;
}

/**
 * Detects garments repeated across different days in the week.
 * Returns a Map<garmentId, dayCount>.
 */
function detectRepetitions(plannedOutfits: PlannedOutfit[], days: Date[]): Map<string, number> {
  const garmentDays = new Map<string, Set<string>>();

  for (const day of days) {
    const dateStr = format(day, 'yyyy-MM-dd');
    const dayOutfits = plannedOutfits.filter(p => p.date === dateStr && p.outfit);

    for (const po of dayOutfits) {
      for (const item of po.outfit?.outfit_items || []) {
        if (!garmentDays.has(item.garment_id)) {
          garmentDays.set(item.garment_id, new Set());
        }
        garmentDays.get(item.garment_id)!.add(dateStr);
      }
    }
  }

  const repeated = new Map<string, number>();
  for (const [id, dates] of garmentDays) {
    if (dates.size > 1) repeated.set(id, dates.size);
  }
  return repeated;
}

export function WeekOverview({ selectedDate, onSelectDate, plannedOutfits, className }: WeekOverviewProps) {
  const { t, locale } = useLanguage();
  const dfLocale = getDateFnsLocale(locale);

  const days = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 7 }, (_, i) => addDays(today, i));
  }, []);

  const repeatedGarments = useMemo(
    () => detectRepetitions(plannedOutfits, days),
    [plannedOutfits, days],
  );

  const plannedCount = useMemo(() => {
    return days.filter(d => {
      const dateStr = format(d, 'yyyy-MM-dd');
      return plannedOutfits.some(p => p.date === dateStr && p.outfit_id);
    }).length;
  }, [plannedOutfits, days]);

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header with coverage stat */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground/60">
          {t('plan.week_overview') || 'Your week'}
        </h3>
        <Badge variant="secondary" className="text-[10px] font-medium">
          {plannedCount}/7 {t('plan.days_planned') || 'planned'}
        </Badge>
      </div>

      {/* Repetition warning */}
      {repeatedGarments.size > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: EASE_CURVE }}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-warning/8 border border-warning/15"
        >
          <AlertTriangle className="w-3.5 h-3.5 text-warning shrink-0" />
          <p className="text-[11px] text-warning">
            {repeatedGarments.size === 1
              ? (t('plan.repeat_warning_single') || '1 piece repeats across days — consider swapping for variety.')
              : (t('plan.repeat_warning') || `${repeatedGarments.size} pieces repeat across days — consider swapping for variety.`)}
          </p>
        </motion.div>
      )}

      {/* Day cards grid */}
      <div className="grid grid-cols-7 gap-1.5">
        {days.map((date, idx) => {
          const dateStr = format(date, 'yyyy-MM-dd');
          const isSelected = format(selectedDate, 'yyyy-MM-dd') === dateStr;
          const dayOutfits = plannedOutfits.filter(p => p.date === dateStr && p.outfit);
          const firstOutfit = dayOutfits[0]?.outfit;
          const isWorn = dayOutfits.some(p => p.status === 'worn');
          const hasRepeat = dayOutfits.some(po =>
            po.outfit?.outfit_items.some(item => repeatedGarments.has(item.garment_id)),
          );

          return (
            <motion.button
              key={dateStr}
              onClick={() => { hapticLight(); onSelectDate(date); }}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: idx * 0.04, ease: EASE_CURVE }}
              className={cn(
                'flex flex-col items-center gap-1 py-2 px-1 rounded-xl transition-all duration-200',
                'active:scale-95',
                isSelected
                  ? 'bg-foreground text-background shadow-sm ring-1 ring-foreground/20'
                  : 'hover:bg-muted/50',
              )}
            >
              {/* Day label */}
              <span className={cn(
                'text-[9px] uppercase font-semibold tracking-wider',
                isSelected ? 'text-background/60' : 'text-muted-foreground/50',
              )}>
                {format(date, 'EEE', { locale: dfLocale }).slice(0, 2)}
              </span>

              {/* Date number */}
              <span className={cn(
                'text-sm font-bold leading-none',
                isSelected ? 'text-background' : isWorn ? 'text-success' : firstOutfit ? 'text-foreground' : 'text-muted-foreground/40',
              )}>
                {format(date, 'd')}
              </span>

              {/* Outfit thumbnail or empty indicator */}
              <div className={cn(
                'w-8 h-8 rounded-lg overflow-hidden mt-0.5',
                !firstOutfit && 'border border-dashed flex items-center justify-center',
                !firstOutfit && (isSelected ? 'border-background/30' : 'border-muted-foreground/20'),
              )}>
                {firstOutfit ? (
                  <div className="grid grid-cols-2 w-full h-full">
                    {firstOutfit.outfit_items.slice(0, 4).map((item) => (
                      <div key={item.id} className="overflow-hidden">
                        <LazyImageSimple
                          imagePath={item.garment?.image_path}
                          alt=""
                          className="w-full h-full"
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <Plus className={cn(
                    'w-3 h-3',
                    isSelected ? 'text-background/40' : 'text-muted-foreground/25',
                  )} />
                )}
              </div>

              {/* Status indicators */}
              <div className="h-2 flex items-center gap-0.5">
                {isWorn && <Check className={cn('w-2.5 h-2.5', isSelected ? 'text-background/60' : 'text-success')} />}
                {hasRepeat && !isWorn && (
                  <div className={cn('w-1.5 h-1.5 rounded-full', isSelected ? 'bg-warning/60' : 'bg-warning/50')} />
                )}
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
