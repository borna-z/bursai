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
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useInsights, type Garment, type InsightsData } from '@/hooks/useInsights';
import { useStorage } from '@/hooks/useStorage';
import { useSubscription } from '@/hooks/useSubscription';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState } from '@/components/layout/EmptyState';
import { AISuggestions } from '@/components/insights/AISuggestions';
import { cn } from '@/lib/utils';

function GarmentMini({ garment, wearCount }: { garment: Garment; wearCount?: number }) {
  const navigate = useNavigate();
  const { getGarmentSignedUrl } = useStorage();
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (garment.image_path) {
      getGarmentSignedUrl(garment.image_path).then(setImageUrl).catch(() => {});
    }
  }, [garment.image_path]);

  return (
    <div
      className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl cursor-pointer hover:bg-muted transition-colors"
      onClick={() => navigate(`/wardrobe/${garment.id}`)}
    >
      <div className="w-12 h-12 rounded-lg bg-background overflow-hidden flex-shrink-0 shadow-sm">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={garment.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Shirt className="w-5 h-5 text-muted-foreground/50" />
          </div>
        )}
      </div>
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
  const colorCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    garments.forEach(g => {
      const color = g.color_primary?.toLowerCase() || 'okänd';
      counts[color] = (counts[color] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
  }, [garments]);

  const total = garments.length;

  // Color mapping for display
  const colorMap: Record<string, string> = {
    svart: 'bg-gray-900',
    vit: 'bg-gray-100 border',
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

  return (
    <Card className={cn(!isPremium && "relative overflow-hidden")}>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Palette className="w-5 h-5 text-primary" />
          <CardTitle className="text-base">Färgfördelning</CardTitle>
        </div>
        <CardDescription>Dina vanligaste färger</CardDescription>
      </CardHeader>
      <CardContent className={cn(!isPremium && "blur-sm select-none")}>
        <div className="space-y-3">
          {colorCounts.map(([color, count]) => {
            const percentage = Math.round((count / total) * 100);
            const colorClass = colorMap[color] || 'bg-muted';
            
            return (
              <div key={color} className="flex items-center gap-3">
                <div className={cn("w-4 h-4 rounded-full flex-shrink-0", colorClass)} />
                <span className="text-sm capitalize flex-1">{color}</span>
                <span className="text-sm text-muted-foreground">{count} st</span>
                <span className="text-sm font-medium w-10 text-right">{percentage}%</span>
              </div>
            );
          })}
        </div>
      </CardContent>
      
      {!isPremium && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/50">
          <div className="text-center p-4">
            <Lock className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
            <p className="font-medium">Premium-funktion</p>
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
  
  // Filter garments not worn in 60+ days
  const unusedGems = useMemo(() => {
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
    
    return garments.filter(g => {
      if (!g.last_worn_at) return true;
      return new Date(g.last_worn_at) < sixtyDaysAgo;
    });
  }, [garments]);

  if (unusedGems.length === 0) return null;

  return (
    <Card className={cn(!isPremium && "relative overflow-hidden")}>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Gem className="w-5 h-5 text-amber-500" />
          <CardTitle className="text-base">Oanvända pärlor</CardTitle>
        </div>
        <CardDescription>
          {unusedGems.length} plagg ej använda på 60+ dagar
        </CardDescription>
      </CardHeader>
      <CardContent className={cn("space-y-2", !isPremium && "blur-sm select-none")}>
        {unusedGems.slice(0, 4).map((garment) => (
          <GarmentMini key={garment.id} garment={garment} />
        ))}
        {unusedGems.length > 4 && (
          <Button 
            variant="ghost" 
            className="w-full text-sm"
            onClick={() => navigate('/wardrobe')}
          >
            Visa alla {unusedGems.length} plagg
          </Button>
        )}
      </CardContent>
      
      {!isPremium && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/50">
          <div className="text-center p-4">
            <Lock className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
            <p className="font-medium">Premium-funktion</p>
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
          description="Lägg till plagg i din garderob för att börja se statistik och användningsmönster."
          action={{
            label: 'Lägg till plagg',
            onClick: () => navigate('/wardrobe/add'),
            icon: Shirt
          }}
        />
      </AppLayout>
    );
  }

  // Get all garments for color distribution (from topFiveWorn + unusedGarments)
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
          <Card className="bg-gradient-to-br from-primary/10 via-primary/5 to-background border-primary/20">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-semibold">Lås upp alla insikter</p>
                <p className="text-sm text-muted-foreground">
                  Se färgfördelning, oanvända pärlor och mer
                </p>
              </div>
              <Button size="sm" onClick={() => navigate('/settings')}>
                Premium
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Quick Stats */}
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
              <p className="text-xs text-muted-foreground mt-1">Använda (30 dagar)</p>
            </CardContent>
          </Card>
        </div>

        {/* Usage Rate Card */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              <CardTitle className="text-base">Utnyttjande</CardTitle>
            </div>
            <CardDescription>Andel plagg använda senaste 30 dagarna</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-baseline gap-1">
                <span className="text-5xl font-bold tracking-tight">{insights.usageRate}</span>
                <span className="text-2xl text-muted-foreground">%</span>
              </div>
              <Progress value={insights.usageRate} className="h-3" />
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
              <CardDescription>Mest använda senaste 30 dagarna</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {insights.topFiveWorn.map((garment, index) => (
                <div key={garment.id} className="flex items-center gap-2">
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

        {/* Unused garments (free version - limited) */}
        {insights.unusedGarments.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-amber-500" />
                <CardTitle className="text-base">Oanvända plagg</CardTitle>
              </div>
              <CardDescription>
                {insights.unusedGarments.length} plagg ej använda på 30 dagar
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {insights.unusedGarments.slice(0, isPremium ? 5 : 3).map((garment) => (
                <GarmentMini key={garment.id} garment={garment} />
              ))}
              {!isPremium && insights.unusedGarments.length > 3 && (
                <div className="text-center py-2">
                  <p className="text-sm text-muted-foreground mb-2">
                    +{insights.unusedGarments.length - 3} fler plagg
                  </p>
                  <Button variant="outline" size="sm" onClick={() => navigate('/settings')}>
                    <Lock className="w-3 h-3 mr-1.5" />
                    Lås upp med Premium
                  </Button>
                </div>
              )}
              {isPremium && insights.unusedGarments.length > 5 && (
                <p className="text-sm text-muted-foreground text-center pt-2">
                  +{insights.unusedGarments.length - 5} fler
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* AI Suggestions - Premium only */}
        <AISuggestions isPremium={isPremium} />

        {/* Color Distribution - Premium only */}
        <ColorDistribution garments={allGarments} isPremium={isPremium} />

        {/* Unused Gems (60+ days) - Premium only */}
        <UnusedGems garments={insights.unusedGarments} isPremium={isPremium} />

        {/* CTA */}
        <Button 
          className="w-full" 
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
