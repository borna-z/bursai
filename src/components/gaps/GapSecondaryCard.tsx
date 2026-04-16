import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { EASE_CURVE } from '@/lib/motion';
import { hapticLight } from '@/lib/haptics';
import { cn } from '@/lib/utils';
import type { GapResult } from './gapTypes';
import { openGapSearchUrl, cssColorFromName } from './gapRouteState';

interface GapSecondaryCardProps {
  gap: GapResult;
  index: number;
}

export function GapSecondaryCard({ gap, index }: GapSecondaryCardProps) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);

  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index, 8) * 0.04, ease: EASE_CURVE }}
      className="border-t border-border/20 pt-4 mt-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[0.92rem] font-medium leading-tight text-foreground">{gap.item}</p>
          <p className="mt-1 line-clamp-2 text-[0.78rem] leading-5 text-foreground/60">{gap.reason}</p>
        </div>
        <div className="shrink-0 text-right">
          <span className="font-display italic text-[1.1rem] text-accent">+{gap.new_outfits}</span>
          <p className="text-[0.58rem] uppercase tracking-[0.12em] text-muted-foreground/70">{t('gaps.outfits_short') || 'outfits'}</p>
        </div>
      </div>

      <div className="mt-2 flex items-center gap-2 text-[0.72rem] text-muted-foreground">
        <span className="rounded-full border border-border/40 bg-background/60 px-2.5 py-0.5">{gap.category}</span>
        <span aria-hidden className="h-2 w-2 rounded-full border border-border/60" style={{ backgroundColor: cssColorFromName(gap.color) }} />
        <span>{gap.color}</span>
        <span className="text-muted-foreground/50">·</span>
        <span>{gap.price_range}</span>
      </div>

      <div className="mt-2.5 flex items-center justify-between">
        {gap.key_insight ? (
          <button
            type="button"
            onClick={() => { hapticLight(); setOpen((v) => !v); }}
            className="inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-accent/70"
          >
            {t('gaps.why_this') || 'Why this?'}
            <ChevronDown className={cn('h-3 w-3 transition-transform', open ? 'rotate-180' : '')} />
          </button>
        ) : <span />}
        <Button onClick={() => openGapSearchUrl(gap.search_query)} variant="outline" size="sm" className="rounded-full px-3.5">
          <ExternalLink className="mr-1 h-3.5 w-3.5" />
          {t('gaps.find_this') || 'Find this'}
        </Button>
      </div>

      {gap.key_insight ? (
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
      ) : null}
    </motion.article>
  );
}
