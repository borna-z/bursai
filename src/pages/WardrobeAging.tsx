import { useState } from 'react';
import { Clock, Heart, Shield, Sparkles, AlertTriangle, Shirt, Lock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { AnimatedPage } from '@/components/ui/animated-page';
import { LazyImageSimple } from '@/components/ui/lazy-image';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSubscription } from '@/hooks/useSubscription';
import { PaywallModal } from '@/components/PaywallModal';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface AgingPrediction {
  garment_id: string;
  months_remaining: number;
  health_pct: number;
  tip: string;
  replacement_reason: string;
}

export default function WardrobeAgingPage() {
  const { t, locale } = useLanguage();
  const { isPremium } = useSubscription();
  const navigate = useNavigate();
  const [predictions, setPredictions] = useState<AgingPrediction[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);

  const analyze = async () => {
    if (!isPremium) { setShowPaywall(true); return; }
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('wardrobe_aging', {
        body: { locale },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setPredictions(data.predictions || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('common.something_wrong'));
    } finally {
      setIsLoading(false);
    }
  };

  const healthColor = (pct: number) =>
    pct >= 70 ? 'text-green-500' : pct >= 40 ? 'text-amber-500' : 'text-red-500';

  const healthBg = (pct: number) =>
    pct >= 70 ? 'bg-green-500' : pct >= 40 ? 'bg-amber-500' : 'bg-red-500';

  return (
    <AppLayout>
      <PageHeader title={t('ai.aging_title')} showBack />
      <AnimatedPage className="max-w-lg mx-auto px-4 pb-8 pt-4">
        {!predictions ? (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                <Clock className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-lg font-semibold">{t('ai.aging_heading')}</h2>
              <p className="text-sm text-muted-foreground">{t('ai.aging_desc')}</p>
            </div>

            <Button className="w-full rounded-xl" size="lg" onClick={analyze} disabled={isLoading}>
              <Sparkles className="w-4 h-4 mr-2" />
              {isLoading ? t('common.loading') : t('ai.aging_analyze')}
            </Button>
          </div>
        ) : predictions.length === 0 ? (
          <div className="text-center py-12 space-y-2">
            <Shield className="w-10 h-10 text-green-500 mx-auto" />
            <h3 className="font-semibold">{t('ai.aging_all_good')}</h3>
            <p className="text-sm text-muted-foreground">{t('ai.aging_all_good_desc')}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {predictions.sort((a, b) => a.months_remaining - b.months_remaining).map((pred, i) => (
              <motion.div
                key={pred.garment_id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
              >
                <Card
                  className="cursor-pointer hover:bg-accent/5 transition-colors"
                  onClick={() => navigate(`/wardrobe/${pred.garment_id}`)}
                >
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-14 h-16 rounded-xl flex-shrink-0 bg-muted flex items-center justify-center">
                        <Shirt className="w-5 h-5 text-muted-foreground/50" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className={cn('text-2xl font-bold tabular-nums', healthColor(pred.health_pct))}>
                            {pred.health_pct}%
                          </span>
                          <Badge variant="secondary" className="text-xs">
                            ~{pred.months_remaining} {t('ai.aging_months')}
                          </Badge>
                        </div>
                        <Progress value={pred.health_pct} className={cn('h-1.5 mt-1', `[&>div]:${healthBg(pred.health_pct)}`)} />
                      </div>
                    </div>

                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-warning flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-muted-foreground">{pred.replacement_reason}</p>
                    </div>

                    <div className="bg-muted/30 rounded-lg p-2.5 flex items-start gap-2">
                      <Heart className="w-3.5 h-3.5 text-primary flex-shrink-0 mt-0.5" />
                      <p className="text-[11px] text-muted-foreground">{pred.tip}</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}

            <Button variant="outline" className="w-full rounded-xl mt-4" onClick={() => setPredictions(null)}>
              {t('ai.aging_reanalyze')}
            </Button>
          </div>
        )}
      </AnimatedPage>
      <PaywallModal isOpen={showPaywall} onClose={() => setShowPaywall(false)} reason="outfits" />
    </AppLayout>
  );
}
