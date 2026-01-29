import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Loader2, 
  Shirt, 
  Sparkles, 
  BarChart3, 
  TrendingUp,
  Lock,
  Palette,
  Gem,
  AlertCircle
} from 'lucide-react';
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

function GarmentMini({ garment, wearCount }: { garment: Garment; wearCount?: number }) {
  const navigate = useNavigate();

  return (
    <div
      className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl cursor-pointer hover:bg-muted transition-colors active:scale-[0.99]"
      onClick={() => navigate(`/wardrobe/${garment.id}`)}
    >
      <LazyImageSimple
        imagePath={garment.image_path}
        alt={garment.title}
        className="w-12 h-12 rounded-lg flex-shrink-0 shadow-sm"
        fallbackIcon={<Shirt className="w-5 h-5 text-muted-foreground/50" />}
      />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{garment.title}</p>
        <p className="text-xs text-muted-foreground capitalize">{garment.category}</p>
      </div>
      {wearCount !== undefined && (
        <Badge variant="secondary" className="font-semibold">
          {wearCount}×
        </Badge>
      )}
    </div>
  );
}

interface ColorDistributionProps {
  garments: Garment[];
  isPremium: boolean;
}

function ColorDistribution({ garments, isPremium }: ColorDistributionProps) {
  const { colorCounts, colorBars, total } = useMemo(() => {
    const counts: Record<string, number> = {};
    garments.forEach(g => {
      const color = g.color_primary?.toLowerCase() || 'okänd';
      counts[color] = (counts[color] || 0) + 1;
    });
    
    const colorMap: Record<string, string> = {
      svart: 'bg-gray-900',
      vit: 'bg-gray-100',
      grå: 'bg-gray-400',
      marinblå: 'bg-blue-900',
      blå: 'bg-blue-500',
      röd: 'bg-red-500',
      grön: 'bg-green-600',
      beige: 'bg-amber-100',
      brun: 'bg-amber-800',
      rosa: 'bg-pink-400',
      lila: 'bg-purple-500',
      gul: 'bg-yellow-400',
      orange: 'bg-orange-500',
    };
    
    const sorted = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
    
    const bars = sorted.map(([color, count]) => ({
      color,
      count,
      colorClass: colorMap[color] || 'bg-muted',
    }));
    
    return { colorCounts: sorted, colorBars: bars, total: garments.length };
  }, [garments]);

  return (
    <Card className={cn(!isPremium && "relative overflow-hidden")}>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Palette className="w-5 h-5 text-primary" />
          <CardTitle className="text-base">Färger</CardTitle>
        </div>
        <CardDescription>Dina vanligaste</CardDescription>
      </CardHeader>
      <CardContent className={cn(!isPremium && "blur-sm select-none")}>
        {/* Color bar visualization */}
        <ColorBar colors={colorBars} total={total} />
        
        <div className="mt-4 space-y-2">
          {colorCounts.map(([color, count]) => {
            const percentage = Math.round((count / total) * 100);
            
            return (
              <div key={color} className="flex items-center gap-3">
                <span className="text-sm capitalize flex-1">{color}</span>
                <MiniBar value={percentage} className="flex-1" />
                <span className="text-xs text-muted-foreground w-8 text-right">{count}</span>
              </div>
            );
          })}
        </div>
      </CardContent>
      
      {!isPremium && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/50">
          <div className="text-center p-4">
            <Lock className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
            <p className="font-medium">Premium</p>
          </div>
        </div>
      )}
    </Card>
  );
}

interface UnusedGemsProps {
  garments: Garment[];
  isPremium: boolean;
}

function UnusedGems({ garments, isPremium }: UnusedGemsProps) {
  const navigate = useNavigate();
  
  const unusedGems = useMemo(() => {
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
    
    return garments.filter(g => {
      if (!g.last_worn_at) return true;
      return new Date(g.last_worn_at) < sixtyDaysAgo;
    }).map(g => {
      const daysUnused = g.last_worn_at 
        ? Math.floor((Date.now() - new Date(g.last_worn_at).getTime()) / (1000 * 60 * 60 * 24))
        : 999;
      return { ...g, daysUnused };
    });
  }, [garments]);

  if (unusedGems.length === 0) return null;

  const handleCreateOutfit = (garmentId: string) => {
    navigate('/', { state: { includeGarmentId: garmentId } });
  };

  return (
    <Card className={cn(!isPremium && "relative overflow-hidden")}>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Gem className="w-5 h-5 text-amber-500" />
          <CardTitle className="text-base">Oanvända pärlor</CardTitle>
        </div>
        <CardDescription>
          {unusedGems.length} plagg ej använda 60+ dagar
        </CardDescription>
      </CardHeader>
      <CardContent className={cn("space-y-2", !isPremium && "blur-sm select-none")}>
        {unusedGems.slice(0, 4).map((garment) => (
          <UnusedGemCard 
            key={garment.id} 
            garment={garment}
            daysUnused={garment.daysUnused}
            onCreateOutfit={() => handleCreateOutfit(garment.id)}
          />
        ))}
        {unusedGems.length > 4 && (
          <Button 
            variant="ghost" 
            className="w-full text-sm"
            onClick={() => navigate('/wardrobe')}
          >
            Visa alla {unusedGems.length}
          </Button>
        )}
      </CardContent>
      
      {!isPremium && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/50">
          <div className="text-center p-4">
            <Lock className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
            <p className="font-medium">Premium</p>
          </div>
        </div>
      )}
    </Card>
  );
}

