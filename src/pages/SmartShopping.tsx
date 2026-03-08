import { useState } from 'react';
import { ShoppingBag, Sparkles, ChevronRight, Lock, Tag, TrendingUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { AnimatedPage } from '@/components/ui/animated-page';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSubscription } from '@/hooks/useSubscription';
import { PaywallModal } from '@/components/PaywallModal';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface ShoppingItem {
  name: string;
  category: string;
  reason: string;
  new_outfits: number;
  priority: 'high' | 'medium' | 'low';
  budget_hint: string;
  style_spec: string;
}

const PRIORITY_STYLES = {
  high: 'bg-red-500/10 text-red-500 border-red-500/20',
  medium: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  low: 'bg-green-500/10 text-green-500 border-green-500/20',
};

export default function SmartShoppingPage() {
  const { t, locale } = useLanguage();
  const { isPremium } = useSubscription();
  const [items, setItems] = useState<ShoppingItem[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);

  const generate = async () => {
    if (!isPremium) { setShowPaywall(true); return; }
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('smart_shopping_list', {
        body: { locale },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setItems(data.items || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('common.something_wrong'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AppLayout>
      <PageHeader title={t('ai.shopping_title')} showBack />
      <AnimatedPage className="max-w-lg mx-auto px-4 pb-8 pt-4">
        {!items ? (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                <ShoppingBag className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-lg font-semibold">{t('ai.shopping_heading')}</h2>
              <p className="text-sm text-muted-foreground">{t('ai.shopping_desc')}</p>
            </div>

            <Button className="w-full rounded-xl" size="lg" onClick={generate} disabled={isLoading}>
              <Sparkles className="w-4 h-4 mr-2" />
              {isLoading ? t('common.loading') : t('ai.shopping_generate')}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground text-center mb-6">
              {t('ai.shopping_results').replace('{count}', String(items.length))}
            </p>

            {items.map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
              >
                <Card>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm">{item.name}</h3>
                        <p className="text-xs text-muted-foreground capitalize mt-0.5">{item.category}</p>
                      </div>
                      <Badge className={cn('text-[10px] border', PRIORITY_STYLES[item.priority])}>
                        {item.priority}
                      </Badge>
                    </div>

                    <p className="text-xs text-muted-foreground">{item.reason}</p>

                    <div className="flex items-center gap-4 text-xs">
                      <div className="flex items-center gap-1 text-primary">
                        <TrendingUp className="w-3.5 h-3.5" />
                        <span>+{item.new_outfits} {t('ai.shopping_outfits')}</span>
                      </div>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Tag className="w-3.5 h-3.5" />
                        <span>{item.budget_hint}</span>
                      </div>
                    </div>

                    <div className="bg-muted/30 rounded-lg p-2.5">
                      <p className="text-[11px] text-muted-foreground">
                        <span className="font-medium text-foreground">{t('ai.shopping_look_for')}:</span> {item.style_spec}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}

            <Button variant="outline" className="w-full rounded-xl mt-4" onClick={() => setItems(null)}>
              {t('ai.shopping_regenerate')}
            </Button>
          </div>
        )}
      </AnimatedPage>
      <PaywallModal isOpen={showPaywall} onClose={() => setShowPaywall(false)} reason="outfits" />
    </AppLayout>
  );
}
