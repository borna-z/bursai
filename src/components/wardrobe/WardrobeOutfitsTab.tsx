import { useState, useMemo, useRef, useCallback, type ComponentType } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles, Star, Clock, Calendar, CalendarDays, Bookmark } from 'lucide-react';
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

type FilterTab = 'all' | 'saved' | 'planned';

function resolveOccasionLabel(outfit: OutfitWithItems, t: (key: string) => string) {
  const occasionKey = outfit.occasion ? `occasion.${outfit.occasion}` : '';
  const translated = occasionKey ? t(occasionKey) : '';
  if (translated && translated !== occasionKey) return translated;
  if (!outfit.occasion) return 'Styled look';

  return outfit.occasion
    .split(/[_-]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatOutfitDate(dateValue: string | null | undefined, locale: string, pattern: string) {
  if (!dateValue) return null;
  return format(new Date(dateValue), pattern, { locale: getDateFnsLocale(locale as AppLocale) });
}

function StatusBadge({
  icon,
  label,
  emphasis = 'default',
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  emphasis?: 'default' | 'primary';
}) {
  const Icon = icon;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium tracking-[0.08em] uppercase',
        emphasis === 'primary'
          ? 'border-primary/20 bg-primary/[0.08] text-primary'
          : 'border-border/15 bg-background/75 text-foreground/55',
      )}
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
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

  const handlePointerLeave = () => {
    clearLongPressTimer();
  };

  const plannedFor = outfit.planned_for;
  const plannedDate = formatOutfitDate(plannedFor, locale, 'EEE, d MMM');
  const generatedDate = formatOutfitDate(outfit.generated_at, locale, 'EEE, d MMM');
  const dateLabel = plannedDate || generatedDate;

  const occasionLabel = resolveOccasionLabel(outfit, t);
  const excerpt = outfit.explanation
    ? outfit.explanation.length > 92
      ? `${outfit.explanation.slice(0, 92)}...`
      : outfit.explanation
    : '';
  const ratingLabel = typeof outfit.rating === 'number'
    ? Number.isInteger(outfit.rating)
      ? `${outfit.rating}/5`
      : `${outfit.rating.toFixed(1)}/5`
    : null;
  const statusLabel = plannedFor
    ? outfit.saved
      ? 'Saved + planned'
      : 'Planned'
    : outfit.saved
      ? 'Saved'
      : 'Ready to wear';
  const statusDateLabel = plannedDate
    ? `Planned for ${plannedDate}`
    : generatedDate
      ? `Generated ${generatedDate}`
      : 'Recently styled';

  return (
    <motion.div
      whileTap={{ scale: 0.97 }}
      transition={TAP_TRANSITION}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerLeave}
      className="w-full cursor-pointer select-none will-change-transform"
    >
      <OutfitPreviewCard
        items={outfit.outfit_items}
        className="bg-card/85"
        contentClassName="space-y-3 px-4 pb-4 pt-3.5"
        meta={(
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <p className="font-['DM_Sans'] text-[10px] uppercase tracking-[0.18em] text-foreground/38">
                  Wardrobe look
                </p>
                <p className="truncate text-[15px] font-medium leading-tight text-foreground">
                  {occasionLabel}
                </p>
              </div>

              {dateLabel && (
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-muted/45 px-2.5 py-1 text-[10px] font-medium text-foreground/55">
                  {plannedFor ? (
                    <Calendar className="h-3 w-3" />
                  ) : (
                    <Clock className="h-3 w-3" />
                  )}
                  {dateLabel}
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5">
              {outfit.saved && (
                <StatusBadge icon={Bookmark} label="Saved" emphasis="primary" />
              )}
              {plannedFor && (
                <StatusBadge icon={CalendarDays} label="Planned" emphasis="primary" />
              )}
              {ratingLabel && (
                <StatusBadge icon={Star} label={ratingLabel} />
              )}
            </div>
          </div>
        )}
        excerpt={excerpt}
        footer={(
          <div className="grid grid-cols-2 gap-3 border-t border-border/10 pt-3">
            <div className="space-y-1">
              <p className="font-['DM_Sans'] text-[10px] uppercase tracking-[0.16em] text-foreground/38">
                Date
              </p>
              <p className="text-[12px] leading-relaxed text-foreground/68">
                {statusDateLabel}
              </p>
            </div>
            <div className="space-y-1">
              <p className="font-['DM_Sans'] text-[10px] uppercase tracking-[0.16em] text-foreground/38">
                Status
              </p>
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
      onSuccess: () => { toast.success(t('outfits.deleted')); setDeleteTarget(null); },
      onError: () => { toast.error(t('outfits.delete_error')); setDeleteTarget(null); },
    });
  }, [deleteTarget, deleteOutfit, t]);

  const filtered = useMemo(() => {
    if (!outfits) return [];
    const today = new Date().toISOString().split('T')[0];
    switch (filter) {
      case 'saved': return outfits.filter(o => o.saved);
      case 'planned': return outfits.filter(o => o.planned_for && o.planned_for >= today);
      default: return outfits;
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
        <Skeleton className="h-40 w-full rounded-[28px] bg-foreground/[0.06] animate-pulse" />
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="w-full aspect-square rounded-[28px] bg-foreground/[0.06] animate-pulse" />
              <Skeleton className="h-3.5 w-2/3 rounded-full bg-foreground/[0.06] animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const filters: { key: FilterTab; label: string; count: number }[] = [
    { key: 'all', label: 'All looks', count: summary.all },
    { key: 'saved', label: 'Saved', count: summary.saved },
    { key: 'planned', label: 'Planned', count: summary.planned },
  ];

  const showEmptyAllState = !outfits || outfits.length === 0;
  const filterEmptyTitle = filter === 'saved' ? 'No saved looks yet' : 'Nothing planned yet';
  const filterEmptyDescription = filter === 'saved'
    ? 'Bookmark looks you want to keep close and they will collect here with their quick details.'
    : 'Planned looks from your calendar and weekly planner will show up here with their dates.';
  const filterEmptyAction = filter === 'saved'
    ? { label: 'Style outfit', onClick: () => navigate('/ai/generate'), icon: Sparkles }
    : { label: 'Open plan', onClick: () => navigate('/plan'), icon: CalendarDays };

  return (
    <>
      <div className="space-y-5">
        <section className="overflow-hidden rounded-[30px] border border-border/15 bg-card/45 px-4 py-4 shadow-[0_18px_45px_rgba(28,25,23,0.04)]">
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="font-['DM_Sans'] text-[10px] uppercase tracking-[0.22em] text-foreground/38">
                Wardrobe looks
              </p>
              <div className="space-y-1.5">
                <h2 className="font-['Playfair_Display'] text-[24px] leading-none text-foreground">
                  Styled outfits, kept close
                </h2>
                <p className="max-w-[34rem] text-[13px] leading-relaxed text-muted-foreground/78">
                  Saved, planned, and recent looks stay together here with just enough detail to scan before you open one.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {filters.map((item) => (
                <div
                  key={`summary-${item.key}`}
                  className="rounded-2xl border border-border/12 bg-background/75 px-3 py-3"
                >
                  <p className="font-['DM_Sans'] text-[10px] uppercase tracking-[0.18em] text-foreground/38">
                    {item.label}
                  </p>
                  <p className="mt-1 text-[20px] font-medium leading-none text-foreground">
                    {item.count}
                  </p>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                onClick={() => navigate('/ai/generate')}
                className="h-11 rounded-full bg-foreground px-5 text-background sm:flex-1"
              >
                <Sparkles className="mr-2 h-4 w-4" />
                Style outfit
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate('/plan')}
                className="h-11 rounded-full border-border/20 bg-background/70 px-5 sm:flex-1"
              >
                <CalendarDays className="mr-2 h-4 w-4" />
                Open plan
              </Button>
            </div>

            <p className="text-[11px] leading-relaxed text-muted-foreground/58">
              Open a look for full detail. Press and hold a card if you want to remove it from your wardrobe archive.
            </p>
          </div>
        </section>

        <div className="flex flex-wrap gap-2">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                'inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-[12px] font-medium transition-all duration-200',
                filter === f.key
                  ? 'border-foreground bg-foreground text-background'
                  : 'border-border/15 bg-background/80 text-foreground/62 hover:border-border/30 hover:bg-muted/20'
              )}
            >
              <span>{f.label}</span>
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.5 text-[10px]',
                  filter === f.key
                    ? 'bg-background/15 text-background'
                    : 'bg-muted/45 text-foreground/55',
                )}
              >
                {f.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {showEmptyAllState ? (
        <EmptyState
          icon={Sparkles}
          title="No wardrobe looks yet"
          description="Generate your first outfit and it will start building a calmer archive of looks, plans, and saves here."
          hint="Saved looks and planned dates will appear as quick status details on each card."
          action={{ label: t('outfits.create'), onClick: () => navigate('/ai/generate'), icon: Sparkles }}
          secondaryAction={{ label: 'Open plan', onClick: () => navigate('/plan') }}
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
          hint={filter === 'saved' ? 'Saved looks are easiest to build from Style outfit and any outfit detail view.' : 'Planning a look adds its date and keeps it visible alongside the rest of your wardrobe outfits.'}
          action={filterEmptyAction}
          secondaryAction={{ label: 'Show all looks', onClick: () => setFilter('all') }}
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
