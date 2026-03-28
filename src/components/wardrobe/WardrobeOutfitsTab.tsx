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
import { format } from 'date-fns';
import { getDateFnsLocale } from '@/lib/dateLocale';
import type { Locale as AppLocale } from '@/i18n/types';
import { toast } from 'sonner';
import { TAP_TRANSITION } from '@/lib/motion';
import { CardEyebrow, CardMetaRail, CardPill } from '@/components/ui/card-language';

type FilterTab = 'all' | 'saved' | 'planned';

function translateOrFallback(t: (key: string) => string, key: string, fallback: string) {
  const translated = t(key);
  return translated && translated !== key ? translated : fallback;
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

function formatOutfitDate(dateValue: string | null | undefined, locale: string, pattern: string) {
  if (!dateValue) return null;
  return format(new Date(dateValue), pattern, { locale: getDateFnsLocale(locale as AppLocale) });
}

function SummaryTile({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-[22px] border border-border/10 bg-white/72 px-3 py-3">
      <CardEyebrow>{label}</CardEyebrow>
      <p className="mt-1.5 text-[22px] font-medium leading-none tracking-[-0.03em] text-foreground">
        {value}
      </p>
    </div>
  );
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
  const plannedDate = formatOutfitDate(plannedFor, locale, 'EEE, d MMM');
  const generatedDate = formatOutfitDate(outfit.generated_at, locale, 'EEE, d MMM');
  const dateLabel = plannedDate || generatedDate;
  const occasionLabel = resolveOccasionLabel(outfit, t);
  const excerpt = outfit.explanation
    ? outfit.explanation.length > 88
      ? `${outfit.explanation.slice(0, 88)}...`
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
        contentClassName="space-y-3.5 px-4 pb-4 pt-4"
        meta={(
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1.5">
                <CardEyebrow>{translateOrFallback(t, 'outfits.card_kicker', 'Outfit')}</CardEyebrow>
                <p className="truncate text-[15px] font-medium leading-tight tracking-[-0.02em] text-foreground">
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
          <div className="grid grid-cols-2 gap-3 border-t border-[#1C1917]/8 pt-3">
            <div className="space-y-1.5">
              <CardEyebrow>{translateOrFallback(t, 'outfits.card_date', 'Date')}</CardEyebrow>
              <p className="text-[12px] leading-relaxed text-foreground/68">
                {statusDateLabel}
              </p>
            </div>
            <div className="space-y-1.5">
              <CardEyebrow>{translateOrFallback(t, 'outfits.card_status', 'Status')}</CardEyebrow>
              <p className="text-[12px] leading-relaxed text-foreground/68">
                {statusLabel}
              </p>
            </div>
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
      <div className="space-y-5">
        <section className="overflow-hidden rounded-[32px] border border-border/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(246,240,230,0.96))] px-4 py-4 shadow-[0_18px_44px_rgba(28,25,23,0.05)]">
          <div className="space-y-4">
            <div className="space-y-2">
              <CardEyebrow>{translateOrFallback(t, 'outfits.header_kicker', 'Wardrobe looks')}</CardEyebrow>
              <div className="space-y-1.5">
                <h2 className="text-[25px] font-medium leading-none tracking-[-0.04em] text-foreground">
                  {translateOrFallback(t, 'outfits.header_title', 'Your outfit archive')}
                </h2>
                <p className="max-w-[34rem] text-[13px] leading-relaxed text-muted-foreground/72">
                  {translateOrFallback(t, 'outfits.header_desc', 'Saved, planned, and recent looks live here.')}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {filters.map((item) => (
                <SummaryTile
                  key={`summary-${item.key}`}
                  label={item.label}
                  value={item.count}
                />
              ))}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                onClick={() => navigate('/ai/generate')}
                className="h-11 rounded-full bg-foreground px-5 text-background sm:flex-1"
              >
                <Sparkles className="mr-2 h-4 w-4" />
                {translateOrFallback(t, 'outfits.style_me_cta', 'Style me')}
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate('/plan')}
                className="h-11 rounded-full border-border/20 bg-background/72 px-5 sm:flex-1"
              >
                <CalendarDays className="mr-2 h-4 w-4" />
                {translateOrFallback(t, 'outfits.open_planner', 'Open planner')}
              </Button>
            </div>

            <p className="text-[11px] leading-relaxed text-muted-foreground/58">
              {translateOrFallback(t, 'outfits.header_hint', 'Open a look for detail, or press and hold to remove it from your archive.')}
            </p>
          </div>
        </section>

        <div className="flex flex-wrap gap-2">
          {filters.map((item) => (
            <button
              key={item.key}
              onClick={() => setFilter(item.key)}
              className={cn(
                'inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-[12px] font-medium transition-all duration-200',
                filter === item.key
                  ? 'border-foreground bg-foreground text-background'
                  : 'border-border/15 bg-background/80 text-foreground/62 hover:border-border/30 hover:bg-muted/20',
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
          hint={translateOrFallback(t, 'outfits.empty_all_hint', 'Saved looks and planned dates will show up as quick details on each card.')}
          action={{ label: t('outfits.create'), onClick: () => navigate('/ai/generate'), icon: Sparkles }}
          secondaryAction={{ label: translateOrFallback(t, 'outfits.open_planner', 'Open planner'), onClick: () => navigate('/plan') }}
          variant="editorial"
          titleClassName="font-['Playfair_Display'] text-[22px] font-medium tracking-[-0.03em]"
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
          hint={filter === 'saved'
            ? translateOrFallback(t, 'outfits.saved_hint_long', 'Saved looks are easiest to build from Style Me or any outfit detail view.')
            : translateOrFallback(t, 'outfits.planned_hint_long', 'Planning a look adds its date and keeps it visible here.')}
          action={filterEmptyAction}
          secondaryAction={{ label: translateOrFallback(t, 'outfits.show_all', 'Show all looks'), onClick: () => setFilter('all') }}
          compact
          variant="editorial"
          titleClassName="font-['Playfair_Display'] text-[20px] font-medium tracking-[-0.03em]"
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
