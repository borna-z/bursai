import { useMemo, useRef, useEffect } from 'react';
import { format, addDays, isToday, isSameDay } from 'date-fns';
import { motion, useReducedMotion } from 'framer-motion';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { getDateFnsLocale } from '@/lib/dateLocale';
import { EASE_CURVE, STAGGER_DELAY } from '@/lib/motion';
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
  const prefersReduced = useReducedMotion();
  const todayRef = useRef<HTMLButtonElement>(null);

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

  // Scroll today into view on mount
  useEffect(() => {
    todayRef.current?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, []);

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

      {/* Repetition warning — REDESIGN 2 */}
      {repeatedGarments.size > 0 && (
        <motion.div
          initial={prefersReduced ? { opacity: 0 } : { opacity: 0, y: 4 }}
          animate={prefersReduced ? { opacity: 1 } : { opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: EASE_CURVE }}
          className="flex items-center gap-3 bg-card border border-border/15 rounded-2xl px-4 py-3"
        >
          <RefreshCw className="w-4 h-4 text-foreground/40 shrink-0" />
          <p className="flex-1 text-[13px] font-['DM_Sans',sans-serif] text-foreground/70">
            {t('plan.repeat_warning_generic') || 'Some garments repeat this week'}
          </p>
          <span className="text-[12px] font-['DM_Sans',sans-serif] text-muted-foreground/50 underline cursor-pointer">
            {t('plan.review') || 'Review'}
          </span>
        </motion.div>
      )}

      {/* Week strip — REDESIGN 1 */}
      <div className="flex gap-1.5 justify-between overflow-x-auto scrollbar-hide">
        {days.map((date, idx) => {
          const dateStr = format(date, 'yyyy-MM-dd');
          const isSelected = isSameDay(date, selectedDate);
          const isTodayDate = isToday(date);
          const dayOutfits = plannedOutfits.filter(p => p.date === dateStr && p.outfit_id);
          const hasOutfit = dayOutfits.length > 0;

          // Determine pill state
          const isTodayWithOutfit = isTodayDate && hasOutfit;
          const isTodayNoOutfit = isTodayDate && !hasOutfit;
          const isSelectedNotToday = isSelected && !isTodayDate;

          return (
            <motion.button
              key={dateStr}
              ref={isTodayDate ? todayRef : undefined}
              onClick={() => { hapticLight(); onSelectDate(date); }}
              initial={prefersReduced ? { opacity: 0 } : { opacity: 0, y: 8 }}
              animate={prefersReduced ? { opacity: 1 } : { opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: idx * STAGGER_DELAY, ease: EASE_CURVE }}
              className={cn(
                'w-[44px] h-[64px] rounded-2xl flex flex-col items-center justify-center gap-1 shrink-0 transition-all duration-200',
                'active:scale-95',
                // Default — no outfit
                !isTodayDate && !isSelected && !hasOutfit && 'bg-transparent text-muted-foreground/40',
                // Has outfit, not today, not selected
                !isTodayDate && !isSelected && hasOutfit && 'bg-transparent text-foreground/70',
                // Today no outfit (not selected — but today auto-highlights)
                isTodayNoOutfit && 'bg-foreground/[0.06] text-foreground font-semibold border border-border/30',
                // Today has outfit
                isTodayWithOutfit && 'bg-foreground text-background',
                // Selected not today
                isSelectedNotToday && 'bg-foreground/[0.08] text-foreground border border-border/20',
              )}
            >
              {/* Day name */}
              <span className={cn(
                "text-[10px] font-medium tracking-widest font-['DM_Sans',sans-serif] uppercase",
                isTodayWithOutfit ? 'text-background/70' : '',
              )}>
                {format(date, 'EEE', { locale: dfLocale }).slice(0, 2)}
              </span>

              {/* Day number */}
              <span className={cn(
                "text-[18px] font-medium font-['DM_Sans',sans-serif] leading-none",
                isTodayWithOutfit ? 'text-background' : '',
                isTodayNoOutfit ? 'font-semibold' : '',
              )}>
                {format(date, 'd')}
              </span>

              {/* Outfit dot */}
              {hasOutfit && (
                <div className={cn(
                  'w-1.5 h-1.5 rounded-full',
                  isTodayWithOutfit ? 'bg-background/40' : 'bg-foreground/30',
                )} />
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
