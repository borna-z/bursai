import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { addDays, format } from 'date-fns';
import { Cloud, Sun } from 'lucide-react';

import { useLanguage } from '@/contexts/LanguageContext';
import { useForecast, type ForecastDay } from '@/hooks/useForecast';
import { usePlannedOutfits, type PlannedOutfit } from '@/hooks/usePlannedOutfits';
import { useLocation } from '@/contexts/LocationContext';
import { LazyImageSimple } from '@/components/ui/lazy-image';
import { getPreferredGarmentImagePath } from '@/lib/garmentImage';

function getWeatherIcon(condition: string) {
  if (condition.includes('rain') || condition.includes('cloud')) return Cloud;
  return Sun;
}

export function HomeWeekAhead() {
  const { t } = useLanguage();
  const { effectiveCity } = useLocation();
  const { forecast } = useForecast({ city: effectiveCity });
  const { data: plannedOutfits } = usePlannedOutfits();

  const weekDays = useMemo(() => {
    const days: Array<{
      date: string;
      dayLabel: string;
      temp: number | null;
      condition: string | null;
      outfit: PlannedOutfit | null;
      thumbnailUrl: string | null;
    }> = [];

    for (let i = 1; i <= 5; i++) {
      const date = addDays(new Date(), i);
      const dateStr = format(date, 'yyyy-MM-dd');
      const dayLabel = format(date, 'EEE').toUpperCase();

      const forecastDay = forecast.find((f: ForecastDay) => f.date === dateStr);
      const planned = (plannedOutfits ?? []).find((p: PlannedOutfit) => p.date === dateStr);

      const firstGarment = planned?.outfit?.outfit_items?.[0]?.garment;
      const thumbnailUrl = firstGarment
        ? getPreferredGarmentImagePath(firstGarment) ?? null
        : null;

      days.push({
        date: dateStr,
        dayLabel,
        temp: forecastDay ? Math.round(forecastDay.temperature_avg) : null,
        condition: forecastDay?.condition ?? null,
        outfit: planned ?? null,
        thumbnailUrl,
      });
    }
    return days;
  }, [forecast, plannedOutfits]);

  return (
    <section className="space-y-3">
      <p className="label-editorial px-0.5 text-muted-foreground/60">
        {t('home.week_ahead') || 'Week Ahead'}
      </p>

      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
        {weekDays.map((day, i) => {
          const WeatherIcon = day.condition ? getWeatherIcon(day.condition) : Sun;

          return (
            <motion.div
              key={day.date}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 + i * 0.05, duration: 0.3 }}
              className="flex min-w-[100px] shrink-0 flex-col items-center gap-2 rounded-[1.25rem] surface-secondary p-3"
            >
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/60">
                {day.dayLabel}
              </span>

              <div className="relative h-[64px] w-[64px] overflow-hidden rounded-[0.85rem] bg-secondary/40">
                {day.thumbnailUrl ? (
                  <LazyImageSimple
                    imagePath={day.thumbnailUrl ?? undefined}
                    alt={day.dayLabel}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <span className="text-[10px] text-muted-foreground/40">—</span>
                  </div>
                )}
              </div>

              {day.temp !== null && (
                <div className="flex items-center gap-1">
                  <WeatherIcon className="h-3 w-3 text-muted-foreground/50" />
                  <span className="text-[12px] font-medium text-muted-foreground">
                    {day.temp}°C
                  </span>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
