import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';

import { AppLayout } from '@/components/layout/AppLayout';
import { PaywallModal } from '@/components/PaywallModal';
import { AnimatedPage } from '@/components/ui/animated-page';
import { hapticLight } from '@/lib/haptics';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { OutfitPreviewCard } from '@/components/ui/OutfitPreviewCard';
import { PageHeader } from '@/components/layout/PageHeader';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSubscription } from '@/hooks/useSubscription';
import { useOutfit } from '@/hooks/useOutfits';
import { useWeather } from '@/hooks/useWeather';
import { createSupabaseRestHeaders, getSupabaseFunctionUrl, supabase } from '@/integrations/supabase/client';
import { buildStyleFlowSearch } from '@/lib/styleFlowState';
import { cn } from '@/lib/utils';
import { trackEvent } from '@/lib/analytics';
import { toast } from 'sonner';
import { EASE_CURVE, STAGGER_DELAY, DURATION_MEDIUM, DISTANCE } from '@/lib/motion';

const MOODS = [
  { key: 'confident', accent: '#2C2C2C', palette: ['#2C2C2C', '#8B0000', '#F5F0E8'], hint: 'Sharp. Owned.' },
  { key: 'cozy',      accent: '#C4A882', palette: ['#C4A882', '#8B6B4A', '#F5EDE0'], hint: 'Warm. Enveloping.' },
  { key: 'creative',  accent: '#7B5EA7', palette: ['#7B5EA7', '#D4A843', '#2D1B4E'], hint: 'Unexpected. Artful.' },
  { key: 'invisible', accent: '#888888', palette: ['#888888', '#C8C4BC', '#1C1917'], hint: 'Quiet. Tonal.' },
  { key: 'romantic',  accent: '#D4537E', palette: ['#D4537E', '#E8A0B8', '#FFF0F5'], hint: 'Soft. Dreamy.' },
  { key: 'grounded',  accent: '#4A7C4A', palette: ['#4A7C4A', '#8B6B3D', '#C4A87A'], hint: 'Earthy. Real.' },
  { key: 'sharp',     accent: '#C9A86C', palette: ['#1C1917', '#C9A86C', '#F5F0E8'], hint: 'Tailored. Precise.' },
  { key: 'soft',      accent: '#85B7EB', palette: ['#85B7EB', '#B4C8D8', '#E8EDF2'], hint: 'Muted. Gentle.' },
  { key: 'bold',      accent: '#C0392B', palette: ['#C0392B', '#1C1917', '#FFE0E0'], hint: 'Statement. Maximum.' },
  { key: 'editorial', accent: '#185FA5', palette: ['#185FA5', '#C9A86C', '#0A2438'], hint: 'Avant-garde.' },
  { key: 'energetic', accent: '#D85A30', palette: ['#EF9F27', '#D85A30', '#1C1917'], hint: 'Vibrant. Moving.' },
  { key: 'playful',   accent: '#9B59B6', palette: ['#D4537E', '#EF9F27', '#534AB7'], hint: 'Unexpected. Fun.' },
] as const;

type MoodOutfitResponse = {
  items?: { garment_id: string; slot: string }[];
  explanation?: string;
  mood_match_score?: number;
  limitation_note?: string | null;
  error?: string;
};

