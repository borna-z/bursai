import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, TrendingUp, Shirt, AlertCircle, Sparkles, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useInsights, type Garment } from '@/hooks/useInsights';
import { useStorage } from '@/hooks/useStorage';
import { AppLayout } from '@/components/layout/AppLayout';

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
      className="flex items-center gap-3 p-3 bg-secondary rounded-lg cursor-pointer hover:bg-secondary/80"
      onClick={() => navigate(`/wardrobe/${garment.id}`)}
    >
      <div className="w-12 h-12 rounded-lg bg-background overflow-hidden flex-shrink-0">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={garment.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="w-6 h-6 rounded-full bg-muted" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{garment.title}</p>
        <p className="text-xs text-muted-foreground capitalize">{garment.category}</p>
      </div>
      {wearCount !== undefined && (
        <span className="text-sm font-medium text-muted-foreground">
          {wearCount}x
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
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!insights || insights.totalGarments === 0) {
    return (
      <AppLayout>
        <div className="p-4">
          <h1 className="text-2xl font-bold mb-6">Insikter</h1>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-4">
              <TrendingUp className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-lg font-medium">Inga insikter ännu</p>
            <p className="text-muted-foreground mt-1">
              Lägg till plagg för att se statistik
            </p>
            <Button className="mt-4" onClick={() => navigate('/wardrobe/add')}>
              <Shirt className="w-4 h-4 mr-2" />
              Lägg till plagg
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-4 space-y-4">
        <h1 className="text-2xl font-bold">Insikter</h1>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold">{insights.totalGarments}</p>
              <p className="text-sm text-muted-foreground">Plagg totalt</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold">{insights.garmentsUsedLast30Days}</p>
              <p className="text-sm text-muted-foreground">Använda 30 dagar</p>
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
              <div className="flex items-end gap-2">
                <span className="text-4xl font-bold">{insights.usageRate}%</span>
              </div>
              <Progress value={insights.usageRate} className="h-3" />
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
              <CardTitle className="text-base">🏆 Topp 5 mest använda</CardTitle>
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
                <AlertCircle className="w-5 h-5 text-orange-500" />
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