export default function InsightsPage() {
  const navigate = useNavigate();
  const { data: insights, isLoading } = useInsights();
  const { isPremium, isLoading: subLoading } = useSubscription();

  if (isLoading || subLoading) {
    return (
      <AppLayout>
        <PageHeader title="Insikter" />
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!insights || insights.totalGarments === 0) {
    return (
      <AppLayout>
        <PageHeader title="Insikter" />
        <EmptyState
          icon={BarChart3}
          title="Inga insikter ännu"
          description="Lägg till plagg för att se statistik."
          action={{
            label: 'Lägg till',
            onClick: () => navigate('/wardrobe/add'),
            icon: Shirt
          }}
        />
      </AppLayout>
    );
  }

  const allGarments = [
    ...insights.topFiveWorn,
    ...insights.unusedGarments,
  ];

  return (
    <AppLayout>
      <PageHeader title="Insikter" />
      
      <div className="p-4 space-y-4">
        {/* Premium CTA for free users */}
        {!isPremium && (
          <Card className="bg-gradient-to-br from-primary/10 via-primary/5 to-background border-primary/20 animate-fade-in">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-semibold">Lås upp alla insikter</p>
                <p className="text-sm text-muted-foreground">
                  AI-förslag, färger, statistik
                </p>
              </div>
              <Button size="sm" onClick={() => navigate('/settings')} className="active:animate-press">
                Premium
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Quick Stats - consistent card grid */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="bg-gradient-to-br from-muted/50 to-background">
            <CardContent className="p-4 text-center">
              <p className="text-4xl font-bold tracking-tight">{insights.totalGarments}</p>
              <p className="text-xs text-muted-foreground mt-1">Plagg totalt</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-primary/5 to-background">
            <CardContent className="p-4 text-center">
              <p className="text-4xl font-bold tracking-tight text-primary">{insights.garmentsUsedLast30Days}</p>
              <p className="text-xs text-muted-foreground mt-1">Använda (30d)</p>
            </CardContent>
          </Card>
        </div>

        {/* Usage Rate Card with mini-bar */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              <CardTitle className="text-base">Utnyttjande</CardTitle>
            </div>
            <CardDescription>Senaste 30 dagarna</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-baseline gap-1">
                <span className="text-5xl font-bold tracking-tight">{insights.usageRate}</span>
                <span className="text-2xl text-muted-foreground">%</span>
              </div>
              <MiniBar 
                value={insights.usageRate} 
                color={insights.usageRate >= 50 ? 'success' : insights.usageRate >= 25 ? 'primary' : 'warning'}
                showLabel 
              />
              <p className="text-sm text-muted-foreground">
                {insights.garmentsUsedLast30Days} av {insights.totalGarments} plagg
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Top 5 Most Worn */}
        {insights.topFiveWorn.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                🏆 Topplagg
              </CardTitle>
              <CardDescription>Mest använda (30d)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {insights.topFiveWorn.map((garment, index) => (
                <div key={garment.id} className="flex items-center gap-2 animate-fade-in" style={{ animationDelay: `${index * 50}ms` }}>
                  <span className="w-5 text-center font-bold text-muted-foreground">
                    {index + 1}
                  </span>
                  <div className="flex-1">
                    <GarmentMini 
                      garment={garment} 
                      wearCount={garment.wearCountLast30}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Unused garments */}
        {insights.unusedGarments.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-amber-500" />
                <CardTitle className="text-base">Oanvända</CardTitle>
              </div>
              <CardDescription>
                {insights.unusedGarments.length} plagg (30d)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {insights.unusedGarments.slice(0, isPremium ? 5 : 3).map((garment) => (
                <GarmentMini key={garment.id} garment={garment} />
              ))}
              {!isPremium && insights.unusedGarments.length > 3 && (
                <div className="text-center py-2">
                  <p className="text-sm text-muted-foreground mb-2">
                    +{insights.unusedGarments.length - 3} fler
                  </p>
                  <Button variant="outline" size="sm" onClick={() => navigate('/settings')} className="active:animate-press">
                    <Lock className="w-3 h-3 mr-1.5" />
                    Premium
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* AI Suggestions */}
        <AISuggestions isPremium={isPremium} />

        {/* Color Distribution */}
        <ColorDistribution garments={allGarments} isPremium={isPremium} />

        {/* Unused Gems (60+ days) */}
        <UnusedGems garments={insights.unusedGarments} isPremium={isPremium} />

        {/* CTA */}
        <Button 
          className="w-full active:animate-press" 
          size="lg"
          onClick={() => navigate('/')}
        >
          <Sparkles className="w-5 h-5 mr-2" />
          Få fler outfits
        </Button>
      </div>
    </AppLayout>
  );
}
