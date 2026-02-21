import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Shirt, Sparkles, BarChart3, TrendingUp, Lock, Palette, Gem, AlertCircle, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useInsights, type Garment, type InsightsData } from '@/hooks/useInsights';
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
      <LazyImageSimple imagePath={garment.image_path} alt={garment.title} className="w-12 h-12 rounded-lg flex-shrink-0 shadow-sm" fallbackIcon={<Shirt className="w-5 h-5 text-muted-foreground/50" />} />
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

interface ColorDistributionProps { garments: Garment[]; isPremium: boolean; t: (key: string) => string; }

function ColorDistribution({ garments, isPremium, t }: ColorDistributionProps) {
  const { colorCounts, colorBars, total } = useMemo(() => {
    const counts: Record<string, number> = {};
    garments.forEach(g => { const color = g.color_primary?.toLowerCase() || t('insights.unknown_color'); counts[color] = (counts[color] || 0) + 1; });
    const colorMap: Record<string, string> = { svart: 'bg-gray-900', vit: 'bg-gray-100', grå: 'bg-gray-400', marinblå: 'bg-blue-900', blå: 'bg-blue-500', röd: 'bg-red-500', grön: 'bg-green-600', beige: 'bg-amber-100', brun: 'bg-amber-800', rosa: 'bg-pink-400', lila: 'bg-purple-500', gul: 'bg-yellow-400', orange: 'bg-orange-500' };
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const bars = sorted.map(([color, count]) => ({ color, count, colorClass: colorMap[color] || 'bg-muted' }));
    return { colorCounts: sorted, colorBars: bars, total: garments.length };
  }, [garments]);

  return (
    <Card className={cn(!isPremium && "relative overflow-hidden")}>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2"><Palette className="w-5 h-5 text-primary" /><CardTitle className="text-base">{t('insights.colors')}</CardTitle></div>
        <CardDescription>{t('insights.common_colors')}</CardDescription>
      </CardHeader>
      <CardContent className={cn(!isPremium && "blur-sm select-none")}>
        <ColorBar colors={colorBars} total={total} />
        <div className="mt-4 space-y-2">
          {colorCounts.map(([color, count]) => {
            const percentage = Math.round((count / total) * 100);
            return (
              <div key={color} className="flex items-center gap-3">
                <span className="text-sm capitalize flex-1">{t(COLOR_I18N[color] || color)}</span>
                <MiniBar value={percentage} className="flex-1" />
                <span className="text-xs text-muted-foreground w-8 text-right">{count}</span>
              </div>
            );
          })}
        </div>
      </CardContent>
      {!isPremium && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/50">
          <div className="text-center p-4"><Lock className="w-8 h-8 mx-auto mb-2 text-muted-foreground" /><p className="font-medium">{t('common.premium')}</p></div>
        </div>
      )}
    </Card>
  );
}

interface UnusedGemsProps { garments: Garment[]; isPremium: boolean; t: (key: string) => string; }

