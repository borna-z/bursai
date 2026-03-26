import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { StyleMeSubNav } from '@/components/ai/StyleMeSubNav';
import { AnimatedPage } from '@/components/ui/animated-page';
import { Button } from '@/components/ui/button';
import { OutfitGenerationState } from '@/components/ui/OutfitGenerationState';
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
  } | null>(null);

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

      const items = data.items.map((i: { garment_id: string; slot: string }) => ({
        outfit_id: outfit.id,
        garment_id: i.garment_id,
        slot: i.slot,
      }));

      await supabase.from('outfit_items').insert(items);

      setGeneratedOutfit({ id: outfit.id, explanation: data.explanation || null, mood });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('common.something_wrong'));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleReMood = () => {
    setGeneratedOutfit(null);
    setSelectedMood(null);
    setIsGenerating(false);
  };

  return (
    <AppLayout>
      <StyleMeSubNav />
      <PageHeader title={t('ai.mood_title')} showBack />
      <AnimatedPage className="max-w-lg mx-auto px-4 pb-8 pt-4">

        {generatedOutfit ? (
          /* ── Result screen ── */
          <div className="space-y-2">
            {/* Outfit card */}
            <div className="bg-card rounded-none px-5 py-4">
              <p className="font-['DM_Sans'] text-[10px] uppercase tracking-[0.1em] text-foreground/40">
                MOOD OUTFIT
              </p>
              <p className="font-['Playfair_Display'] italic text-xl text-foreground mt-1.5">
                {t(`ai.mood_${generatedOutfit.mood}`)}
              </p>
              <button
                onClick={() => navigate(`/outfits/${generatedOutfit.id}`)}
                className="mt-2 text-xs font-['DM_Sans'] text-foreground/50 bg-transparent border-none cursor-pointer p-0"
              >
                View full outfit →
              </button>
            </div>

            {/* AI explanation card */}
            {generatedOutfit.explanation && (
              <div className="bg-card rounded-none px-5 py-4">
                <p className="font-['DM_Sans'] text-[10px] uppercase tracking-[0.1em] text-foreground/40 mb-2">
                  WHY THIS MATCHES {generatedOutfit.mood.toUpperCase()}
                </p>
                <p className="font-['DM_Sans'] text-sm text-foreground/70 leading-relaxed">
                  {generatedOutfit.explanation}
                </p>
              </div>
            )}

            {/* Refine in chat button */}
            <Button
              variant="outline"
              onClick={() => navigate('/ai/chat', { state: { outfitId: generatedOutfit.id } })}
              className="block w-full h-12 bg-transparent border border-foreground/30 rounded-none font-['DM_Sans'] text-sm text-foreground mt-2"
            >
              Refine in chat
            </Button>

            {/* Re-mood */}
            <button
              onClick={handleReMood}
              className="block w-full mt-3 text-center font-['DM_Sans'] text-xs text-foreground/50 bg-transparent border-none cursor-pointer py-1"
            >
              Try a different mood →
            </button>
          </div>
        ) : (
          /* ── Mood grid ── */
          <>
            <div className="text-center space-y-2 mb-8">
              <h2 className="font-['Playfair_Display'] italic text-[22px] text-foreground">
                {t('ai.mood_heading')}
              </h2>
              <p className="text-sm text-muted-foreground">{t('ai.mood_desc')}</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {MOODS.map((mood, i) => {
                const isSelected = selectedMood === mood.key && isGenerating;
                return (
                  <motion.div
                    key={mood.key}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.06 }}
                  >
                    <div
                      className={`rounded-none min-h-[80px] p-4 flex flex-col justify-center gap-2 ${
                        isSelected ? 'bg-foreground' : 'bg-card'
                      } ${isGenerating ? 'cursor-default' : 'cursor-pointer'}`}
                      onClick={() => !isGenerating && generate(mood.key)}
                    >
                      {isSelected ? (
                        <OutfitGenerationState
                          variant="compact"
                          tone="expressive"
                          subtitle={t(`ai.mood_${mood.key}`)}
                          className="border-0 bg-transparent p-0"
                        />
                      ) : (
                        <>
                          <div
                            className="w-4 h-4 rounded-none shrink-0"
                            style={{ backgroundColor: mood.swatchColor }}
                          />
                          <p className="font-['Playfair_Display'] italic text-base text-foreground m-0">
                            {t(`ai.mood_${mood.key}`)}
                          </p>
                        </>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </>
        )}
      </AnimatedPage>
      <PaywallModal isOpen={showPaywall} onClose={() => setShowPaywall(false)} reason="outfits" />
    </AppLayout>
  );
}
