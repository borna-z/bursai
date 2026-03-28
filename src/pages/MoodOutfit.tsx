import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

import { AppLayout } from '@/components/layout/AppLayout';
import { StyleMeSubNav } from '@/components/ai/StyleMeSubNav';
import { PaywallModal } from '@/components/PaywallModal';
import { AnimatedPage } from '@/components/ui/animated-page';
import { OutfitGenerationState } from '@/components/ui/OutfitGenerationState';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PageIntro } from '@/components/ui/page-intro';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSubscription } from '@/hooks/useSubscription';
import { useWeather } from '@/hooks/useWeather';
import { invokeEdgeFunction } from '@/lib/edgeFunctionClient';
import { supabase } from '@/integrations/supabase/client';
import { buildStyleFlowSearch } from '@/lib/styleFlowState';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const MOODS = [
  { key: 'cozy', swatchColor: '#C4A882' },
  { key: 'confident', swatchColor: '#8B4B4B' },
  { key: 'creative', swatchColor: '#7B6B8B' },
  { key: 'invisible', swatchColor: '#888888' },
  { key: 'romantic', swatchColor: '#C4869A' },
  { key: 'energetic', swatchColor: '#C4A040' },
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
  const [generatedOutfit, setGeneratedOutfit] = useState<{
    id: string;
    explanation: string | null;
    mood: string;
    garmentIds: string[];
  } | null>(null);

  const generate = async (mood: string) => {
    if (!isPremium) {
      setShowPaywall(true);
      return;
    }
    if (!user) return;

    setSelectedMood(mood);
    setIsGenerating(true);

    try {
      const { data, error } = await invokeEdgeFunction<{
        items?: { garment_id: string; slot: string }[];
        explanation?: string;
        mood_match_score?: number;
        limitation_note?: string | null;
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

      const items = data.items.map((item: { garment_id: string; slot: string }) => ({
        outfit_id: outfit.id,
        garment_id: item.garment_id,
        slot: item.slot,
      }));

      await supabase.from('outfit_items').insert(items);

      setGeneratedOutfit({
        id: outfit.id,
        explanation: data.explanation || null,
        mood,
        garmentIds: data.items.map((item) => item.garment_id),
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('common.something_wrong'));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleReMood = () => {
    setGeneratedOutfit(null);
    setSelectedMood(null);
    setIsGenerating(false);
  };

  const weatherMeta = weather ? `${Math.round(weather.temperature)}° ${t(weather.condition)}` : null;

  return (
    <AppLayout>
      <StyleMeSubNav />

      <AnimatedPage className="page-shell !px-5 !pt-6 page-cluster">
        {generatedOutfit ? (
          <>
            <PageIntro
              eyebrow="Mood outfit"
              meta={<span className="eyebrow-chip !bg-secondary/70 capitalize">{t(`ai.mood_${generatedOutfit.mood}`)}</span>}
              title={t(`ai.mood_${generatedOutfit.mood}`)}
              description={generatedOutfit.explanation || 'A styled direction pulled from your wardrobe and shaped around the mood you picked.'}
              actions={(
                <>
                  <Button onClick={() => navigate(`/outfits/${generatedOutfit.id}`)}>
                    Open outfit
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => navigate(`/ai/chat${buildStyleFlowSearch(generatedOutfit.garmentIds)}`, {
                      state: {
                        outfitId: generatedOutfit.id,
                        prefillMessage: 'Refine this outfit for me.',
                        seedOutfitIds: generatedOutfit.garmentIds,
                      },
                    })}
                  >
                    Refine in chat
                  </Button>
                </>
              )}
            />

            {generatedOutfit.explanation ? (
              <Card surface="utility" className="space-y-3 p-5">
                <p className="label-editorial">Why it works</p>
                <p className="text-sm leading-7 text-muted-foreground">{generatedOutfit.explanation}</p>
              </Card>
            ) : null}

            <Card surface="editorial" className="space-y-4 p-5">
              <div>
                <p className="label-editorial">Next move</p>
                <h2 className="mt-2 font-['Playfair_Display'] italic text-[1.3rem] text-foreground leading-tight">
                  Keep the energy, adjust the details.
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Jump into chat if you want the look to feel sharper, softer, more formal, or more weather-aware.
                </p>
              </div>
              <Button variant="quiet" onClick={handleReMood} className="w-full justify-center sm:w-auto">
                Try another mood
              </Button>
            </Card>
          </>
        ) : (
          <>
            <PageIntro
              eyebrow="Mood styling"
              meta={weatherMeta ? <span className="eyebrow-chip !bg-secondary/70">{weatherMeta}</span> : undefined}
              title={t('ai.mood_heading')}
              description={t('ai.mood_desc')}
            />

            <section className="grid gap-3 sm:grid-cols-2">
              {MOODS.map((mood, index) => {
                const isSelected = selectedMood === mood.key && isGenerating;

                return (
                  <motion.button
                    key={mood.key}
                    type="button"
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.06 }}
                    onClick={() => !isGenerating && generate(mood.key)}
                    disabled={isGenerating && !isSelected}
                    className="text-left"
                  >
                    <Card
                      surface={isSelected ? 'editorial' : 'utility'}
                      className={cn(
                        'h-full min-h-[180px] overflow-hidden p-5 transition-transform duration-200',
                        isGenerating && !isSelected ? 'opacity-55' : 'hover:-translate-y-0.5',
                      )}
                    >
                      {isSelected ? (
                        <OutfitGenerationState
                          variant="compact"
                          tone="expressive"
                          subtitle={t(`ai.mood_${mood.key}`)}
                          className="border-0 bg-transparent p-0"
                        />
                      ) : (
                        <div className="flex h-full flex-col justify-between gap-6">
                          <div
                            className="h-12 w-12 rounded-[1.1rem] border border-background/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]"
                            style={{ backgroundColor: mood.swatchColor }}
                          />
                          <div className="space-y-2">
                            <p className="label-editorial">Mood direction</p>
                            <h2 className="font-['Playfair_Display'] italic text-[1.35rem] text-foreground leading-tight">
                              {t(`ai.mood_${mood.key}`)}
                            </h2>
                            <p className="text-sm leading-6 text-muted-foreground">
                              Build a look that feels {t(`ai.mood_${mood.key}`).toLowerCase()} without starting from scratch.
                            </p>
                          </div>
                        </div>
                      )}
                    </Card>
                  </motion.button>
                );
              })}
            </section>
          </>
        )}
      </AnimatedPage>

      <PaywallModal isOpen={showPaywall} onClose={() => setShowPaywall(false)} reason="outfits" />
    </AppLayout>
  );
}
