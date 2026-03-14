import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, Zap, Eye, EyeOff, Flame, Sparkles, Palette, Cloud } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { AnimatedPage } from '@/components/ui/animated-page';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSubscription } from '@/hooks/useSubscription';
import { useWeather } from '@/hooks/useWeather';
import { useAuth } from '@/contexts/AuthContext';
import { PaywallModal } from '@/components/PaywallModal';
import { supabase } from '@/integrations/supabase/client';
import { invokeEdgeFunction } from '@/lib/edgeFunctionClient';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

const MOODS = [
  { key: 'cozy', icon: Cloud, color: 'text-amber-500 bg-amber-500/10' },
  { key: 'confident', icon: Flame, color: 'text-red-500 bg-red-500/10' },
  { key: 'creative', icon: Palette, color: 'text-purple-500 bg-purple-500/10' },
  { key: 'invisible', icon: EyeOff, color: 'text-slate-500 bg-slate-500/10' },
  { key: 'romantic', icon: Heart, color: 'text-pink-500 bg-pink-500/10' },
  { key: 'energetic', icon: Zap, color: 'text-yellow-500 bg-yellow-500/10' },
] as const;

export default function MoodOutfitPage() {
  const { t, locale } = useLanguage();
  const { isPremium } = useSubscription();
  const { user } = useAuth();
  const { weather } = useWeather();
  const navigate = useNavigate();
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState<string | null>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Progressive loading messages
  useEffect(() => {
    if (isGenerating) {
      setLoadingPhase(null);
      const t1 = setTimeout(() => setLoadingPhase(t('ai.still_thinking') || 'Still thinking...'), 5000);
      const t2 = setTimeout(() => setLoadingPhase(t('ai.almost_there') || 'Almost there...'), 15000);
      timersRef.current = [t1, t2];
    } else {
      setLoadingPhase(null);
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
    }
    return () => {
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
    };
  }, [isGenerating]);

  const generate = async (mood: string) => {
    if (!isPremium) { setShowPaywall(true); return; }
    if (!user) return;
    setSelectedMood(mood);
    setIsGenerating(true);

    try {
      const { data, error } = await invokeEdgeFunction<{
        items?: { garment_id: string; slot: string }[];
        explanation?: string;
        mood_match_score?: number;
        error?: string;
      }>('mood_outfit', {
        timeout: 45000,
        body: {
          mood,
          weather: weather ? { temperature: weather.temperature, precipitation: weather.precipitation } : undefined,
          locale,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (!data?.items?.length) throw new Error(t('generate.error_desc'));

      // Save the outfit
      const { data: outfit, error: outfitErr } = await supabase
        .from('outfits')
        .insert([{
          user_id: user.id,
          occasion: `mood:${mood}`,
          style_vibe: mood,
          explanation: data.explanation,
          saved: true,
          style_score: { mood_match: data.mood_match_score },
        }])
        .select()
        .single();

      if (outfitErr) throw outfitErr;

      const items = data.items.map((i: any) => ({
        outfit_id: outfit.id,
        garment_id: i.garment_id,
        slot: i.slot,
      }));

      await supabase.from('outfit_items').insert(items);

      navigate(`/outfits/${outfit.id}`, { replace: true, state: { justGenerated: true } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('common.something_wrong'));
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <AppLayout>
      <PageHeader title={t('ai.mood_title')} showBack />
      <AnimatedPage className="max-w-lg mx-auto px-4 pb-8 pt-4">
        <div className="text-center space-y-2 mb-8">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
            <Sparkles className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-lg font-semibold">{t('ai.mood_heading')}</h2>
          <p className="text-sm text-muted-foreground">{t('ai.mood_desc')}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {MOODS.map((mood, i) => {
            const Icon = mood.icon;
            const isSelected = selectedMood === mood.key && isGenerating;
            return (
              <motion.div
                key={mood.key}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
              >
                <Card
                  className={`cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98] ${isSelected ? 'ring-2 ring-primary' : ''}`}
                  onClick={() => !isGenerating && generate(mood.key)}
                >
                  <CardContent className="p-5 flex flex-col items-center gap-3 text-center">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${mood.color}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{t(`ai.mood_${mood.key}`)}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{t(`ai.mood_${mood.key}_desc`)}</p>
                    </div>
                    {isSelected && (
                      <div className="space-y-1">
                        <Badge variant="secondary" className="animate-pulse text-xs">
                          {t('ai.mood_generating')}
                        </Badge>
                        {loadingPhase && (
                          <p className="text-muted-foreground text-[12px]">{loadingPhase}</p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </AnimatedPage>
      <PaywallModal isOpen={showPaywall} onClose={() => setShowPaywall(false)} reason="outfits" />
    </AppLayout>
  );
}
