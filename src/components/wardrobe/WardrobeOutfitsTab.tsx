import { useState, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles, Star, Clock, Calendar, Bookmark } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { useOutfits, useDeleteOutfit, type OutfitWithItems } from '@/hooks/useOutfits';
import { EmptyState } from '@/components/layout/EmptyState';
import { LazyImageSimple } from '@/components/ui/lazy-image';
import { useLanguage } from '@/contexts/LanguageContext';
import { format } from 'date-fns';
import { getDateFnsLocale } from '@/lib/dateLocale';
import type { Locale as AppLocale } from '@/i18n/types';
import { toast } from 'sonner';
import { TAP_TRANSITION } from '@/lib/motion';
import { getPreferredGarmentImagePath } from '@/lib/garmentImage';

type FilterTab = 'all' | 'saved' | 'planned';

function OutfitMosaic({ items }: { items: OutfitWithItems['outfit_items'] }) {
  const slots = items.slice(0, 4);
  return (
    <div className="aspect-square rounded-xl overflow-hidden grid grid-cols-2 grid-rows-2 bg-muted/30">
      {slots.map((item, i) => (
        <div key={item.id} className={cn('overflow-hidden', i === 0 && 'rounded-tl-xl', i === 1 && 'rounded-tr-xl', i === 2 && 'rounded-bl-xl', i === 3 && 'rounded-br-xl')}>
          <LazyImageSimple
            imagePath={item.garment ? getPreferredGarmentImagePath(item.garment) : undefined}
            alt={item.garment?.title || item.slot}
            className="w-full h-full"
          />
        </div>
      ))}
      {/* Fill empty slots */}
      {Array.from({ length: Math.max(0, 4 - slots.length) }).map((_, i) => (
        <div key={`empty-${i}`} className="bg-muted/20" />
      ))}
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

  const handlePointerUp = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!didLongPress.current) {
      navigate(`/outfits/${outfit.id}`);
    }
  };

  const handlePointerLeave = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  const plannedFor = outfit.planned_for;
  const dateStr = plannedFor
    ? format(new Date(plannedFor), 'd MMM', { locale: getDateFnsLocale(locale as AppLocale) })
    : outfit.generated_at
      ? format(new Date(outfit.generated_at), 'd MMM', { locale: getDateFnsLocale(locale as AppLocale) })
      : null;

  return (
    <motion.div
      whileTap={{ scale: 0.97 }}
      transition={TAP_TRANSITION}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerLeave}
      className="w-full cursor-pointer select-none will-change-transform"
    >
      <OutfitMosaic items={outfit.outfit_items} />
      <div className="mt-2 px-0.5 flex items-center gap-1.5 min-w-0">
        <Badge variant="secondary" className="capitalize text-[10px] px-1.5 py-0 truncate max-w-[7rem]">{t(`occasion.${outfit.occasion}`)}</Badge>
        {outfit.saved && (
          <Bookmark className="w-3 h-3 fill-primary text-primary flex-shrink-0" />
        )}
        {outfit.rating && (
          <div className="flex items-center gap-0.5 text-[10px] text-muted-foreground shrink-0">
            <Star className="w-2.5 h-2.5 fill-primary text-primary" />{outfit.rating}
          </div>
        )}
      </div>
      {dateStr && (
        <div className="flex items-center gap-1 mt-0.5 px-0.5">
          {plannedFor ? (
            <Calendar className="w-2.5 h-2.5 text-muted-foreground/60" />
          ) : (
            <Clock className="w-2.5 h-2.5 text-muted-foreground/60" />
          )}
          <span className="text-[10px] text-muted-foreground/60">{dateStr}</span>
        </div>
      )}
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
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    switch (filter) {
      case 'saved': return outfits.filter(o => o.saved);
      case 'planned': return outfits.filter(o => o.planned_for && o.planned_for >= today);
      default: return outfits;
    }
  }, [outfits, filter]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="w-full aspect-square rounded-xl bg-foreground/[0.06] animate-pulse" />
            <Skeleton className="w-2/3 h-3 rounded bg-foreground/[0.06] animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  if (!outfits || outfits.length === 0) {
    return (
      <EmptyState
        icon={Sparkles}
        title="No outfits yet"
        description="Generate your first outfit and it will appear here. Every look is saved for easy access."
        action={{ label: t('outfits.create'), onClick: () => navigate('/'), icon: Sparkles }}
        variant="editorial"
      />
    );
  }

  const filters: { key: FilterTab; label: string }[] = [
    { key: 'all', label: t('wardrobe.all') },
    { key: 'saved', label: t('outfits.saved') },
    { key: 'planned', label: t('outfits.planned') },
  ];

  return (
    <>
      {/* Segmented filter pills */}
      <div className="flex gap-2 mb-4">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              'px-3.5 py-1.5 rounded-full text-[12px] font-medium transition-all duration-200',
              filter === f.key
                ? 'bg-foreground text-background'
                : 'bg-muted/30 text-muted-foreground hover:bg-muted/50'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Outfit grid */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-2 gap-3">
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
          icon={filter === 'saved' ? Star : Calendar}
          title={filter === 'saved' ? 'No saved outfits' : 'No upcoming planned outfits'}
          description={filter === 'saved' ? 'Tap the bookmark on any outfit to save it here for easy access.' : 'Plan outfits from the weekly planner to see them here.'}
          compact
          variant="editorial"
        />
      )}

      {/* Delete confirmation */}
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
