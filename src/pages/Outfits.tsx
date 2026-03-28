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
        surface="editorial"
        density={listView ? 'comfortable' : 'comfortable'}
        mediaLayout={listView ? 'featured' : 'stacked'}
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
        <section className="surface-hero rounded-[1.75rem] px-5 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="eyebrow-chip">Outfits</span>
                <span className="eyebrow-chip border-transparent bg-secondary/85 text-foreground/58">
                  {(outfits ?? []).length} looks
                </span>
              </div>
              <div className="space-y-1">
                <h1 className="text-[1.55rem] font-semibold tracking-[-0.045em]">Look archive</h1>
                <p className="max-w-[32ch] text-[0.92rem] leading-6 text-muted-foreground">
                  Keep saved formulas close, open planned looks fast, and generate a new one only when you need it.
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <Button variant="quiet" className="rounded-full px-3 text-[0.8rem]" onClick={() => navigate('/plan')}>
                Open plan
              </Button>
              <Button className="rounded-full px-4" onClick={() => navigate('/ai/generate')}>
                <Sparkles className="size-4" />
                Generate look
              </Button>
            </div>
          </div>
        </section>

        {!outfits || outfits.length === 0 ? (
          <OutfitsOnboardingEmpty />
        ) : (
          <>
            <section className="surface-utility rounded-[1.5rem] px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="app-chip-row">
                  {([
                    ['all', 'All looks'],
                    ['recent', 'Recent'],
                    ['with_notes', 'With notes'],
                  ] as const).map(([key, label]) => (
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
                    aria-label="Grid view"
                  >
                    <Grid3X3 className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setListView(true)}
                    className={listView ? 'flex h-10 w-10 items-center justify-center rounded-full bg-foreground text-background' : 'flex h-10 w-10 items-center justify-center rounded-full border border-border/55 bg-background/85 text-muted-foreground'}
                    aria-label="List view"
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
