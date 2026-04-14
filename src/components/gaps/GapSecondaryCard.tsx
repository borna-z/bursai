import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { EASE_CURVE } from '@/lib/motion';
import { hapticLight } from '@/lib/haptics';
import { cn } from '@/lib/utils';
import type { GapResult } from './gapTypes';

interface GapSecondaryCardProps {
  gap: GapResult;
  index?: number;
}

function openGoogle(query: string) {
  window.open(
    `https://www.google.com/search?q=${encodeURIComponent(query)}`,
    '_blank',
    'noopener',
  );
}

export function GapSecondaryCard({ gap, index = 0 }: GapSecondaryCardProps) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);

  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.04, ease: EASE_CURVE }}
      className="flex w-[280px] shrink-0 snap-start flex-col gap-3 rounded-[1.25rem] border border-border/40 bg-card p-4"
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-[15px] font-medium leading-tight text-foreground">
          {gap.item}
        </h4>
        <div className="text-right">
          <span className="font-display italic text-[1.1rem] text-accent">
            +{gap.new_outfits}
          </span>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground/70">
            {t('gaps.outfits_short') || 'outfits'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 text-[0.72rem] text-muted-foreground">
        <span className="rounded-full border border-border/40 bg-background/60 px-2.5 py-0.5">
          {gap.category}
        </span>
        <span
          aria-hidden
          className="h-2 w-2 rounded-full border border-border/60"
          style={{ backgroundColor: gap.color }}
        />
        <span>{gap.color}</span>
      </div>

      <p className="line-clamp-2 text-[13px] leading-5 text-foreground/60">
        {gap.reason}
      </p>

      {gap.key_insight ? (
        <div>
          <button
            type="button"
            onClick={() => {
              hapticLight();
              setOpen((v) => !v);
            }}
            className="inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-accent/70"
          >
            {t('gaps.why_this') || 'Why this?'}
            <ChevronDown
              className={cn(
                'h-3 w-3 transition-transform',
                open ? 'rotate-180' : '',
              )}
            />
          </button>
          <AnimatePresence initial={false}>
            {open ? (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2, ease: EASE_CURVE }}
                className="mt-2 font-display italic text-[12px] leading-5 text-foreground/70"
              >
                {gap.key_insight}
              </motion.p>
            ) : null}
          </AnimatePresence>
        </div>
      ) : null}

      <div className="mt-auto flex items-center justify-between gap-2 pt-1">
        <span className="text-[0.72rem] text-muted-foreground">{gap.price_range}</span>
        <Button
          onClick={() => openGoogle(gap.search_query)}
          variant="outline"
          size="sm"
          className="rounded-full px-3.5"
        >
          <ExternalLink className="mr-1 h-3.5 w-3.5" />
          {t('gaps.find_this') || 'Find this'}
        </Button>
      </div>
    </motion.article>
  );
}
