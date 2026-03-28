import { motion } from 'framer-motion';
import { ExternalLink, RefreshCw, Search, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StaleIndicator } from '@/components/ui/StaleIndicator';
import { EASE_CURVE, STAGGER_DELAY } from '@/lib/motion';
import type { GapResult } from '@/components/gaps/gapTypes';

function openGoogle(query: string) {
  window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, '_blank', 'noopener');
}

export function GapResultsPanel({
  analyzedAt,
  hasRefreshError,
  onRefresh,
  results,
}: {
  analyzedAt: string | null;
  hasRefreshError?: boolean;
  onRefresh: () => void;
  results: GapResult[];
}) {
  const [featured, ...rest] = results;

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: EASE_CURVE }}
      className="space-y-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[0.72rem] uppercase tracking-[0.22em] text-muted-foreground/65">
            Results
          </p>
          <h2 className="mt-1 text-[1.3rem] font-semibold tracking-[-0.04em] text-foreground">
            Highest-impact additions first
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StaleIndicator updatedAt={analyzedAt} />
          <Button onClick={onRefresh} variant="outline" className="rounded-full px-4">
            <RefreshCw className="size-4" />
            Refresh scan
          </Button>
        </div>
      </div>

      {hasRefreshError ? (
        <div className="rounded-[1.2rem] border border-destructive/20 bg-destructive/5 px-4 py-3 text-[0.88rem] text-foreground">
          The latest refresh did not finish. Showing your last successful gap scan.
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.95fr)]">
        <motion.article
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: EASE_CURVE }}
          className="relative overflow-hidden rounded-[1.8rem] border border-foreground/[0.08] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,244,238,0.92))] p-5 shadow-[0_20px_48px_rgba(23,18,14,0.05)]"
        >
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-foreground/15 to-transparent" />
          <p className="text-[0.72rem] uppercase tracking-[0.22em] text-muted-foreground/65">
            Best next buy
          </p>
          <h3 className="mt-3 text-[1.65rem] font-semibold tracking-[-0.055em] text-foreground">
            {featured.item}
          </h3>
          <p className="mt-2 text-[0.92rem] text-muted-foreground">
            {featured.color} / {featured.category}
          </p>
          <div className="mt-5 flex items-end gap-3">
            <span className="text-[2.4rem] font-semibold leading-none tracking-[-0.07em] text-foreground">
              +{featured.new_outfits}
            </span>
            <span className="pb-1 text-[0.86rem] text-muted-foreground">
              new outfits unlocked
            </span>
          </div>
          <p className="mt-5 max-w-[32rem] text-[0.95rem] leading-6 text-foreground/85">
            {featured.reason}
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-2 text-[0.78rem] text-muted-foreground">
            <span className="rounded-full border border-foreground/[0.08] bg-background/70 px-3 py-1.5">
              {featured.price_range}
            </span>
            <span className="rounded-full border border-foreground/[0.08] bg-background/70 px-3 py-1.5">
              Highest wardrobe lift
            </span>
          </div>

          <div className="mt-6 flex flex-wrap gap-2.5">
            <Button onClick={() => openGoogle(featured.search_query)} className="rounded-full px-5">
              <Search className="size-4" />
              Search this piece
            </Button>
            <Button
              onClick={() => openGoogle(featured.search_query)}
              variant="outline"
              className="rounded-full px-5"
            >
              <ExternalLink className="size-4" />
              Open Google
            </Button>
          </div>
        </motion.article>

        <div className="space-y-3">
          <div className="rounded-[1.5rem] border border-foreground/[0.08] bg-card/90 p-4">
            <div className="flex items-center gap-2 text-[0.72rem] uppercase tracking-[0.22em] text-muted-foreground/65">
              <Sparkles className="size-3.5" />
              More additions
            </div>
            <p className="mt-2 text-[0.9rem] leading-6 text-muted-foreground">
              These are the next strongest upgrades once the featured gap is covered.
            </p>
          </div>

          {rest.map((gap, index) => (
            <motion.article
              key={gap.search_query}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: (index + 1) * STAGGER_DELAY, duration: 0.35, ease: EASE_CURVE }}
              className="rounded-[1.5rem] border border-foreground/[0.08] bg-card/92 p-4 shadow-[0_12px_30px_rgba(18,18,18,0.04)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-[1rem] font-semibold tracking-[-0.03em] text-foreground">
                    {gap.item}
                  </h3>
                  <p className="mt-1 text-[0.82rem] text-muted-foreground">
                    {gap.color} / {gap.category}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-[1.2rem] font-semibold tracking-[-0.05em] text-foreground">
                    +{gap.new_outfits}
                  </div>
                  <div className="text-[0.72rem] text-muted-foreground">looks</div>
                </div>
              </div>

              <p className="mt-3 text-[0.88rem] leading-6 text-muted-foreground">
                {gap.reason}
              </p>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[0.8rem] text-muted-foreground">{gap.price_range}</span>
                <Button
                  onClick={() => openGoogle(gap.search_query)}
                  variant="outline"
                  size="sm"
                  className="rounded-full px-3.5"
                >
                  <ExternalLink className="size-3.5" />
                  Search
                </Button>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </motion.section>
  );
}
