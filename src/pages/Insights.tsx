import { useMemo, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Shirt, Sparkles, Lock, Palette, Trophy, Leaf } from 'lucide-react';

import { SmartInsightCard } from '@/components/home/SmartInsightCard';
import { hapticLight } from '@/lib/haptics';
import { InsightsPageSkeleton } from '@/components/ui/skeletons';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useInsights, type Garment } from '@/hooks/useInsights';
import { useSubscription } from '@/hooks/useSubscription';
import { useSustainabilityScore } from '@/hooks/useAdvancedFeatures';
import { AppLayout } from '@/components/layout/AppLayout';
import { PullToRefresh } from '@/components/layout/PullToRefresh';
import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState } from '@/components/layout/EmptyState';
import { ColorBar } from '@/components/insights/MiniBar';
import { LazyImageSimple } from '@/components/ui/lazy-image';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { motion } from 'framer-motion';
import { AnimatedPage } from '@/components/ui/animated-page';

/* ─── Animated ring ─── */
function UsageRing({ value, size = 140 }: { value: number; size?: number }) {
  const stroke = 6;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  const color = value >= 50 ? 'hsl(var(--success))' : value >= 25 ? 'hsl(var(--primary))' : 'hsl(var(--warning))';

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="hsl(var(--muted))" strokeWidth={stroke} />
      <motion.circle
        cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color}
        strokeWidth={stroke} strokeLinecap="round" strokeDasharray={circumference}
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 1.2, ease: [0.25, 0.1, 0.25, 1], delay: 0.3 }}
      />
    </svg>
  );
}

/* ─── Stat pill ─── */
function StatPill({ value, label, onClick }: { value: number | string; label: string; onClick?: () => void }) {
  return (
    <button
      onClick={() => { if (onClick) { hapticLight(); onClick(); } }}
      className={cn(
        "flex flex-col items-center gap-1 flex-1 py-3 rounded-xl transition-colors",
        onClick && "cursor-pointer active:scale-95 hover:bg-foreground/[0.04]"
      )}
    >
      <span className="text-2xl font-bold tracking-tight tabular-nums">{value}</span>
      <span className="text-[10px] text-muted-foreground/70 uppercase tracking-wider">{label}</span>
    </button>
  );
}

/* ─── Section label ─── */
function SectionLabel({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="w-4 h-4 text-muted-foreground/50" />
      <span className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wider">{label}</span>
    </div>
  );
}

/* ─── Color map ─── */
const COLOR_MAP: Record<string, string> = {
  black: 'bg-gray-900', white: 'bg-gray-100', grey: 'bg-gray-400', navy: 'bg-blue-900',
  blue: 'bg-blue-500', red: 'bg-red-500', green: 'bg-green-600', beige: 'bg-amber-100',
  brown: 'bg-amber-800', pink: 'bg-pink-400', purple: 'bg-purple-500', yellow: 'bg-yellow-400', orange: 'bg-orange-500',
  // Legacy Swedish keys for backward compat with existing DB data
  svart: 'bg-gray-900', vit: 'bg-gray-100', grå: 'bg-gray-400', marinblå: 'bg-blue-900',
  blå: 'bg-blue-500', röd: 'bg-red-500', grön: 'bg-green-600',
  brun: 'bg-amber-800', rosa: 'bg-pink-400', lila: 'bg-purple-500', gul: 'bg-yellow-400',
};

const COLOR_I18N: Record<string, string> = {
  black: 'color.black', white: 'color.white', grey: 'color.grey', navy: 'color.navy',
  blue: 'color.blue', red: 'color.red', green: 'color.green', beige: 'color.beige',
  brown: 'color.brown', pink: 'color.pink', yellow: 'color.yellow', orange: 'color.orange', purple: 'color.purple',
  // Legacy Swedish keys
  svart: 'color.black', vit: 'color.white', grå: 'color.grey', marinblå: 'color.navy',
  blå: 'color.blue', röd: 'color.red', grön: 'color.green',
  brun: 'color.brown', rosa: 'color.pink', gul: 'color.yellow', lila: 'color.purple',
};