async function readMoodOutfitSse(
  mood: string,
  weather: { temperature?: number; precipitation?: string | null } | undefined,
  locale: string,
): Promise<MoodOutfitResponse> {
  const session = (await supabase.auth.getSession()).data.session;
  const accessToken = session?.access_token;
  if (!accessToken) {
    throw new Error('Unauthorized');
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(getSupabaseFunctionUrl('mood_outfit'), {
      method: 'POST',
      headers: {
        ...(await createSupabaseRestHeaders(accessToken)),
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify({ mood, weather, locale }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    if (!response.body) {
      throw new Error('Missing streaming response body');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let sawDone = false;
    let result: MoodOutfitResponse | null = null;
    let streamClosed = false;

    while (!streamClosed) {
      const { done, value } = await reader.read();
      if (done) {
        buffer += decoder.decode();
        streamClosed = true;
      } else {
        buffer += decoder.decode(value, { stream: true });
      }

      let newlineIndex: number;
      while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
        let line = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);
        if (line.endsWith('\r')) line = line.slice(0, -1);
        if (line.startsWith(':') || line.trim() === '') continue;
        if (!line.startsWith('data:')) continue;

        const data = line.slice(5).trim();
        if (!data) continue;
        if (data === '[DONE]') {
          sawDone = true;
          continue;
        }

        result = JSON.parse(data) as MoodOutfitResponse;
      }
    }

    if (!sawDone || !result) {
      throw new Error('Mood outfit generation did not complete');
    }

    return result;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Mood outfit request timed out');
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

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

  const { data: outfitData } = useOutfit(generatedOutfit?.id);

  const generate = async (mood: string) => {
    if (!isPremium) {
      setShowPaywall(true);
      return;
    }
    if (!user) return;

    setSelectedMood(mood);
    setIsGenerating(true);

    try {
      const data = await readMoodOutfitSse(
        mood,
        weather ? { temperature: weather.temperature, precipitation: weather.precipitation } : undefined,
        locale,
      );
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

      trackEvent('outfit_generated', { occasion: `mood:${mood}`, mode: 'mood' });
      trackEvent('outfit_saved', { outfit_id: outfit.id, occasion: `mood:${mood}` });

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

  const selectedMoodData = MOODS.find((m) => m.key === generatedOutfit?.mood);

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
              <p className="label-editorial text-muted-foreground/60 text-[0.65rem] uppercase tracking-[0.16em]">
                {t(`ai.mood_${generatedOutfit.mood}`)}
              </p>
              <h2 className="font-display italic text-[1.4rem] leading-tight text-foreground">
                Your look is ready
              </h2>
            </motion.div>

            {/* Outfit preview card */}
            <motion.div
              {...motionProps}
              transition={{ ease: EASE_CURVE, duration: DURATION_MEDIUM, delay: 0.06 }}
              className="cursor-pointer"
              onClick={() => {
                hapticLight();
                navigate(`/outfits/${generatedOutfit.id}`);
              }}
            >
              <OutfitPreviewCard
                items={outfitData?.outfit_items ?? null}
                density="compact"
                mediaLayout="square"
                className="rounded-[1.25rem]"
                compositionClassName="rounded-[1rem]"
              />
            </motion.div>

            {/* Explanation card with accent left border */}
            {generatedOutfit.explanation ? (
              <motion.div
                {...motionProps}
                transition={{ ease: EASE_CURVE, duration: DURATION_MEDIUM, delay: 0.1 }}
              >
                <Card
                  surface="default"
                  className="space-y-3 rounded-[1.25rem] p-5"
                  style={{ borderLeft: `3px solid ${selectedMoodData?.accent ?? '#C9A86C'}` }}
                >
                  <p className="label-editorial text-muted-foreground/60 text-[0.65rem] uppercase tracking-[0.16em]">
                    Why it works
                  </p>
                  <p className="font-body text-sm leading-7 text-muted-foreground">{generatedOutfit.explanation}</p>
                </Card>
              </motion.div>
            ) : null}

            {/* Action buttons */}
            <motion.div
              {...motionProps}
              transition={{ ease: EASE_CURVE, duration: DURATION_MEDIUM, delay: 0.14 }}
              className="flex flex-col gap-3"
            >
              <Button
                className="rounded-full w-full justify-center"
                onClick={() => {
                  hapticLight();
                  navigate(`/outfits/${generatedOutfit.id}`);
                }}
              >
                View outfit
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
              <Button
                variant="quiet"
                className="w-full justify-center rounded-full"
                onClick={() => { hapticLight(); handleReMood(); }}
              >
                Generate another
              </Button>
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
              <p className="label-editorial text-muted-foreground/60 text-[0.65rem] uppercase tracking-[0.16em]">
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
                      surface="default"
                      tone={isSelected ? 'inverse' : 'default'}
                      className={cn(
                        'h-full min-h-[5.5rem] overflow-hidden rounded-[1.25rem] p-4 transition-colors duration-200',
                        isGenerating && !isSelected ? 'opacity-55' : '',
                      )}
                      style={{ borderTop: `2px solid ${mood.accent}` }}
                    >
                      {isSelected ? (
                        <div className="flex h-full items-center justify-center">
                          <motion.div
                            className="h-3 w-3 rounded-full"
                            style={{ backgroundColor: mood.accent }}
                            animate={{ scale: [1, 1.4, 1], opacity: [0.6, 1, 0.6] }}
                            transition={{ duration: 1.4, repeat: Infinity }}
                          />
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2">
                          <span className="font-display italic text-[0.95rem] text-foreground">
                            {t(`ai.mood_${mood.key}`)}
                          </span>
                          <span className="label-editorial text-muted-foreground/60 text-[0.6rem]">
                            {mood.hint}
                          </span>
                          <div className="flex gap-1.5 pt-1">
                            {mood.palette.map((color, i) => (
                              <span
                                key={i}
                                className="h-2.5 w-2.5 rounded-full"
                                style={{ backgroundColor: color }}
                              />
                            ))}
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
