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
            Some garments repeat this week
          </p>
          <span className="text-[12px] font-['DM_Sans',sans-serif] text-muted-foreground/50 underline cursor-pointer">
            {t('plan.review') || 'Review'}
          </span>
        </motion.div>
      )}

      {/* Week strip */}
      <div style={{ display: 'flex', width: '100%' }}>
        {days.map((date, idx) => {
          const dateStr = format(date, 'yyyy-MM-dd');
          const isSelected = isSameDay(date, selectedDate);
          const isTodayDate = isToday(date);
          const dayOutfits = plannedOutfits.filter(p => p.date === dateStr && p.outfit_id);
          const hasOutfit = dayOutfits.length > 0;

          const bg = isTodayDate ? '#1C1917' : '#EDE8DF';
          const textColor = isTodayDate ? '#F5F0E8' : '#1C1917';
          const textMuted = isTodayDate ? 'rgba(245,240,232,0.5)' : 'rgba(28,25,23,0.45)';
          const dotColor = isTodayDate ? 'rgba(245,240,232,0.5)' : 'rgba(28,25,23,0.3)';

          return (
            <motion.button
              key={dateStr}
              ref={isTodayDate ? todayRef : undefined}
              onClick={() => { hapticLight(); onSelectDate(date); }}
              initial={prefersReduced ? { opacity: 0 } : { opacity: 0, y: 8 }}
              animate={prefersReduced ? { opacity: 1 } : { opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: idx * STAGGER_DELAY, ease: EASE_CURVE }}
              style={{
                flex: 1,
                height: 64,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 3,
                background: bg,
                border: 'none',
                borderBottom: isSelected && !isTodayDate ? '2px solid #1C1917' : '2px solid transparent',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              {/* Day letter */}
              <span style={{
                fontFamily: 'DM Sans, sans-serif',
                fontSize: 8,
                fontWeight: 500,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: textMuted,
              }}>
                {format(date, 'EEE', { locale: dfLocale }).slice(0, 1)}
              </span>

              {/* Date number */}
              <span style={{
                fontFamily: 'DM Sans, sans-serif',
                fontSize: 9,
                fontWeight: 500,
                color: textColor,
              }}>
                {format(date, 'd')}
              </span>

              {/* Dot */}
              {hasOutfit && (
                <div style={{ width: 4, height: 4, background: dotColor }} />
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