function UnusedGems({ garments, isPremium, t }: UnusedGemsProps) {
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
    <Card className={cn(!isPremium && "relative overflow-hidden")}>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2"><Gem className="w-5 h-5 text-amber-500" /><CardTitle className="text-base">{t('insights.unused_gems')}</CardTitle></div>
        <CardDescription>{unusedGems.length} {t('insights.unused_60d')}</CardDescription>
      </CardHeader>
      <CardContent className={cn("divide-y divide-border/50", !isPremium && "blur-sm select-none")}>
        {unusedGems.slice(0, 4).map((garment) => (
          <UnusedGemCard key={garment.id} garment={garment} daysUnused={garment.daysUnused} onCreateOutfit={() => handleCreateOutfit(garment.id)} />
        ))}
        {unusedGems.length > 4 && (
          <Button variant="ghost" className="w-full text-sm" onClick={() => navigate('/wardrobe')}>
            {t('insights.show_all')} {unusedGems.length}
          </Button>
        )}
      </CardContent>
      {!isPremium && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/50">
          <div className="text-center p-4"><Lock className="w-8 h-8 mx-auto mb-2 text-muted-foreground" /><p className="font-medium">{t('common.premium')}</p></div>
        </div>
      )}
    </Card>
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
      <div className="px-4 pb-6 pt-4 space-y-5 max-w-lg mx-auto stagger-drape [&>*]:animate-drape-in [&>*]:opacity-0 [&>*]:[animation-fill-mode:both]">
        {!isPremium && (
          <Card className="bg-gradient-to-br from-primary/10 via-primary/5 to-background/70 backdrop-blur-sm border-primary/20 animate-fade-in dark:bg-white/[0.04] dark:border-white/[0.08] dark:from-transparent dark:via-transparent dark:to-transparent">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0"><Sparkles className="w-6 h-6 text-primary" /></div>
              <div className="flex-1">
                <p className="font-semibold">{t('insights.unlock')}</p>
                <p className="text-sm text-muted-foreground">{t('insights.ai_suggestions')}</p>
              </div>
              <Button size="sm" onClick={() => navigate('/settings')}>{t('common.premium')}</Button>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Card className="bg-gradient-to-br from-muted/40 to-background/70 backdrop-blur-sm">
            <CardContent className="p-4 text-center">
              <p className="text-4xl font-bold tracking-tight">{insights.totalGarments}</p>
              <p className="text-xs text-muted-foreground mt-1">{t('insights.total')}</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-primary/5 to-background/70 backdrop-blur-sm">
            <CardContent className="p-4 text-center">
              <p className="text-4xl font-bold tracking-tight text-primary">{insights.garmentsUsedLast30Days}</p>
              <p className="text-xs text-muted-foreground mt-1">{t('insights.used_30d')}</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2"><TrendingUp className="w-5 h-5 text-primary" /><CardTitle className="text-base">{t('insights.usage')}</CardTitle></div>
            <CardDescription>{t('insights.last_30d')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-baseline gap-1">
                <span className="text-5xl font-bold tracking-tight">{insights.usageRate}</span>
                <span className="text-2xl text-muted-foreground">%</span>
              </div>
              <MiniBar value={insights.usageRate} color={insights.usageRate >= 50 ? 'success' : insights.usageRate >= 25 ? 'primary' : 'warning'} showLabel />
              <p className="text-sm text-muted-foreground">{insights.garmentsUsedLast30Days} {t('insights.of_garments')} {insights.totalGarments} {t('insights.garments_suffix')}</p>
            </div>
          </CardContent>
        </Card>

        {insights.topFiveWorn.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2"><Trophy className="w-4 h-4 text-amber-500" /> {t('insights.top_garments')}</CardTitle>
              <CardDescription>{t('insights.most_used')}</CardDescription>
            </CardHeader>
            <CardContent className="divide-y divide-border/50">
              {insights.topFiveWorn.map((garment, index) => (
                <div key={garment.id} className="flex items-center gap-2 animate-fade-in" style={{ animationDelay: `${index * 50}ms` }}>
                  <span className="w-5 text-center font-bold text-muted-foreground">{index + 1}</span>
                  <div className="flex-1"><GarmentMini garment={garment} wearCount={garment.wearCountLast30} /></div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {insights.unusedGarments.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2"><AlertCircle className="w-5 h-5 text-amber-500" /><CardTitle className="text-base">{t('insights.unused')}</CardTitle></div>
              <CardDescription>{insights.unusedGarments.length} {t('insights.garments_suffix')} (30d)</CardDescription>
            </CardHeader>
            <CardContent className="divide-y divide-border/50">
              {insights.unusedGarments.slice(0, isPremium ? 5 : 3).map((garment) => (
                <GarmentMini key={garment.id} garment={garment} />
              ))}
              {!isPremium && insights.unusedGarments.length > 3 && (
                <div className="text-center py-2">
                  <p className="text-sm text-muted-foreground mb-2">+{insights.unusedGarments.length - 3} {t('insights.more')}</p>
                  <Button variant="outline" size="sm" onClick={() => navigate('/settings')}>
                    <Lock className="w-3 h-3 mr-1.5" />{t('common.premium')}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <AISuggestions isPremium={isPremium} />
        <ColorDistribution garments={allGarments} isPremium={isPremium} t={t} />
        <UnusedGems garments={insights.unusedGarments} isPremium={isPremium} t={t} />

        <Button className="w-full" size="lg" onClick={() => navigate('/')}>
          <Sparkles className="w-5 h-5 mr-2" />{t('insights.get_outfits')}
        </Button>
      </div>
    </AppLayout>
  );
}
