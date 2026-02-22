import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Shirt, Sparkles, BarChart3, TrendingUp, Lock, Palette, Gem, AlertCircle, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useInsights, type Garment } from '@/hooks/useInsights';
import { useSubscription } from '@/hooks/useSubscription';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState } from '@/components/layout/EmptyState';
import { AISuggestions } from '@/components/insights/AISuggestions';
import { MiniBar, ColorBar } from '@/components/insights/MiniBar';
import { UnusedGemCard } from '@/components/insights/UnusedGemCard';
import { LazyImageSimple } from '@/components/ui/lazy-image';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

function GarmentMini({ garment, wearCount }: { garment: Garment; wearCount?: number }) {
  const navigate = useNavigate();
  return (
    <div className="flex items-center gap-3 py-3 cursor-pointer hover:opacity-70 transition-opacity active:scale-[0.99]" onClick={() => navigate(`/wardrobe/${garment.id}`)}>
      <LazyImageSimple imagePath={garment.image_path} alt={garment.title} className="w-12 h-12 rounded-lg flex-shrink-0" fallbackIcon={<Shirt className="w-5 h-5 text-muted-foreground/50" />} />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{garment.title}</p>
        <p className="text-xs text-muted-foreground capitalize">{garment.category}</p>
      </div>
      {wearCount !== undefined && <Badge variant="secondary" className="font-semibold">{wearCount}×</Badge>}
    </div>
  );
}

const COLOR_I18N: Record<string, string> = {
  svart: 'color.svart', vit: 'color.vit', grå: 'color.grå', marinblå: 'color.marinblå',
  blå: 'color.blå', röd: 'color.röd', grön: 'color.grön', beige: 'color.beige',
  brun: 'color.brun', rosa: 'color.rosa', gul: 'color.gul', orange: 'color.orange', lila: 'color.lila',
};

function ColorDistribution({ garments, isPremium, t }: { garments: Garment[]; isPremium: boolean; t: (key: string) => string }) {
  const { colorCounts, colorBars, total } = useMemo(() => {
    const counts: Record<string, number> = {};
    garments.forEach(g => { const color = g.color_primary?.toLowerCase() || t('insights.unknown_color'); counts[color] = (counts[color] || 0) + 1; });
    const colorMap: Record<string, string> = { svart: 'bg-gray-900', vit: 'bg-gray-100', grå: 'bg-gray-400', marinblå: 'bg-blue-900', blå: 'bg-blue-500', röd: 'bg-red-500', grön: 'bg-green-600', beige: 'bg-amber-100', brun: 'bg-amber-800', rosa: 'bg-pink-400', lila: 'bg-purple-500', gul: 'bg-yellow-400', orange: 'bg-orange-500' };
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const bars = sorted.map(([color, count]) => ({ color, count, colorClass: colorMap[color] || 'bg-muted' }));
    return { colorCounts: sorted, colorBars: bars, total: garments.length };
  }, [garments]);

  return (
    <div className={cn("space-y-4", !isPremium && "relative")}>
      <div className="flex items-center gap-2">
        <Palette className="w-4 h-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">{t('insights.colors')}</h3>
      </div>
      <div className={cn(!isPremium && "blur-sm select-none")}>
        <ColorBar colors={colorBars} total={total} />
        <div className="mt-3 space-y-1.5">
          {colorCounts.map(([color, count]) => {
            const percentage = Math.round((count / total) * 100);
            return (
              <div key={color} className="flex items-center gap-3">
                <span className="text-xs capitalize flex-1">{t(COLOR_I18N[color] || color)}</span>
                <MiniBar value={percentage} className="flex-1" />
                <span className="text-[11px] text-muted-foreground w-6 text-right tabular-nums">{count}</span>
              </div>
            );
          })}
        </div>
      </div>
      {!isPremium && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/50 rounded-xl">
          <div className="text-center p-4"><Lock className="w-6 h-6 mx-auto mb-1.5 text-muted-foreground" /><p className="text-sm font-medium">{t('common.premium')}</p></div>
        </div>
      )}
    </div>
  );
}

function UnusedGems({ garments, isPremium, t }: { garments: Garment[]; isPremium: boolean; t: (key: string) => string }) {
  const navigate = useNavigate();
  const unusedGems = useMemo(() => {
    const sixtyDaysAgo = new Date(); sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
    return garments.filter(g => { if (!g.last_worn_at) return true; return new Date(g.last_worn_at) < sixtyDaysAgo; }).map(g => {
      const daysUnused = g.last_worn_at ? Math.floor((Date.now() - new Date(g.last_worn_at).getTime()) / (1000 * 60 * 60 * 24)) : 999;
      return { ...g, daysUnused };
    });
  }, [garments]);

  if (unusedGems.length === 0) return null;
  const handleCreateOutfit = (garmentId: string) => { navigate('/', { state: { includeGarmentId: garmentId } }); };

  return (
    <div className={cn("space-y-3", !isPremium && "relative")}>
      <div className="flex items-center gap-2">
        <Gem className="w-4 h-4 text-amber-500" />
        <h3 className="text-sm font-semibold">{t('insights.unused_gems')}</h3>
        <span className="text-xs text-muted-foreground">{unusedGems.length} {t('insights.unused_60d')}</span>
      </div>
      <div className={cn("divide-y divide-border/20", !isPremium && "blur-sm select-none")}>
        {unusedGems.slice(0, 4).map((garment) => (
          <UnusedGemCard key={garment.id} garment={garment} daysUnused={garment.daysUnused} onCreateOutfit={() => handleCreateOutfit(garment.id)} />
        ))}
        {unusedGems.length > 4 && (
          <Button variant="ghost" className="w-full text-sm" onClick={() => navigate('/wardrobe')}>
            {t('insights.show_all')} {unusedGems.length}
          </Button>
        )}
      </div>
      {!isPremium && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/50 rounded-xl">
          <div className="text-center p-4"><Lock className="w-6 h-6 mx-auto mb-1.5 text-muted-foreground" /><p className="text-sm font-medium">{t('common.premium')}</p></div>
        </div>
      )}
    </div>
  );
}

