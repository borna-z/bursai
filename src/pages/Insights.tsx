import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Shirt, Sparkles, TrendingUp, Lock, Palette, Gem, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useInsights, type Garment } from '@/hooks/useInsights';
import { useSubscription } from '@/hooks/useSubscription';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState } from '@/components/layout/EmptyState';
import { AISuggestions } from '@/components/insights/AISuggestions';
import { ColorBar } from '@/components/insights/MiniBar';
import { LazyImageSimple } from '@/components/ui/lazy-image';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { motion } from 'framer-motion';
import { AnimatedPage } from '@/components/ui/animated-page';

/* ─── Animated ring for usage rate ─── */
function UsageRing({ value, size = 120 }: { value: number; size?: number }) {
  const stroke = 6;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  const color = value >= 50 ? 'hsl(var(--success))' : value >= 25 ? 'hsl(var(--primary))' : 'hsl(var(--warning))';

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="hsl(var(--muted))"
        strokeWidth={stroke}
      />
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 1.2, ease: [0.25, 0.1, 0.25, 1], delay: 0.3 }}
      />
    </svg>
  );
}

/* ─── Stat pill ─── */
function StatPill({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1 flex-1">
      <span className="text-2xl font-bold tracking-tight tabular-nums">{value}</span>
      <span className="text-[10px] text-muted-foreground/70 uppercase tracking-wider">{label}</span>
    </div>
  );
}

/* ─── Section wrapper ─── */
function Section({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("space-y-4", className)}>{children}</div>;
}

function SectionLabel({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="w-4 h-4 text-muted-foreground/50" />
      <span className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wider">{label}</span>
    </div>
  );
}

/* ─── Top garment row ─── */
function TopGarmentRow({ garment, rank, wearCount }: { garment: Garment; rank: number; wearCount?: number }) {
  const navigate = useNavigate();
  return (
    <div
      className="flex items-center gap-3 py-3 cursor-pointer hover:opacity-70 transition-opacity active:scale-[0.99]"
      onClick={() => navigate(`/wardrobe/${garment.id}`)}
    >
      <span className="w-6 text-center text-xs font-bold text-muted-foreground/40 tabular-nums">{rank}</span>
      <LazyImageSimple
        imagePath={garment.image_path}
        alt={garment.title}
        className="w-12 h-14 rounded-xl flex-shrink-0"
        fallbackIcon={<Shirt className="w-5 h-5 text-muted-foreground/50" />}
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{garment.title}</p>
        <p className="text-xs text-muted-foreground capitalize">{garment.category}</p>
      </div>
      {wearCount !== undefined && (
        <Badge variant="secondary" className="font-semibold tabular-nums text-xs">{wearCount}×</Badge>
      )}
    </div>
  );
}

/* ─── Color distribution ─── */
const COLOR_I18N: Record<string, string> = {
  svart: 'color.svart', vit: 'color.vit', grå: 'color.grå', marinblå: 'color.marinblå',
  blå: 'color.blå', röd: 'color.röd', grön: 'color.grön', beige: 'color.beige',
  brun: 'color.brun', rosa: 'color.rosa', gul: 'color.gul', orange: 'color.orange', lila: 'color.lila',
};

