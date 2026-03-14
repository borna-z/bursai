import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, ExternalLink, Sparkles, ShoppingBag, AlertCircle } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useGarmentCount } from '@/hooks/useGarments';
import { useWardrobeGapAnalysis } from '@/hooks/useAdvancedFeatures';
import { useAuth } from '@/contexts/AuthContext';
import { useWardrobeUnlocks } from '@/hooks/useWardrobeUnlocks';
import { WardrobeProgress } from '@/components/discover/WardrobeProgress';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EASE_CURVE, STAGGER_DELAY } from '@/lib/motion';
import { hapticSuccess } from '@/lib/haptics';
import { cn } from '@/lib/utils';

interface GapResult {
  item: string;
  category: string;
  color: string;
  reason: string;
  new_outfits: number;
  price_range: string;
  search_query: string;
}

function GapScanningAnimation({ t }: { t: (key: string) => string }) {
  const [phase, setPhase] = useState(0);
  const phases = [
    t('discover.gap_phase_1'),
    t('discover.gap_phase_2'),
    t('discover.gap_phase_3'),
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setPhase(p => (p + 1) % 3);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="rounded-xl border border-border/10 bg-card/60 p-6 space-y-5">
      {/* Radar pulse */}
      <div className="flex flex-col items-center gap-4">
        <div className="relative w-16 h-16 flex items-center justify-center">
          {/* Concentric rings */}
          {[0, 1, 2].map(i => (
            <motion.div
              key={i}
              className="absolute inset-0 rounded-full border border-primary/30"
              animate={{
                scale: [1, 1.8 + i * 0.4],
                opacity: [0.5, 0],
              }}
              transition={{
                duration: 2.2,
                repeat: Infinity,
                delay: i * 0.6,
                ease: 'easeOut',
              }}
            />
          ))}
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center z-10"
          >
            <Sparkles className="w-5 h-5 text-primary" />
          </motion.div>
        </div>

        {/* Phase text */}
        <div className="h-5 relative">
          <AnimatePresence mode="wait">
            <motion.p
              key={phase}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.3, ease: EASE_CURVE }}
              className="text-[12px] text-muted-foreground font-medium"
            >
              {phases[phase]}
            </motion.p>
          </AnimatePresence>
        </div>

        {/* Bouncing dots */}
        <div className="flex gap-1.5">
          {[0, 1, 2].map(i => (
            <motion.span
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-primary/40"
              animate={{ y: [0, -5, 0] }}
              transition={{
                duration: 0.6,
                repeat: Infinity,
                delay: i * 0.15,
                ease: 'easeInOut',
              }}
            />
          ))}
        </div>
      </div>

      {/* Staggered skeleton cards */}
      <div className="space-y-2.5">
        {[0, 1, 2].map(i => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 + i * 0.15, duration: 0.4, ease: EASE_CURVE }}
          >
            <Skeleton className="h-24 w-full rounded-lg" />
          </motion.div>
        ))}
      </div>
    </div>
  );
}

export function WardrobeGapSection() {
  const { t, locale } = useLanguage();
  const { user } = useAuth();
  const { data: garmentCount } = useGarmentCount();
  const { isUnlocked } = useWardrobeUnlocks();
  const gapAnalysis = useWardrobeGapAnalysis();
  const [results, setResults] = useState<GapResult[] | null>(null);

  const count = garmentCount || 0;
  const notEnough = count < 5;

  if (!isUnlocked('gap_analysis')) {
    return (
      <section className="space-y-3">
        <WardrobeProgress message={t('unlock.gap_analysis_message')} compact />
      </section>
    );
  }

  const handleScan = async () => {
    if (!user || notEnough) return;
    hapticSuccess();
    try {
      const data = await gapAnalysis.mutateAsync({ locale });
      setResults(data?.gaps || []);
    } catch {
      // error handled by mutation state
    }
  };

  const openGoogle = (query: string) => {
    window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, '_blank', 'noopener');
  };

  return (
    <section className="space-y-3">
      {results && results.length > 0 && (
        <div className="flex justify-end">
          <button
            onClick={() => { setResults(null); }}
            className="text-[11px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
          >
            {t('discover.gap_reset')}
          </button>
        </div>
      )}

      {/* Not scanned yet — show CTA */}
      {!results && !gapAnalysis.isPending && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: EASE_CURVE }}
          className="rounded-xl border border-border/10 bg-card/60 p-5 space-y-3"
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10 shrink-0">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div className="space-y-1">
              <h4 className="text-[13px] font-medium text-foreground leading-tight">
                {t('discover.gap_title')}
              </h4>
              <p className="text-[11px] text-muted-foreground/60 leading-snug">
                {notEnough ? t('discover.gap_need_more') : t('discover.gap_description')}
              </p>
            </div>
          </div>
          <Button
            onClick={handleScan}
            disabled={notEnough || !user}
            size="sm"
            className="w-full"
          >
            <Search className="w-4 h-4" />
            {t('discover.gap_scan')}
          </Button>
        </motion.div>
      )}

      {/* Loading — animated scanning state */}
      {gapAnalysis.isPending && <GapScanningAnimation t={t} />}

      {/* Error */}
      {gapAnalysis.isError && !results && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 flex items-start gap-3"
        >
          <AlertCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
          <div className="space-y-1">
            <p className="text-[12px] text-foreground font-medium">{t('discover.gap_error')}</p>
            <Button variant="ghost" size="sm" onClick={handleScan} className="h-7 text-[11px]">
              {t('discover.gap_retry')}
            </Button>
          </div>
        </motion.div>
      )}

      {/* Results */}
      <AnimatePresence>
        {results && results.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-2.5"
          >
            {results.map((gap, i) => (
              <motion.div
                key={gap.search_query}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * STAGGER_DELAY, duration: 0.4, ease: EASE_CURVE }}
                className="rounded-xl border border-border/10 bg-card/60 p-4 space-y-3"
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1 min-w-0">
                    <h4 className="text-[13px] font-semibold text-foreground leading-tight truncate">
                      {gap.item}
                    </h4>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] text-muted-foreground/60 capitalize">{gap.category}</span>
                      <span className="text-[10px] text-muted-foreground/50">·</span>
                      <span className="text-[10px] text-muted-foreground/60">{gap.color}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-[18px] font-bold text-primary leading-none">+{gap.new_outfits}</span>
                    <p className="text-[9px] text-muted-foreground/50 mt-0.5">{t('discover.gap_outfits')}</p>
                  </div>
                </div>

                {/* Reason */}
                <p className="text-[11px] text-muted-foreground/70 leading-relaxed">
                  {gap.reason}
                </p>

                {/* Footer */}
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] text-muted-foreground/50">{gap.price_range}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openGoogle(gap.search_query)}
                    className="h-8 text-[11px] gap-1.5"
                  >
                    <ExternalLink className="w-3 h-3" />
                    {t('discover.gap_search_google')}
                  </Button>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* No gaps found */}
      {results && results.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="rounded-xl border border-border/10 bg-card/60 p-5 text-center space-y-2"
        >
          <ShoppingBag className="w-6 h-6 text-muted-foreground/40 mx-auto" />
          <p className="text-[12px] text-muted-foreground/60">{t('discover.gap_complete')}</p>
        </motion.div>
      )}
    </section>
  );
}