export default function InsightsPage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { data: insights, isLoading } = useInsights();
  const { isPremium, isLoading: subLoading } = useSubscription();

  if (isLoading || subLoading) {
    return (
      <AppLayout>
        <PageHeader title={t('insights.title')} showBack />
        <div className="flex items-center justify-center py-24"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
      </AppLayout>
    );
  }

  if (!insights || insights.totalGarments === 0) {
    return (
      <AppLayout>
        <PageHeader title={t('insights.title')} showBack />
        <EmptyState icon={BarChart3} title={t('insights.no_insights')} description={t('insights.add_garments')} action={{ label: t('wardrobe.add'), onClick: () => navigate('/wardrobe/add'), icon: Shirt }} />
      </AppLayout>
    );
  }

  const allGarments = [...insights.topFiveWorn, ...insights.unusedGarments];

  return (
    <AppLayout>
      <PageHeader title={t('insights.title')} showBack />
      <div className="px-4 pb-6 pt-6 space-y-5 max-w-lg mx-auto">

        {/* Stats strip — borderless */}
        <div className="flex items-center justify-between py-4 border-b border-border/20">
          <div className="flex-1 text-center">
            <p className="text-3xl font-bold tracking-tight tabular-nums">{insights.totalGarments}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{t('insights.total')}</p>
          </div>
          <div className="w-px h-10 bg-border/30" />
          <div className="flex-1 text-center">
            <p className="text-3xl font-bold tracking-tight tabular-nums text-primary">{insights.garmentsUsedLast30Days}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{t('insights.used_30d')}</p>
          </div>
        </div>

        {/* Usage rate */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">{t('insights.usage')}</h3>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-bold tracking-tight tabular-nums">{insights.usageRate}</span>
            <span className="text-xl text-muted-foreground">%</span>
          </div>
          <MiniBar value={insights.usageRate} color={insights.usageRate >= 50 ? 'success' : insights.usageRate >= 25 ? 'primary' : 'warning'} showLabel />
          <p className="text-xs text-muted-foreground">{insights.garmentsUsedLast30Days} {t('insights.of_garments')} {insights.totalGarments} {t('insights.garments_suffix')}</p>
        </div>

        {/* Top worn */}
        {insights.topFiveWorn.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-500" />
              <h3 className="text-sm font-semibold">{t('insights.top_garments')}</h3>
            </div>
            <div className="divide-y divide-border/20">
              {insights.topFiveWorn.map((garment, index) => (
                <div key={garment.id} className="flex items-center gap-2">
                  <span className="w-5 text-center font-bold text-muted-foreground/60 text-xs">{index + 1}</span>
                  <div className="flex-1"><GarmentMini garment={garment} wearCount={garment.wearCountLast30} /></div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Unused */}
        {insights.unusedGarments.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-500" />
              <h3 className="text-sm font-semibold">{t('insights.unused')}</h3>
              <span className="text-xs text-muted-foreground">{insights.unusedGarments.length} (30d)</span>
            </div>
            <div className={cn("divide-y divide-border/20", !isPremium && "blur-sm select-none relative")}>
              {insights.unusedGarments.slice(0, isPremium ? 5 : 3).map((garment) => (
                <GarmentMini key={garment.id} garment={garment} />
              ))}
              {!isPremium && insights.unusedGarments.length > 3 && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/50">
                  <div className="text-center p-3">
                    <Lock className="w-6 h-6 mx-auto mb-1.5 text-muted-foreground" />
                    <Button variant="outline" size="sm" onClick={() => navigate('/settings')}>
                      <Lock className="w-3 h-3 mr-1.5" />{t('common.premium')}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* AI Suggestions */}
        <AISuggestions isPremium={isPremium} />

        {/* Color Distribution — borderless */}
        <ColorDistribution garments={allGarments} isPremium={isPremium} t={t} />

        {/* Unused Gems — borderless */}
        <UnusedGems garments={insights.unusedGarments} isPremium={isPremium} t={t} />

        {/* Bottom subtle premium link */}
        {!isPremium && (
          <p className="text-center text-xs text-muted-foreground/60">
            <button onClick={() => navigate('/settings')} className="underline underline-offset-2 hover:text-foreground transition-colors">
              {t('insights.unlock')} {t('common.premium')}
            </button>
          </p>
        )}

        <Button className="w-full" size="lg" onClick={() => navigate('/')}>
          <Sparkles className="w-5 h-5 mr-2" />{t('insights.get_outfits')}
        </Button>
      </div>
    </AppLayout>
  );
}
