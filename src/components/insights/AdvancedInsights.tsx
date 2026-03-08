import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Sparkles, Puzzle, ShoppingBag, Leaf, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LazyImageSimple } from '@/components/ui/lazy-image';
import { useWardrobeGapAnalysis, useSustainabilityScore, useStyleEvolution } from '@/hooks/useAdvancedFeatures';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

/* ── Step 21: Wardrobe Gap Analysis ── */
export function WardrobeGapSection({ isPremium }: { isPremium: boolean }) {
  const { t } = useLanguage();
  const gapAnalysis = useWardrobeGapAnalysis();
  const [gaps, setGaps] = useState<Array<{ item: string; category: string; reason: string; new_outfits: number }> | null>(null);

  const handleAnalyze = async () => {
    try {
      const result = await gapAnalysis.mutateAsync();
      setGaps(result.gaps);
    } catch {
      toast.error(t('insights.gap_error'));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Puzzle className="w-4 h-4 text-muted-foreground/50" />
        <span className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wider">
          {t('insights.gap_title')}
        </span>
      </div>
      <div className={cn(!isPremium && "relative")}>
        <div className={cn(!isPremium && "blur-sm select-none")}>
          {!gaps && (
            <Button
              variant="outline"
              size="sm"
              className="w-full rounded-xl"
              onClick={handleAnalyze}
              disabled={gapAnalysis.isPending}
            >
              {gapAnalysis.isPending ? (
                <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />{t('insights.analyzing')}</>
              ) : (
                <><Sparkles className="w-3.5 h-3.5 mr-1.5" />{t('insights.analyze_gaps')}</>
              )}
            </Button>
          )}
          {gaps && gaps.map((gap, i) => (
            <div key={i} className="flex items-start gap-3 py-3 border-b border-border/10 last:border-0">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <ShoppingBag className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{gap.item}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{gap.reason}</p>
                <p className="text-[11px] text-primary mt-1 font-medium">
                  +{gap.new_outfits} {t('insights.new_outfits')}
                </p>
              </div>
            </div>
          ))}
        </div>
        {!isPremium && (
          <div className="absolute inset-0 flex items-center justify-center">
            <ShoppingBag className="w-5 h-5 text-muted-foreground/40" />
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Step 23: Sustainability Score ── */
export function SustainabilitySection({ isPremium }: { isPremium: boolean }) {
  const { t } = useLanguage();
  const { data: sustainability } = useSustainabilityScore();

  if (!sustainability) return null;

  const scoreColor = sustainability.score >= 70 ? 'text-green-500' : sustainability.score >= 40 ? 'text-primary' : 'text-orange-500';

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Leaf className="w-4 h-4 text-muted-foreground/50" />
        <span className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wider">
          {t('insights.sustainability')}
        </span>
      </div>
      <div className={cn(!isPremium && "relative")}>
        <div className={cn(!isPremium && "blur-sm select-none")}>
          <div className="text-center py-4">
            <span className={cn("text-5xl font-bold tabular-nums", scoreColor)}>{sustainability.score}</span>
            <span className="text-lg text-muted-foreground/60">/100</span>
            <p className="text-xs text-muted-foreground mt-2">{t('insights.sustainability_desc')}</p>
          </div>
          <div className="grid grid-cols-3 gap-3 mt-4">
            <div className="rounded-xl bg-muted/40 p-3 text-center">
              <span className="text-lg font-bold tabular-nums">{sustainability.utilizationRate}%</span>
              <p className="text-[10px] text-muted-foreground/60 mt-0.5">{t('insights.utilization')}</p>
            </div>
            <div className="rounded-xl bg-muted/40 p-3 text-center">
              <span className="text-lg font-bold tabular-nums">{sustainability.avgWearCount}×</span>
              <p className="text-[10px] text-muted-foreground/60 mt-0.5">{t('insights.avg_wears')}</p>
            </div>
            <div className="rounded-xl bg-muted/40 p-3 text-center">
              <span className="text-lg font-bold tabular-nums">{sustainability.underusedCount}</span>
              <p className="text-[10px] text-muted-foreground/60 mt-0.5">{t('insights.underused')}</p>
            </div>
          </div>
        </div>
        {!isPremium && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Leaf className="w-5 h-5 text-muted-foreground/40" />
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Step 24: Style Evolution Timeline ── */
export function StyleEvolutionSection({ isPremium }: { isPremium: boolean }) {
  const { t } = useLanguage();
  const { data: evolution } = useStyleEvolution();

  if (!evolution || !evolution.timeline || evolution.timeline.length < 2) return null;

  const COLOR_CSS: Record<string, string> = {
    svart: 'bg-gray-900', black: 'bg-gray-900', vit: 'bg-gray-100', white: 'bg-gray-100',
    grå: 'bg-gray-400', marinblå: 'bg-blue-900', navy: 'bg-blue-900',
    blå: 'bg-blue-500', blue: 'bg-blue-500', röd: 'bg-red-500', red: 'bg-red-500',
    grön: 'bg-green-600', green: 'bg-green-600', beige: 'bg-amber-100',
    brun: 'bg-amber-800', brown: 'bg-amber-800', rosa: 'bg-pink-400', pink: 'bg-pink-400',
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-muted-foreground/50" />
        <span className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wider">
          {t('insights.evolution')}
        </span>
      </div>
      <div className={cn(!isPremium && "relative")}>
        <div className={cn(!isPremium && "blur-sm select-none")}>
          <div className="space-y-2">
            {evolution.timeline.map((month, i) => (
              <motion.div
                key={month.month}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className="flex items-center gap-3 py-2"
              >
                <span className="text-xs text-muted-foreground/50 w-14 flex-shrink-0 tabular-nums">
                  {month.month.substring(5)}
                </span>
                <div className={cn("w-4 h-4 rounded-full flex-shrink-0", COLOR_CSS[month.topColor] || 'bg-muted')} />
                <div className="flex-1">
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${Math.min(month.avgFormality * 20, 100)}%` }}
                    />
                  </div>
                </div>
                <span className="text-[10px] text-muted-foreground/40 tabular-nums w-8 text-right">{month.outfitCount}×</span>
              </motion.div>
            ))}
          </div>
          <div className="flex items-center justify-between mt-3 text-[10px] text-muted-foreground/40">
            <span>{t('insights.casual')}</span>
            <span>{t('insights.formal')}</span>
          </div>
        </div>
        {!isPremium && (
          <div className="absolute inset-0 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-muted-foreground/40" />
          </div>
        )}
      </div>
    </div>
  );
}
