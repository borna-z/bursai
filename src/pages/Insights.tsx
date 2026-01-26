import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, TrendingUp, Shirt, AlertCircle, Sparkles, Calendar, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useInsights, type Garment } from '@/hooks/useInsights';
import { useStorage } from '@/hooks/useStorage';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState } from '@/components/layout/EmptyState';

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
      className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted transition-colors"
      onClick={() => navigate(`/wardrobe/${garment.id}`)}
    >
      <div className="w-11 h-11 rounded-lg bg-background overflow-hidden flex-shrink-0">
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
        <span className="text-sm font-semibold text-primary">
          {wearCount}×
        </span>
      )}
    </div>
  );
}

export default function InsightsPage() {
  const navigate = useNavigate();
  const { data: insights, isLoading } = useInsights();

  if (isLoading) {
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

  return (
    <AppLayout>
      <PageHeader title="Insikter" />
      
      <div className="p-4 space-y-4">
        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold">{insights.totalGarments}</p>
              <p className="text-xs text-muted-foreground mt-1">Plagg totalt</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold">{insights.garmentsUsedLast30Days}</p>
              <p className="text-xs text-muted-foreground mt-1">Använda 30 dagar</p>
            </CardContent>
          </Card>
        </div>

        {/* Usage Rate */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              <CardTitle className="text-base">Användningsgrad</CardTitle>
            </div>
            <CardDescription>Senaste 30 dagarna</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-bold">{insights.usageRate}</span>
                <span className="text-xl text-muted-foreground">%</span>
              </div>
              <Progress value={insights.usageRate} className="h-2" />
              <p className="text-sm text-muted-foreground">
                Du använder {insights.garmentsUsedLast30Days} av {insights.totalGarments} plagg
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Top 5 Most Worn */}
        {insights.topFiveWorn.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                🏆 Topp 5 mest använda
              </CardTitle>
              <CardDescription>Dina favoriter senaste 30 dagarna</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {insights.topFiveWorn.map((garment) => (
                <GarmentMini 
                  key={garment.id} 
                  garment={garment} 
                  wearCount={garment.wearCountLast30}
                />
              ))}
            </CardContent>
          </Card>
        )}

        {/* Unused Garments */}
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
              {insights.unusedGarments.slice(0, 5).map((garment) => (
                <GarmentMini key={garment.id} garment={garment} />
              ))}
              {insights.unusedGarments.length > 5 && (
                <p className="text-sm text-muted-foreground text-center pt-2">
                  +{insights.unusedGarments.length - 5} fler
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* CTA */}
        {insights.unusedGarments.length > 0 && (
          <Button className="w-full" onClick={() => navigate('/')}>
            <Sparkles className="w-4 h-4 mr-2" />
            Skapa outfit med oanvänt plagg
          </Button>
        )}
      </div>
    </AppLayout>
  );
}