/* ─── Main page ─── */
export default function InsightsPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { data: insights, isLoading } = useInsights();
  const { isPremium, isLoading: subLoading } = useSubscription();
  const { data: sustainability } = useSustainabilityScore();

  const handleRefresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['insights'] });
  }, [queryClient]);

  /* ── Color data ── */
  const colorData = useMemo(() => {
    if (!insights) return { bars: [], entries: [], total: 0 };
    const allGarments = [...insights.topFiveWorn, ...insights.unusedGarments];
    const counts: Record<string, number> = {};
    allGarments.forEach(g => { const c = g.color_primary?.toLowerCase() || 'unknown'; counts[c] = (counts[c] || 0) + 1; });
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6);
    return {
      bars: sorted.map(([color, count]) => ({ color, count, colorClass: COLOR_MAP[color] || 'bg-muted' })),
      entries: sorted,
      total: allGarments.length,
    };
  }, [insights]);

  if (isLoading || subLoading) {
    return (
      <AppLayout>
        <PageHeader title={t('insights.title')} />
        <InsightsPageSkeleton />
      </AppLayout>
    );
  }

  if (!insights || insights.totalGarments === 0) {
    return (
      <AppLayout>
        <PageHeader title={t('insights.title')} />
        <EmptyState
          icon={Sparkles}
          title={t('insights.no_insights')}
          description={t('insights.add_garments')}
          action={{ label: t('wardrobe.add'), onClick: () => navigate('/wardrobe/add'), icon: Shirt }}
        />
      </AppLayout>
    );
  }

  const sustainScore = sustainability?.score;
  const sustainColor = sustainScore != null
    ? (sustainScore >= 70 ? 'text-green-500' : sustainScore >= 40 ? 'text-primary' : 'text-orange-500')
    : '';

  return (
    <AppLayout>
      <PageHeader title={t('insights.title')} />
      <PullToRefresh onRefresh={handleRefresh}>
        <AnimatedPage className="max-w-lg mx-auto px-4 pb-8 pt-6 space-y-10">

          {/* ─── 0. Wardrobe Usage Banner + Smart Insight ─── */}

          {/* ─── 1. Usage Ring + Stats ─── */}
          <div className="flex flex-col items-center">
            <div className="relative">
              <UsageRing value={insights.usageRate} size={140} />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl font-bold tracking-tight tabular-nums">{insights.usageRate}</span>
                <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">%</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-3">{t('insights.last_30d')}</p>

            <div className="flex items-center w-full mt-8">
              <StatPill value={insights.totalGarments} label={t('insights.total')} onClick={() => navigate('/wardrobe')} />
              <div className="w-px h-8 bg-border/20" />
              <StatPill value={insights.garmentsUsedLast30Days} label={t('insights.used_30d')} onClick={() => navigate('/wardrobe/used')} />
              <div className="w-px h-8 bg-border/20" />
              <StatPill value={insights.unusedGarments.length} label={t('insights.unused')} onClick={() => navigate('/outfits/unused')} />
            </div>
          </div>

          {/* ─── 2. Top 5 Garments (horizontal scroll) ─── */}
          {insights.topFiveWorn.length > 0 && (
            <div className="space-y-3">
              <SectionLabel icon={Trophy} label={t('insights.top_garments')} />
              <div className="flex gap-3 overflow-x-auto scrollbar-hide -mx-4 px-4">
                {insights.topFiveWorn.map((garment) => (
                  <div
                    key={garment.id}
                    className="flex-shrink-0 w-[72px] cursor-pointer"
                    onClick={() => navigate(`/wardrobe/${garment.id}`)}
                  >
                    <div className="relative">
                      <LazyImageSimple
                        imagePath={garment.image_path}
                        alt={garment.title}
                        className="w-[72px] h-24 rounded-xl"
                        fallbackIcon={<Shirt className="w-5 h-5 text-muted-foreground/50" />}
                      />
                      <Badge
                        variant="secondary"
                        className="absolute -top-1.5 -right-1.5 text-[10px] font-bold tabular-nums px-1.5 py-0 min-w-0 h-5"
                      >
                        {garment.wearCountLast30}×
                      </Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground truncate mt-1.5 text-center">{garment.title}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ─── 3. Color Breakdown (horizontal bar + percentages) ─── */}
          <div className="space-y-3">
            <SectionLabel icon={Palette} label={t('insights.colors')} />
            <div className={cn(!isPremium && "relative")}>
              <div className={cn(!isPremium && "blur-sm select-none")}>
                <ColorBar colors={colorData.bars} total={colorData.total} />
                <div className="mt-3 grid grid-cols-3 gap-x-4 gap-y-1.5">
                  {colorData.entries.map(([color, count]) => (
                    <div key={color} className="flex items-center justify-between">
                      <span className="text-[11px] capitalize text-muted-foreground truncate">{t(COLOR_I18N[color] || color)}</span>
                      <span className="text-[11px] tabular-nums font-medium ml-1">{Math.round((count / colorData.total) * 100)}%</span>
                    </div>
                  ))}
                </div>
              </div>
              {!isPremium && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Lock className="w-5 h-5 text-muted-foreground/40" />
                </div>
              )}
            </div>
          </div>


          {/* ─── 5. Sustainability Score ─── */}
          {sustainability && (
            <div className="space-y-3">
              <SectionLabel icon={Leaf} label={t('insights.sustainability')} />
              <div className={cn(!isPremium && "relative")}>
                <div className={cn(!isPremium && "blur-sm select-none")}>
                  <div className="text-center py-3">
                    <span className={cn("text-5xl font-bold tabular-nums", sustainColor)}>
                      {sustainability.score}
                    </span>
                    <span className="text-lg text-muted-foreground/60">/100</span>
                    <p className="text-xs text-muted-foreground mt-1.5">{t('insights.sustainability_desc')}</p>
                  </div>
                  <div className="grid grid-cols-3 gap-3 mt-3">
                     <div className="rounded-xl surface-secondary p-3 text-center">
                      <span className="text-lg font-bold tabular-nums">{sustainability.utilizationRate}%</span>
                      <p className="text-[10px] text-muted-foreground/60 mt-0.5">{t('insights.utilization')}</p>
                    </div>
                     <div className="rounded-xl surface-secondary p-3 text-center">
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
                    <Lock className="w-5 h-5 text-muted-foreground/40" />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ─── Premium link ─── */}
          {!isPremium && (
            <p className="text-center text-xs text-muted-foreground/40 pt-2">
              <button onClick={() => navigate('/pricing')} className="underline underline-offset-2 hover:text-foreground transition-colors">
                {t('insights.unlock')} {t('common.premium')}
              </button>
            </p>
          )}

          {/* ─── CTA ─── */}
          <SmartInsightCard />

          <Button className="w-full rounded-xl" size="lg" onClick={() => navigate('/')}>
            <Sparkles className="w-4 h-4 mr-2" />{t('insights.get_outfits')}
          </Button>

        </AnimatedPage>
      </PullToRefresh>
    </AppLayout>
  );
}
