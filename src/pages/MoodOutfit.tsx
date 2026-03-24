import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { AnimatedPage } from '@/components/ui/animated-page';
import { OutfitGenerationState } from '@/components/ui/OutfitGenerationState';
import { LazyImageSimple } from '@/components/ui/lazy-image';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSubscription } from '@/hooks/useSubscription';
import { useWeather } from '@/hooks/useWeather';
import { useAuth } from '@/contexts/AuthContext';
import { useGarmentsByIds } from '@/hooks/useGarmentsByIds';
import { PaywallModal } from '@/components/PaywallModal';
import { supabase } from '@/integrations/supabase/client';
import { invokeEdgeFunction } from '@/lib/edgeFunctionClient';
import { getPreferredGarmentImagePath } from '@/lib/garmentImage';
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
    garmentIds: string[];
  } | null>(null);

  const { data: outfitGarments } = useGarmentsByIds(generatedOutfit?.garmentIds ?? []);

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

      setGeneratedOutfit({
        id: outfit.id,
        explanation: data.explanation || null,
        mood,
        garmentIds: data.items.map((i: { garment_id: string; slot: string }) => i.garment_id),
      });
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
      <PageHeader title={t('ai.mood_title')} showBack />
      <AnimatedPage className="max-w-lg mx-auto px-4 pb-8 pt-4">

        {generatedOutfit ? (
          /* ── Result screen ── */
          <div className="space-y-2">
            {/* Outfit card with garment images */}
            <div
              style={{ backgroundColor: '#EDE8DF', borderRadius: 0, overflow: 'hidden', cursor: 'pointer' }}
              onClick={() => navigate(`/outfits/${generatedOutfit.id}`)}
            >
              {/* Garment image grid */}
              {outfitGarments && outfitGarments.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                  {outfitGarments.slice(0, 4).map((garment, i) => (
                    <div key={garment.id} style={{ height: 130, backgroundColor: '#DDD8CF', overflow: 'hidden' }}>
                      <LazyImageSimple
                        imagePath={getPreferredGarmentImagePath(garment)}
                        alt={garment.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              )}
              <div style={{ padding: '14px 20px' }}>
                <p style={{
                  fontFamily: 'DM Sans, sans-serif', fontSize: 10,
                  textTransform: 'uppercase', letterSpacing: '0.1em',
                  color: 'rgba(28,25,23,0.4)',
                }}>
                  MOOD OUTFIT · {t(`ai.mood_${generatedOutfit.mood}`).toUpperCase()}
                </p>
                <p style={{
                  fontFamily: '"Playfair Display", serif', fontStyle: 'italic',
                  fontSize: 18, color: '#1C1917', marginTop: 4,
                }}>
                  {t(`ai.mood_${generatedOutfit.mood}`)}
                </p>
                <p style={{
                  marginTop: 4, fontSize: 11, fontFamily: 'DM Sans, sans-serif',
                  color: 'rgba(28,25,23,0.4)',
                }}>
                  View full outfit →
                </p>
              </div>
            </div>

            {/* AI explanation card */}
            {generatedOutfit.explanation && (
              <div style={{ backgroundColor: '#EDE8DF', borderRadius: 0, padding: '16px 20px' }}>
                <p style={{
                  fontFamily: 'DM Sans, sans-serif', fontSize: 10,
                  textTransform: 'uppercase', letterSpacing: '0.1em',
                  color: 'rgba(28,25,23,0.4)', marginBottom: 8,
                }}>
                  WHY THIS MATCHES {generatedOutfit.mood.toUpperCase()}
                </p>
                <p style={{
                  fontFamily: 'DM Sans, sans-serif', fontSize: 14,
                  color: 'rgba(28,25,23,0.7)', lineHeight: 1.6,
                }}>
                  {generatedOutfit.explanation}
                </p>
              </div>
            )}

            {/* Refine in chat button */}
            <button
              onClick={() => navigate('/ai', { state: { outfitId: generatedOutfit.id, mood: generatedOutfit.mood } })}
              style={{
                display: 'block', width: '100%', height: 48,
                background: 'transparent', border: '1px solid rgba(28,25,23,0.3)',
                borderRadius: 0, fontFamily: 'DM Sans, sans-serif',
                fontSize: 14, color: '#1C1917', cursor: 'pointer',
                marginTop: 8,
              }}
            >
              Refine in chat
            </button>

            {/* Re-mood */}
            <button
              onClick={handleReMood}
              style={{
                display: 'block', width: '100%', marginTop: 12,
                textAlign: 'center', fontFamily: 'DM Sans, sans-serif',
                fontSize: 12, color: 'rgba(28,25,23,0.5)',
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '4px 0',
              }}
            >
              Try a different mood →
            </button>
          </div>
        ) : (
          /* ── Mood grid ── */
          <>
            <div className="text-center space-y-2 mb-8">
              <h2 style={{
                fontFamily: '"Playfair Display", serif', fontStyle: 'italic',
                fontSize: 22, color: '#1C1917',
              }}>
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
                      style={{
                        backgroundColor: isSelected ? '#1C1917' : '#EDE8DF',
                        borderRadius: 0,
                        minHeight: 80,
                        padding: '16px',
                        cursor: isGenerating ? 'default' : 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        gap: 8,
                      }}
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
                          <div style={{
                            width: 16, height: 16,
                            backgroundColor: mood.swatchColor,
                            borderRadius: 0, flexShrink: 0,
                          }} />
                          <p style={{
                            fontFamily: '"Playfair Display", serif',
                            fontStyle: 'italic', fontSize: 16,
                            color: '#1C1917', margin: 0,
                          }}>
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
