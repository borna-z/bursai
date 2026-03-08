import { useState } from 'react';
import { Users, Sparkles, Star, Lightbulb } from 'lucide-react';
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
import { useNavigate } from 'react-router-dom';

interface StyleTwinResult {
  twin_archetype: string;
  archetype_description: string;
  shared_traits: string[];
  style_icons: string[];
  signature_moves: string[];
  inspiration_outfits: { id: string; occasion: string; style_vibe: string }[];
}

export default function StyleTwinPage() {
  const { t, locale } = useLanguage();
  const { isPremium } = useSubscription();
  const navigate = useNavigate();
  const [result, setResult] = useState<StyleTwinResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);

  const discover = async () => {
    if (!isPremium) { setShowPaywall(true); return; }
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('style_twin', {
        body: { locale },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setResult(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('common.something_wrong'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AppLayout>
      <PageHeader title={t('ai.twin_title')} showBack />
      <AnimatedPage className="max-w-lg mx-auto px-4 pb-8 pt-4">
        {!result ? (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                <Users className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-lg font-semibold">{t('ai.twin_heading')}</h2>
              <p className="text-sm text-muted-foreground">{t('ai.twin_desc')}</p>
            </div>

            <Button className="w-full rounded-xl" size="lg" onClick={discover} disabled={isLoading}>
              <Sparkles className="w-4 h-4 mr-2" />
              {isLoading ? t('common.loading') : t('ai.twin_discover')}
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Archetype hero */}
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
              <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
                <CardContent className="p-6 text-center space-y-3">
                  <Users className="w-10 h-10 text-primary mx-auto" />
                  <h2 className="text-xl font-bold">{result.twin_archetype}</h2>
                  <p className="text-sm text-muted-foreground">{result.archetype_description}</p>
                </CardContent>
              </Card>
            </motion.div>

            {/* Traits */}
            <div className="space-y-2">
              <p className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wider">
                {t('ai.twin_traits')}
              </p>
              <div className="flex flex-wrap gap-2">
                {result.shared_traits.map((trait, i) => (
                  <Badge key={i} variant="secondary" className="rounded-full text-xs">{trait}</Badge>
                ))}
              </div>
            </div>

            {/* Style Icons */}
            <div className="space-y-2">
              <p className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wider flex items-center gap-1.5">
                <Star className="w-3.5 h-3.5" />
                {t('ai.twin_icons')}
              </p>
              <div className="flex flex-wrap gap-2">
                {result.style_icons.map((icon, i) => (
                  <Badge key={i} variant="outline" className="rounded-full text-xs">{icon}</Badge>
                ))}
              </div>
            </div>

            {/* Signature Moves */}
            <div className="space-y-3">
              <p className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wider flex items-center gap-1.5">
                <Lightbulb className="w-3.5 h-3.5" />
                {t('ai.twin_moves')}
              </p>
              {result.signature_moves.map((move, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + i * 0.1 }}
                >
                  <Card>
                    <CardContent className="p-3 text-sm">{move}</CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>

            {/* Inspiration outfits */}
            {result.inspiration_outfits.length > 0 && (
              <div className="space-y-3">
                <p className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wider">
                  {t('ai.twin_inspiration')}
                </p>
                {result.inspiration_outfits.map((outfit) => (
                  <Card
                    key={outfit.id}
                    className="cursor-pointer hover:bg-accent/5 transition-colors"
                    onClick={() => navigate(`/share/${outfit.id}`)}
                  >
                    <CardContent className="p-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium capitalize">{outfit.occasion}</p>
                        {outfit.style_vibe && (
                          <p className="text-xs text-muted-foreground">{outfit.style_vibe}</p>
                        )}
                      </div>
                      <Badge variant="secondary" className="text-xs">{t('ai.twin_view')}</Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            <Button variant="outline" className="w-full rounded-xl" onClick={() => setResult(null)}>
              {t('ai.twin_rediscover')}
            </Button>
          </div>
        )}
      </AnimatedPage>
      <PaywallModal isOpen={showPaywall} onClose={() => setShowPaywall(false)} reason="outfits" />
    </AppLayout>
  );
}