function ColorDistribution({ garments, isPremium, t }: { garments: Garment[]; isPremium: boolean; t: (k: string) => string }) {
  const { colorBars, colorCounts, total } = useMemo(() => {
    const counts: Record<string, number> = {};
    garments.forEach(g => { const c = g.color_primary?.toLowerCase() || 'unknown'; counts[c] = (counts[c] || 0) + 1; });
    const colorMap: Record<string, string> = { svart: 'bg-gray-900', vit: 'bg-gray-100', grå: 'bg-gray-400', marinblå: 'bg-blue-900', blå: 'bg-blue-500', röd: 'bg-red-500', grön: 'bg-green-600', beige: 'bg-amber-100', brun: 'bg-amber-800', rosa: 'bg-pink-400', lila: 'bg-purple-500', gul: 'bg-yellow-400', orange: 'bg-orange-500' };
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6);
    return {
      colorBars: sorted.map(([color, count]) => ({ color, count, colorClass: colorMap[color] || 'bg-muted' })),
      colorCounts: sorted,
      total: garments.length,
    };
  }, [garments]);

  return (
    <Section>
      <SectionLabel icon={Palette} label={t('insights.colors')} />
      <div className={cn(!isPremium && "relative")}>
        <div className={cn(!isPremium && "blur-sm select-none")}>
          <ColorBar colors={colorBars} total={total} />
          <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2">
            {colorCounts.map(([color, count]) => (
              <div key={color} className="flex items-center justify-between">
                <span className="text-xs capitalize text-muted-foreground">{t(COLOR_I18N[color] || color)}</span>
                <span className="text-xs tabular-nums font-medium">{Math.round((count / total) * 100)}%</span>
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
    </Section>
  );
}

/* ─── Main page ─── */
export default function InsightsPage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { data: insights, isLoading } = useInsights();
  const { isPremium, isLoading: subLoading } = useSubscription();

  if (isLoading || subLoading) {
    return (
      <AppLayout>
        <PageHeader title={t('insights.title')} showBack />
        <div className="flex items-center justify-center py-32">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground/50" />
        </div>
      </AppLayout>
    );
  }

  if (!insights || insights.totalGarments === 0) {
    return (
      <AppLayout>
        <PageHeader title={t('insights.title')} showBack />
        <EmptyState
          icon={Sparkles}
          title={t('insights.no_insights')}
          description={t('insights.add_garments')}
          action={{ label: t('wardrobe.add'), onClick: () => navigate('/wardrobe/add'), icon: Shirt }}
        />
      </AppLayout>
    );
  }

  const allGarments = [...insights.topFiveWorn, ...insights.unusedGarments];

  return (
    <AppLayout>
      <PageHeader title={t('insights.title')} showBack />

      <AnimatedPage className="max-w-lg mx-auto px-4 pb-8 pt-6">
        {/* ─── Hero: Usage ring + stats ─── */}
        <div className="flex flex-col items-center pb-10">
          <div className="relative">
            <UsageRing value={insights.usageRate} size={140} />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-4xl font-bold tracking-tight tabular-nums">{insights.usageRate}</span>
              <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">%</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3">{t('insights.last_30d')}</p>

          <div className="flex items-center w-full mt-8">
            <StatPill value={insights.totalGarments} label={t('insights.total')} />
            <div className="w-px h-8 bg-border/20" />
            <StatPill value={insights.garmentsUsedLast30Days} label={t('insights.used_30d')} />
            <div className="w-px h-8 bg-border/20" />
            <StatPill value={insights.unusedGarments.length} label={t('insights.unused')} />
          </div>
        </div>

        <div className="space-y-10">
          {/* ─── Top worn ─── */}
          {insights.topFiveWorn.length > 0 && (
            <Section>
              <SectionLabel icon={Trophy} label={t('insights.top_garments')} />
              <div className="divide-y divide-border/10">
                {insights.topFiveWorn.map((garment, i) => (
                  <TopGarmentRow key={garment.id} garment={garment} rank={i + 1} wearCount={garment.wearCountLast30} />
                ))}
              </div>
            </Section>
          )}

          {/* ─── Unused gems ─── */}
          {insights.unusedGarments.length > 0 && (
            <Section>
              <div className="flex items-center justify-between">
                <SectionLabel icon={Gem} label={t('insights.unused_gems')} />
                <span className="text-[10px] text-muted-foreground/50">{insights.unusedGarments.length} {t('insights.unused_60d')}</span>
              </div>
              <div className={cn(!isPremium && "relative")}>
                <div className={cn("divide-y divide-border/10", !isPremium && "blur-sm select-none")}>
                  {insights.unusedGarments.slice(0, isPremium ? 5 : 3).map((garment) => (
                    <div
                      key={garment.id}
                      className="flex items-center gap-3 py-3 cursor-pointer hover:opacity-70 transition-opacity"
                      onClick={() => navigate(`/wardrobe/${garment.id}`)}
                    >
                      <LazyImageSimple
                        imagePath={garment.image_path}
                        alt={garment.title}
                        className="w-12 h-14 rounded-xl flex-shrink-0"
                        fallbackIcon={<Shirt className="w-5 h-5 text-muted-foreground/50" />}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{garment.title}</p>
                        <p className="text-xs text-muted-foreground capitalize">{garment.category}</p>
                      </div>
                    </div>
                  ))}
                </div>
                {!isPremium && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Lock className="w-5 h-5 text-muted-foreground/40" />
                  </div>
                )}
              </div>
            </Section>
          )}

          {/* ─── AI Suggestions ─── */}
          <AISuggestions isPremium={isPremium} />

          {/* ─── Color Distribution ─── */}
          <ColorDistribution garments={allGarments} isPremium={isPremium} t={t} />

          {/* ─── Subtle premium link ─── */}
          {!isPremium && (
            <p className="text-center text-xs text-muted-foreground/40 pt-2">
              <button onClick={() => navigate('/pricing')} className="underline underline-offset-2 hover:text-foreground transition-colors">
                {t('insights.unlock')} {t('common.premium')}
              </button>
            </p>
          )}

          {/* ─── CTA ─── */}
          <Button className="w-full rounded-xl" size="lg" onClick={() => navigate('/')}>
            <Sparkles className="w-4 h-4 mr-2" />{t('insights.get_outfits')}
          </Button>
        </div>
      </AnimatedPage>
    </AppLayout>
  );
}
