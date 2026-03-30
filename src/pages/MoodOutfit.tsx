import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';

import { AppLayout } from '@/components/layout/AppLayout';
import { PaywallModal } from '@/components/PaywallModal';
import { AnimatedPage } from '@/components/ui/animated-page';
import { hapticLight } from '@/lib/haptics';
import { OutfitGenerationState } from '@/components/ui/OutfitGenerationState';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/layout/PageHeader';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSubscription } from '@/hooks/useSubscription';
import { useWeather } from '@/hooks/useWeather';
import { invokeEdgeFunction } from '@/lib/edgeFunctionClient';
import { supabase } from '@/integrations/supabase/client';
import { buildStyleFlowSearch } from '@/lib/styleFlowState';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { EASE_CURVE, STAGGER_DELAY, DURATION_MEDIUM, DISTANCE } from '@/lib/motion';

const MOODS = [
  { key: 'confident', emoji: '✨', swatchColor: '#8B4B4B' },
  { key: 'cozy', emoji: '☁️', swatchColor: '#C4A882' },
  { key: 'creative', emoji: '🔥', swatchColor: '#7B6B8B' },
  { key: 'invisible', emoji: '🎈', swatchColor: '#888888' },
  { key: 'romantic', emoji: '🌹', swatchColor: '#C4869A' },
  { key: 'energetic', emoji: '⚡', swatchColor: '#C4A040' },
] as const;

export default function MoodOutfitPage() {
  const { t, locale } = useLanguage();
  const { isPremium } = useSubscription();
  const { user } = useAuth();
  const { weather } = useWeather();
  const navigate = useNavigate();
  const prefersReduced = useReducedMotion();

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

  const motionProps = prefersReduced
    ? { initial: { opacity: 0 }, animate: { opacity: 1 } }
    : { initial: { opacity: 0, y: DISTANCE.md }, animate: { opacity: 1, y: 0 } };

  return (
    <AppLayout>
      <AnimatedPage className="page-shell !px-5 !pt-6 page-cluster">
        {generatedOutfit ? (
          <>
            <PageHeader
              title={t('ai.mood_title') || 'Mood Outfit'}
              titleClassName="font-display italic"
              eyebrow="AI Stylist"
              showBack
            />

            {/* Result heading */}
            <motion.div
              {...motionProps}
              transition={{ ease: EASE_CURVE, duration: DURATION_MEDIUM }}
              className="space-y-1"
            >
              <p className="label-editorial text-muted-foreground/50 text-[0.65rem] uppercase tracking-[0.16em]">
                {t(`ai.mood_${generatedOutfit.mood}`)}
              </p>
              <h2 className="font-display italic text-[1.4rem] leading-tight text-foreground">
                Your look is ready
              </h2>
            </motion.div>

            {/* Explanation card */}
            {generatedOutfit.explanation ? (
              <motion.div
                {...motionProps}
                transition={{ ease: EASE_CURVE, duration: DURATION_MEDIUM, delay: 0.08 }}
              >
                <Card surface="secondary" className="space-y-3 rounded-[1.25rem] p-5">
                  <p className="label-editorial text-muted-foreground/50 text-[0.65rem] uppercase tracking-[0.16em]">
                    Why it works
                  </p>
                  <p className="font-body text-sm leading-7 text-muted-foreground">{generatedOutfit.explanation}</p>
                </Card>
              </motion.div>
            ) : null}

            {/* Action buttons */}
            <motion.div
              {...motionProps}
              transition={{ ease: EASE_CURVE, duration: DURATION_MEDIUM, delay: 0.12 }}
              className="flex flex-col gap-3"
            >
              <Button
                className="rounded-full w-full justify-center"
                onClick={() => {
                  hapticLight();
                  navigate(`/outfits/${generatedOutfit.id}`);
                }}
              >
                Save outfit
              </Button>
              <Button
                variant="outline"
                className="rounded-full w-full justify-center"
                onClick={() => {
                  hapticLight();
                  navigate(`/ai/chat${buildStyleFlowSearch(generatedOutfit.garmentIds)}`, {
                    state: {
                      outfitId: generatedOutfit.id,
                      prefillMessage: 'Refine this outfit for me.',
                      seedOutfitIds: generatedOutfit.garmentIds,
                    },
                  });
                }}
              >
                Refine in chat
              </Button>
            </motion.div>

            {/* Next move card */}
            <motion.div
              {...motionProps}
              transition={{ ease: EASE_CURVE, duration: DURATION_MEDIUM, delay: 0.16 }}
            >
              <Card surface="editorial" className="space-y-4 rounded-[1.25rem] p-5">
                <div>
                  <p className="label-editorial text-muted-foreground/50 text-[0.65rem] uppercase tracking-[0.16em]">
                    Next move
                  </p>
                  <h2 className="mt-2 font-display italic text-[1.3rem] text-foreground leading-tight">
                    Keep the energy, adjust the details.
                  </h2>
                  <p className="mt-2 font-body text-sm leading-6 text-muted-foreground">
                    Jump into chat if you want the look to feel sharper, softer, more formal, or more weather-aware.
                  </p>
                </div>
                <Button
                  variant="quiet"
                  className="w-full justify-center rounded-full sm:w-auto"
                  onClick={() => { hapticLight(); handleReMood(); }}
                >
                  Generate another
                </Button>
              </Card>
            </motion.div>
          </>
        ) : (
          <>
            <PageHeader
              title={t('ai.mood_title') || 'Mood Outfit'}
              titleClassName="font-display italic"
              eyebrow="AI Stylist"
              showBack
            />

            {/* Editorial heading */}
            <motion.section
              {...motionProps}
              transition={{ ease: EASE_CURVE, duration: DURATION_MEDIUM }}
              className="space-y-2"
            >
              <h1 className="font-display italic text-[1.5rem] leading-tight text-foreground">
                How are you feeling?
              </h1>
              <p className="label-editorial text-muted-foreground/50 text-[0.65rem] uppercase tracking-[0.16em]">
                Select your current aesthetic frequency
              </p>
            </motion.section>

            {/* Mood grid */}
            <section className="grid grid-cols-2 gap-3">
              {MOODS.map((mood, index) => {
                const isSelected = selectedMood === mood.key && isGenerating;

                return (
                  <motion.button
                    key={mood.key}
                    type="button"
                    {...(prefersReduced
                      ? { initial: { opacity: 0 }, animate: { opacity: 1 } }
                      : { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 } }
                    )}
                    transition={{
                      delay: index * STAGGER_DELAY * 2,
                      ease: EASE_CURVE,
                      duration: DURATION_MEDIUM,
                    }}
                    whileTap={prefersReduced ? undefined : { scale: 0.97 }}
                    onClick={() => { if (!isGenerating) { hapticLight(); generate(mood.key); } }}
                    disabled={isGenerating && !isSelected}
                    className="text-left cursor-pointer"
                  >
                    <Card
                      surface="secondary"
                      className={cn(
                        'h-full min-h-[5.5rem] overflow-hidden rounded-[1.25rem] p-4 transition-transform duration-200',
                        isSelected && 'bg-foreground text-background',
                        isGenerating && !isSelected ? 'opacity-55' : '',
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
                        <div className="flex items-center gap-3">
                          <span className="text-xl" role="img" aria-label={mood.key}>
                            {mood.emoji}
                          </span>
                          <span className="font-body text-sm font-medium text-foreground uppercase tracking-wide">
                            {t(`ai.mood_${mood.key}`)}
                          </span>
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
