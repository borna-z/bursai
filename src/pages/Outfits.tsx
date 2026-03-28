import { useMemo, useState } from 'react';
import { Grid3X3, List, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

import { AppLayout } from '@/components/layout/AppLayout';
import { BursLoadingScreen } from '@/components/layout/BursLoadingScreen';
import { OutfitsOnboardingEmpty } from '@/components/onboarding/OnboardingEmptyState';
import { OutfitPreviewCard } from '@/components/ui/OutfitPreviewCard';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { useOutfits, type OutfitWithItems } from '@/hooks/useOutfits';
import { TAP_TRANSITION } from '@/lib/motion';

type FilterMode = 'all' | 'recent' | 'with_notes';

function OutfitCard({
  outfit,
  listView,
}: {
  outfit: OutfitWithItems;
  listView: boolean;
}) {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const occasionLabel = t(`occasion.${outfit.occasion}`) || outfit.occasion || '';
  const excerpt = outfit.explanation
    ? outfit.explanation.length > 84
      ? `${outfit.explanation.slice(0, 84)}...`
      : outfit.explanation
    : '';

  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.97 }}
      transition={TAP_TRANSITION}
      onClick={() => navigate(`/outfits/${outfit.id}`)}
      className="w-full cursor-pointer select-none text-left will-change-transform"
    >
      <OutfitPreviewCard
        items={outfit.outfit_items}
        surface="default"
        density={listView ? 'comfortable' : 'comfortable'}
        mediaLayout={listView ? 'portrait' : 'square'}
        meta={occasionLabel ? (
          <p className="font-['DM_Sans'] text-[10px] uppercase tracking-[0.1em] text-foreground/50">
            {occasionLabel}
          </p>
        ) : undefined}
        excerpt={excerpt}
      />
    </motion.button>
  );
}

export default function OutfitsPage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { data: outfits, isLoading } = useOutfits(true);
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [listView, setListView] = useState(false);

  const filteredOutfits = useMemo(() => {
    const base = outfits ?? [];
    const sorted = [...base].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));

    if (filterMode === 'with_notes') {
      return sorted.filter((outfit) => Boolean(outfit.explanation));
    }

    if (filterMode === 'recent') {
      return sorted.slice(0, 8);
    }

    return sorted;
  }, [filterMode, outfits]);

  if (isLoading) {
    return <BursLoadingScreen />;
  }

  return (
    <AppLayout>
      <div className="page-shell space-y-5">
        <motion.header className="topbar-frost sticky top-0 z-10 -mx-5 px-5 pb-3 pt-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="caption-upper mb-0.5">{t('outfits.saved_looks')}</p>
              <h1 className="font-['Playfair_Display'] italic text-[1.55rem] leading-tight">
                {t('outfits.title')}
              </h1>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button variant="quiet" className="rounded-full px-3 text-[0.8rem]" onClick={() => navigate('/plan')}>
                {t('outfits.open_plan')}
              </Button>
              <Button className="rounded-full px-4" onClick={() => navigate('/ai/generate')}>
                <Sparkles className="size-4" />
                {t('outfits.generate_look')}
              </Button>
            </div>
          </div>
        </motion.header>

        {!outfits || outfits.length === 0 ? (
          <OutfitsOnboardingEmpty />
        ) : (
          <>
            <section className="surface-utility rounded-[1.25rem] px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="app-chip-row">
                  {([
                    ['all', t('outfits.filter_all')],
                    ['recent', t('outfits.filter_recent')],
                    ['with_notes', t('outfits.filter_with_notes')],
                  ] as [FilterMode, string][]).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setFilterMode(key)}
                      className={filterMode === key
                        ? 'rounded-full bg-foreground px-3 py-2 text-[0.72rem] font-medium uppercase tracking-[0.14em] text-background'
                        : 'rounded-full border border-border/55 bg-background/85 px-3 py-2 text-[0.72rem] font-medium uppercase tracking-[0.14em] text-muted-foreground'}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setListView(false)}
                    className={listView ? 'flex h-10 w-10 items-center justify-center rounded-full border border-border/55 bg-background/85 text-muted-foreground' : 'flex h-10 w-10 items-center justify-center rounded-full bg-foreground text-background'}
                    aria-label={t('outfits.grid_view')}
                  >
                    <Grid3X3 className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setListView(true)}
                    className={listView ? 'flex h-10 w-10 items-center justify-center rounded-full bg-foreground text-background' : 'flex h-10 w-10 items-center justify-center rounded-full border border-border/55 bg-background/85 text-muted-foreground'}
                    aria-label={t('outfits.list_view')}
                  >
                    <List className="size-4" />
                  </button>
                </div>
              </div>
            </section>

            <div className={listView ? 'grid gap-4' : 'grid grid-cols-2 gap-3 sm:gap-4'}>
              {filteredOutfits.map((outfit, index) => (
                <div
                  key={outfit.id}
                  className="animate-drape-in"
                  style={{
                    animationDelay: `${Math.min(index, 12) * 40}ms`,
                    animationFillMode: 'both',
                  }}
                >
                  <OutfitCard outfit={outfit} listView={listView} />
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
