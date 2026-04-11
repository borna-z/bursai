import { useState, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles, Star, Clock3, Calendar, CalendarDays, Bookmark } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { useOutfits, useDeleteOutfit, type OutfitWithItems } from '@/hooks/useOutfits';
import { EmptyState } from '@/components/layout/EmptyState';
import { OutfitPreviewCard } from '@/components/ui/OutfitPreviewCard';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatLocalizedDate } from '@/lib/dateLocale';
import type { Locale as AppLocale } from '@/i18n/types';
import { toast } from 'sonner';
import { TAP_TRANSITION } from '@/lib/motion';
import { CardEyebrow, CardMetaRail, CardPill } from '@/components/ui/card-language';

type FilterTab = 'all' | 'saved' | 'planned';

function translateOrFallback(t: (key: string) => string, key: string, fallback: string) {
  const translated = t(key);
  if (!translated) return fallback;
  if (translated === key) return fallback;
  // Phase 1's t() safety net returns humanized last segment on miss.
  const segment = key.includes('.') ? key.slice(key.lastIndexOf('.') + 1) : key;
  const humanizedSegment = segment
    .replace(/[_-]/g, ' ')
    .replace(/^./, (c) => c.toUpperCase());
  if (translated === humanizedSegment) return fallback;
  return translated;
}

