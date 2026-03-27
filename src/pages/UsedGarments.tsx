import { useNavigate } from 'react-router-dom';
import { Shirt, Sparkles } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { AnimatedPage } from '@/components/ui/animated-page';
import { EmptyState } from '@/components/layout/EmptyState';
import { LazyImageSimple } from '@/components/ui/lazy-image';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useInsights } from '@/hooks/useInsights';
import { useLanguage } from '@/contexts/LanguageContext';
import { hapticLight } from '@/lib/haptics';
import { getPreferredGarmentImagePath } from '@/lib/garmentImage';
import { buildStyleFlowSearch } from '@/lib/styleFlowState';

export default function UsedGarments() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { data: insights, isLoading } = useInsights();

  const usedGarments = insights?.usedGarments ?? [];

  return (
    <AppLayout>
      <PageHeader title={t('insights.used_garments_title')} showBack />
      <AnimatedPage className="max-w-lg mx-auto px-4 pb-8 pt-6">
        {isLoading ? (
          <div className="grid grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="aspect-[3/4] rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : usedGarments.length === 0 ? (
          <EmptyState
            icon={Shirt}
            title={t('insights.no_used_garments')}
            description={t('insights.no_used_garments_desc')}
          />
        ) : (
          <div className="space-y-6">
            <p className="text-sm text-muted-foreground">
              {usedGarments.length} {t('insights.used_garments_count')}
            </p>

            <div className="grid grid-cols-3 gap-3">
              {usedGarments.map((garment) => (
                <button
                  key={garment.id}
                  onClick={() => { hapticLight(); navigate(`/wardrobe/${garment.id}`); }}
                  className="text-left group"
                >
                  <div className="relative">
                    <LazyImageSimple
                      imagePath={getPreferredGarmentImagePath(garment)}
                      alt={garment.title}
                      className="aspect-[3/4] rounded-xl"
                      fallbackIcon={<Shirt className="w-5 h-5 text-muted-foreground/50" />}
                    />
                    <Badge
                      variant="secondary"
                      className="absolute -top-1.5 -right-1.5 text-[10px] font-bold tabular-nums px-1.5 py-0 min-w-0 h-5"
                    >
                      {garment.wearCountLast30}×
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate mt-1.5">{garment.title}</p>
                </button>
              ))}
            </div>

            <Button
              className="w-full rounded-xl"
              size="lg"
              onClick={() => {
                hapticLight();
                navigate(`/ai/generate${buildStyleFlowSearch(usedGarments.map((garment) => garment.id))}`);
              }}
            >
              <Sparkles className="w-4 h-4 mr-2" />
              {t('insights.generate_from_used')}
            </Button>
          </div>
        )}
      </AnimatedPage>
    </AppLayout>
  );
}
