import { motion } from 'framer-motion';
import { ExternalLink, Search, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LazyImageSimple } from '@/components/ui/lazy-image';
import { useLanguage } from '@/contexts/LanguageContext';
import { getPreferredGarmentImagePath } from '@/lib/garmentImage';
import { EASE_CURVE } from '@/lib/motion';
import type { GapResult } from './gapTypes';
import type { GarmentBasic } from '@/hooks/useGarmentsByIds';

interface GapHeroCardProps {
  gap: GapResult;
  garmentMap: Map<string, GarmentBasic>;
}

function openGoogle(query: string) {
  window.open(
    `https://www.google.com/search?q=${encodeURIComponent(query)}`,
    '_blank',
    'noopener',
  );
}

export function GapHeroCard({ gap, garmentMap }: GapHeroCardProps) {
  const { t } = useLanguage();
  const pairingGarments = (gap.pairing_garment_ids ?? [])
    .map((id) => garmentMap.get(id))
    .filter((g): g is GarmentBasic => !!g)
    .slice(0, 3);

  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: EASE_CURVE }}
      className="relative overflow-hidden rounded-[1.25rem] border border-border/40 bg-card p-5"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(70% 50% at 100% 0%, hsl(37 47% 46% / 0.12), transparent 60%)',
        }}
      />

      <div className="relative">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-accent/70">
          {t('gaps.hero_eyebrow') || 'Your next best purchase'}
        </p>

        <h3 className="mt-3 font-display italic text-[1.4rem] leading-tight tracking-[-0.02em] text-foreground">
          {gap.item}
        </h3>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-[0.78rem] text-muted-foreground">
          <span className="rounded-full border border-border/40 bg-background/60 px-3 py-1">
            {gap.category}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-background/60 px-3 py-1">
            <span
              aria-hidden
              className="h-2 w-2 rounded-full border border-border/60"
              style={{ backgroundColor: gap.color }}
            />
            {gap.color}
          </span>
        </div>

        {pairingGarments.length > 0 ? (
          <div className="mt-5">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">
              {t('gaps.pairs_with') || 'Pairs with'}
            </p>
            <div className="mt-2 flex items-center gap-2">
              {pairingGarments.map((g) => (
                <div
                  key={g.id}
                  className="relative h-16 w-16 overflow-hidden rounded-[0.9rem] border border-border/40 bg-muted/30"
                >
                  <LazyImageSimple
                    imagePath={getPreferredGarmentImagePath(g)}
                    alt={g.title}
                    className="h-full w-full object-cover"
                  />
                </div>
              ))}
              <div className="flex h-16 w-16 items-center justify-center rounded-[0.9rem] border border-dashed border-accent/50 bg-accent/5 text-accent/70">
                <Sparkles className="h-4 w-4" />
              </div>
            </div>
          </div>
        ) : null}

        <div className="mt-5 flex items-baseline gap-2">
          <span className="font-display italic text-[1.8rem] leading-none text-accent">
            +{gap.new_outfits}
          </span>
          <span className="text-[0.82rem] text-muted-foreground">
            {t('gaps.new_outfits') || 'new outfit combinations'}
          </span>
        </div>

        {gap.key_insight ? (
          <p className="mt-4 max-w-[32rem] font-display italic text-[13px] leading-6 text-foreground/55">
            {gap.key_insight}
          </p>
        ) : (
          <p className="mt-4 max-w-[32rem] text-[0.9rem] leading-6 text-muted-foreground">
            {gap.reason}
          </p>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-2.5">
          <span className="rounded-full border border-border/40 bg-background/60 px-3 py-1.5 text-[0.78rem] text-muted-foreground">
            {gap.price_range}
          </span>
          <Button
            onClick={() => openGoogle(gap.search_query)}
            className="ml-auto rounded-full px-5"
          >
            <Search className="mr-1.5 h-4 w-4" />
            {t('gaps.find_this') || 'Find this'}
            <ExternalLink className="ml-1.5 h-3.5 w-3.5" aria-hidden />
          </Button>
        </div>
      </div>
    </motion.article>
  );
}