function resolveOccasionLabel(outfit: OutfitWithItems, t: (key: string) => string) {
  const occasionKey = outfit.occasion ? `occasion.${outfit.occasion}` : '';
  const translated = occasionKey ? translateOrFallback(t, occasionKey, '') : '';
  if (translated) return translated;
  if (!outfit.occasion) return translateOrFallback(t, 'outfits.card_styled_look', 'Styled look');

  return outfit.occasion
    .split(/[_-]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatOutfitDate(dateValue: string | null | undefined, locale: string, options: Intl.DateTimeFormatOptions) {
  if (!dateValue) return null;
  return formatLocalizedDate(dateValue, locale as AppLocale, options);
}

function OutfitCard({
  outfit,
  onLongPress,
  t,
  locale,
}: {
  outfit: OutfitWithItems;
  onLongPress: (id: string) => void;
  t: (key: string) => string;
  locale: string;
}) {
  const navigate = useNavigate();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPress = useRef(false);

  const handlePointerDown = () => {
    didLongPress.current = false;
    timerRef.current = setTimeout(() => {
      didLongPress.current = true;
      onLongPress(outfit.id);
    }, 500);
  };

  const clearLongPressTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const handlePointerUp = () => {
    clearLongPressTimer();
    if (!didLongPress.current) {
      navigate(`/outfits/${outfit.id}`);
    }
  };

  const plannedFor = outfit.planned_for;
  const plannedDate = formatOutfitDate(plannedFor, locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  const generatedDate = formatOutfitDate(outfit.generated_at, locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  const dateLabel = plannedDate || generatedDate;
  const occasionLabel = resolveOccasionLabel(outfit, t);
  const excerpt = outfit.explanation
    ? outfit.explanation.length > 72
      ? `${outfit.explanation.slice(0, 72)}...`
      : outfit.explanation
    : '';
  const ratingLabel = typeof outfit.rating === 'number'
    ? Number.isInteger(outfit.rating)
      ? `${outfit.rating}/5`
      : `${outfit.rating.toFixed(1)}/5`
    : null;
  const statusLabel = plannedFor
    ? outfit.saved
      ? translateOrFallback(t, 'outfits.status_saved_planned', 'Saved + planned')
      : translateOrFallback(t, 'outfits.planned', 'Planned')
    : outfit.saved
      ? translateOrFallback(t, 'outfits.saved', 'Saved')
      : translateOrFallback(t, 'outfits.status_ready_to_wear', 'Ready to wear');
  const statusDateLabel = plannedDate
    ? translateOrFallback(t, 'outfits.status_planned_for', `Planned for ${plannedDate}`).replace('{date}', plannedDate)
    : generatedDate
      ? translateOrFallback(t, 'outfits.status_generated_on', `Generated ${generatedDate}`).replace('{date}', generatedDate)
      : translateOrFallback(t, 'outfits.status_recent', 'Recently styled');

  return (
    <motion.div
      whileTap={{ scale: 0.97 }}
      transition={TAP_TRANSITION}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={clearLongPressTimer}
      className="w-full cursor-pointer select-none will-change-transform"
    >
      <OutfitPreviewCard
        items={outfit.outfit_items}
        contentClassName="space-y-3 px-4 pb-4 pt-4"
        meta={(
          <div className="space-y-2.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1.5">
                <CardEyebrow>{translateOrFallback(t, 'outfits.card_kicker', 'Look')}</CardEyebrow>
                <p className="truncate text-[14px] font-medium leading-tight tracking-[-0.02em] text-foreground">
                  {occasionLabel}
                </p>
              </div>

              {dateLabel ? (
                <CardPill
                  icon={plannedFor ? Calendar : Clock3}
                  label={dateLabel}
                  tone="muted"
                  className="shrink-0"
                />
              ) : null}
            </div>

            <CardMetaRail>
              {outfit.saved ? (
                <CardPill icon={Bookmark} label={translateOrFallback(t, 'outfits.saved', 'Saved')} tone="accent" />
              ) : null}
              {plannedFor ? (
                <CardPill icon={CalendarDays} label={translateOrFallback(t, 'outfits.planned', 'Planned')} tone="accent" />
              ) : null}
              {ratingLabel ? (
                <CardPill icon={Star} label={ratingLabel} tone="default" />
              ) : null}
            </CardMetaRail>
          </div>
        )}
        excerpt={excerpt}
        footer={(
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-border/10 pt-3">
            <p className="text-[12px] font-medium text-foreground/72">
              {statusLabel}
            </p>
            <p className="text-[12px] text-muted-foreground">
              {statusDateLabel}
            </p>
          </div>
        )}
      />
    </motion.div>
  );
}

export function WardrobeOutfitsTab() {
  const { t, locale } = useLanguage();
  const navigate = useNavigate();
  const { data: outfits, isLoading } = useOutfits(false);
  const deleteOutfit = useDeleteOutfit();
  const [filter, setFilter] = useState<FilterTab>('all');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const handleDelete = useCallback(() => {
    if (!deleteTarget) return;
    deleteOutfit.mutate(deleteTarget, {
      onSuccess: () => {
        toast.success(t('outfits.deleted'));
        setDeleteTarget(null);
      },
      onError: () => {
        toast.error(t('outfits.delete_error'));
        setDeleteTarget(null);
      },
    });
  }, [deleteTarget, deleteOutfit, t]);

  const filtered = useMemo(() => {
    if (!outfits) return [];
    const today = new Date().toISOString().split('T')[0];

    switch (filter) {
      case 'saved':
        return outfits.filter((outfit) => outfit.saved);
      case 'planned':
        return outfits.filter((outfit) => outfit.planned_for && outfit.planned_for >= today);
      default:
        return outfits;
    }
  }, [outfits, filter]);

  const summary = useMemo(() => {
    const all = outfits ?? [];
    const today = new Date().toISOString().split('T')[0];

    return {
      all: all.length,
      saved: all.filter((outfit) => outfit.saved).length,
      planned: all.filter((outfit) => outfit.planned_for && outfit.planned_for >= today).length,
    };
  }, [outfits]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40 w-full rounded-[30px] bg-foreground/[0.06] animate-pulse" />
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="aspect-square w-full rounded-[30px] bg-foreground/[0.06] animate-pulse" />
              <Skeleton className="h-3.5 w-2/3 rounded-full bg-foreground/[0.06] animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const filters: { key: FilterTab; label: string; count: number }[] = [
    { key: 'all', label: translateOrFallback(t, 'outfits.filter_all', 'All looks'), count: summary.all },
    { key: 'saved', label: translateOrFallback(t, 'outfits.saved', 'Saved'), count: summary.saved },
    { key: 'planned', label: translateOrFallback(t, 'outfits.planned', 'Planned'), count: summary.planned },
  ];

  const showEmptyAllState = !outfits || outfits.length === 0;
  const filterEmptyTitle = filter === 'saved'
    ? translateOrFallback(t, 'outfits.empty_saved_title', 'No saved looks yet')
    : translateOrFallback(t, 'outfits.empty_planned_title', 'Nothing planned yet');
  const filterEmptyDescription = filter === 'saved'
    ? translateOrFallback(t, 'outfits.empty_saved_desc', 'Save a look and it will stay here with its quick details.')
    : translateOrFallback(t, 'outfits.empty_planned_desc', 'Planned looks will show up here with their dates.');
  const filterEmptyAction = filter === 'saved'
    ? { label: translateOrFallback(t, 'outfits.style_me_cta', 'Style me'), onClick: () => navigate('/ai/generate'), icon: Sparkles }
    : { label: translateOrFallback(t, 'outfits.open_planner', 'Open planner'), onClick: () => navigate('/plan'), icon: CalendarDays };

  return (
    <>
      <div className="space-y-3.5">
        <section className="overflow-hidden rounded-[24px] border border-border/12 bg-card/92 px-4 py-3.5 shadow-[0_12px_26px_rgba(28,25,23,0.04)]">
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <CardPill label={translateOrFallback(t, 'outfits.header_kicker', 'Outfits')} tone="muted" size="md" />
                <CardPill label={t('outfits.looks_count').replace('{count}', String(summary.all))} tone="default" size="md" />
              </div>

              <Button
                variant="outline"
                onClick={() => navigate('/plan')}
                className="h-8.5 rounded-full border-border/20 bg-background/72 px-3.5 text-xs"
              >
                {translateOrFallback(t, 'outfits.open_planner', 'Open plan')}
              </Button>
            </div>

            <div className="max-w-[28rem] space-y-1">
              <h2 className="text-[22px] font-medium leading-[0.95] tracking-[-0.04em] text-foreground">
                {translateOrFallback(t, 'outfits.header_title', 'Look archive')}
              </h2>
            </div>

            <Button
              onClick={() => navigate('/ai/generate')}
              className="h-9.5 rounded-full bg-foreground px-4 text-background"
            >
              <Sparkles className="mr-2 h-4 w-4" />
              {translateOrFallback(t, 'outfits.create', 'Generate look')}
            </Button>
          </div>
        </section>

        <div className="flex flex-wrap gap-2">
          {filters.map((item) => (
            <button
              key={item.key}
              onClick={() => setFilter(item.key)}
              className={cn(
                'inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[12px] font-medium transition-all duration-200',
                filter === item.key
                  ? 'border-foreground bg-foreground text-background'
                  : 'border-border/15 bg-secondary/55 text-foreground/62 hover:border-border/25 hover:bg-secondary/75',
              )}
            >
              <span>{item.label}</span>
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.5 text-[10px]',
                  filter === item.key
                    ? 'bg-background/15 text-background'
                    : 'bg-muted/45 text-foreground/55',
                )}
              >
                {item.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {showEmptyAllState ? (
        <EmptyState
          icon={Sparkles}
          title={translateOrFallback(t, 'outfits.empty_all_title', 'No wardrobe looks yet')}
          description={translateOrFallback(t, 'outfits.empty_all_desc', 'Generate your first outfit and it will start the archive here.')}
          action={{ label: t('outfits.create'), onClick: () => navigate('/ai/generate'), icon: Sparkles }}
          secondaryAction={{ label: translateOrFallback(t, 'outfits.open_planner', 'Open planner'), onClick: () => navigate('/plan') }}
          variant="editorial"
          titleClassName="font-display text-[22px] font-medium tracking-[-0.03em]"
          className="border-border/15 bg-card/35"
        />
      ) : filtered.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map((outfit, index) => (
            <div
              key={outfit.id}
              className="animate-drape-in"
              style={{ animationDelay: `${Math.min(index, 12) * 40}ms`, animationFillMode: 'both' }}
            >
              <OutfitCard
                outfit={outfit}
                onLongPress={(id) => setDeleteTarget(id)}
                t={t}
                locale={locale}
              />
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={filter === 'saved' ? Bookmark : CalendarDays}
          title={filterEmptyTitle}
          description={filterEmptyDescription}
          action={filterEmptyAction}
          secondaryAction={{ label: translateOrFallback(t, 'outfits.show_all', 'Show all looks'), onClick: () => setFilter('all') }}
          compact
          variant="editorial"
          titleClassName="font-display text-[20px] font-medium tracking-[-0.03em]"
          className="border-border/15 bg-card/35"
        />
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('outfits.delete_confirm')}</AlertDialogTitle>
            <AlertDialogDescription>{t('outfits.delete_warning')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleDelete}>
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
