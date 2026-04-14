import { motion } from 'framer-motion';
import { MapPin, Trash2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { EASE_CURVE } from '@/lib/motion';
import { hapticLight } from '@/lib/haptics';
import { formatLocalizedDate } from '@/lib/dateLocale';
import type { TravelCapsuleRow } from './types';

interface TripHistoryListProps {
  trips: TravelCapsuleRow[];
  onSelect: (trip: TravelCapsuleRow) => void;
  onDelete: (id: string) => void;
}

export function TripHistoryList({ trips, onSelect, onDelete }: TripHistoryListProps) {
  const { t, locale } = useLanguage();

  if (trips.length === 0) return null;

  const formatRange = (start: string | null, end: string | null) => {
    if (!start || !/^\d{4}-\d{2}-\d{2}/.test(start)) return '';
    const startLabel = formatLocalizedDate(new Date(start), locale, {
      month: 'short',
      day: 'numeric',
    });
    if (!end || !/^\d{4}-\d{2}-\d{2}/.test(end)) return startLabel;
    const endLabel = formatLocalizedDate(new Date(end), locale, {
      month: 'short',
      day: 'numeric',
    });
    return `${startLabel} – ${endLabel}`;
  };

  return (
    <section className="space-y-3">
      <p className="label-editorial text-muted-foreground">
        {t('travel.past_trips') || 'Past trips'}
      </p>
      <div className="space-y-2">
        {trips.map((trip, idx) => {
          const itemCount = trip.result?.capsule_items?.length ?? 0;
          const outfitCount = trip.result?.outfits?.length ?? 0;
          return (
            <motion.div
              key={trip.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: idx * 0.03, ease: EASE_CURVE }}
              className="group flex items-center gap-3 rounded-[1.25rem] border border-border/40 bg-card p-4"
            >
              <button
                type="button"
                onClick={() => {
                  hapticLight();
                  onSelect(trip);
                }}
                className="flex flex-1 items-center gap-3 text-left"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
                  <MapPin className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display italic text-[0.95rem] text-foreground">
                    {trip.destination}
                  </p>
                  <p className="mt-0.5 text-[0.72rem] text-muted-foreground">
                    {formatRange(trip.start_date, trip.end_date)}
                  </p>
                </div>
                <div className="flex flex-col items-end text-[0.7rem] text-muted-foreground">
                  <span>{itemCount} {t('capsule.items_count') || 'items'}</span>
                  <span>{outfitCount} {t('capsule.outfits_count') || 'outfits'}</span>
                </div>
              </button>
              <button
                type="button"
                onClick={() => {
                  hapticLight();
                  onDelete(trip.id);
                }}
                className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground/60 transition-colors hover:bg-destructive/10 hover:text-destructive"
                aria-label={t('common.delete') || 'Delete'}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
