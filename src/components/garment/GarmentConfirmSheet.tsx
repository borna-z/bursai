import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Loader2 } from 'lucide-react';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { LazyImageSimple } from '@/components/ui/lazy-image';
import { PaywallModal } from '@/components/PaywallModal';
import { useSubscription } from '@/hooks/useSubscription';
import { useProfile, useUpdateProfile } from '@/hooks/useProfile';
import { invokeEdgeFunction } from '@/lib/edgeFunctionClient';
import { supabase } from '@/integrations/supabase/client';
import { asPreferences } from '@/types/preferences';
import { categoryLabel, colorLabel, materialLabel, fitLabel } from '@/lib/humanize';
import { useLanguage } from '@/contexts/LanguageContext';
import type { Json } from '@/integrations/supabase/types';

type RenderState = 'idle' | 'rendering' | 'done' | 'failed';

interface GarmentConfirmSheetProps {
  open: boolean;
  garmentId: string;
  garmentImagePath: string | null;
  detectedTitle: string;
  detectedCategory: string;
  detectedColor: string;
  detectedMaterial: string | null;
  detectedFit: string | null;
  formalityScore: number | null;
  onClose: () => void;
}

export function GarmentConfirmSheet({
  open,
  garmentId,
  garmentImagePath,
  detectedTitle,
  detectedCategory,
  detectedColor,
  detectedMaterial,
  detectedFit,
  onClose,
}: GarmentConfirmSheetProps) {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { isPremium } = useSubscription();
  const { data: profile } = useProfile();
  const updateProfile = useUpdateProfile();

  const [renderState, setRenderState] = useState<RenderState>('idle');
  const [renderedImagePath, setRenderedImagePath] = useState<string | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
  }, []);

  const startRender = useCallback(async () => {
    if (!garmentId) return;
    setRenderState('rendering');

    // Fire the render edge function
    invokeEdgeFunction('render_garment_image', {
      body: { garmentId },
      timeout: 60000,
      retries: 0,
    }).catch(() => {
      // Edge function fire-and-forget — we poll for result
    });

    // Poll garment row every 2s
    pollRef.current = setInterval(async () => {
      const { data } = await supabase
        .from('garments')
        .select('render_status, rendered_image_path')
        .eq('id', garmentId)
        .maybeSingle();

      if (!data) return;

      if (data.render_status === 'ready' && data.rendered_image_path) {
        stopPolling();
        setRenderedImagePath(data.rendered_image_path);
        setRenderState('done');
      } else if (data.render_status === 'failed' || data.render_status === 'skipped') {
        stopPolling();
        setRenderState('failed');
      }
    }, 2000);

    // Timeout after 60s
    timeoutRef.current = setTimeout(() => {
      stopPolling();
      setRenderState((prev) => (prev === 'rendering' ? 'failed' : prev));
    }, 60000);
  }, [garmentId, stopPolling]);

  const handleGenerateClick = useCallback(() => {
    if (!isPremium) {
      setShowPaywall(true);
      return;
    }
    startRender();
  }, [isPremium, startRender]);

  const handleSaveAndGo = useCallback(() => {
    onClose();
    navigate('/wardrobe');
  }, [onClose, navigate]);

  const handleSaveOriginal = useCallback(async () => {
    // Reset render so getPreferredGarmentImagePath uses original
    await supabase
      .from('garments')
      .update({ rendered_image_path: null, render_status: 'none' })
      .eq('id', garmentId);
    onClose();
    navigate('/wardrobe');
  }, [garmentId, onClose, navigate]);

  const handleTurnOffRenders = useCallback(async () => {
    const currentPrefs = asPreferences(profile?.preferences);
    try {
      await updateProfile.mutateAsync({
        preferences: { ...currentPrefs, showRenderPrompt: false } as unknown as Json,
      });
    } catch {
      // Non-blocking
    }
    onClose();
    navigate('/wardrobe');
  }, [profile, updateProfile, onClose, navigate]);

  const handleRetry = useCallback(() => {
    setRenderState('idle');
    setRenderedImagePath(null);
  }, []);

  // Build chips
  const chips: string[] = [];
  if (detectedCategory) chips.push(categoryLabel(t, detectedCategory));
  if (detectedColor) chips.push(colorLabel(t, detectedColor));
  if (detectedMaterial) chips.push(materialLabel(t, detectedMaterial));
  if (detectedFit) chips.push(fitLabel(t, detectedFit));

  return (
    <>
      <Sheet open={open} onOpenChange={(v) => { if (!v) handleSaveAndGo(); }}>
        <SheetContent side="bottom" className="!p-0 !rounded-none border-t border-border/10" style={{ background: '#F5F0E8' }}>
          {/* Visually hidden title for accessibility */}
          <SheetTitle className="sr-only">Garment saved</SheetTitle>

          <div style={{ padding: '12px 20px 20px', maxWidth: 512, margin: '0 auto' }}>
            {/* Drag handle */}
            <div style={{
              width: 36, height: 3, background: 'rgba(28,25,23,0.15)', borderRadius: 2,
              margin: '0 auto 12px',
            }} />

            {/* ── Photo + detected info ── */}
            <div style={{ display: 'flex', gap: 14, marginBottom: 16 }}>
              {/* Photo area */}
              <div style={{ width: 72, height: 96, flexShrink: 0, position: 'relative', overflow: 'hidden', background: '#EDE8DF' }}>
                {renderState === 'done' && renderedImagePath ? (
                  /* Side-by-side split */
                  <div style={{ display: 'flex', width: '100%', height: '100%' }}>
                    <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                      <LazyImageSimple imagePath={garmentImagePath ?? undefined} alt="Original" className="w-full h-full" />
                      <span style={{
                        position: 'absolute', bottom: 2, left: 2,
                        fontFamily: 'DM Sans, sans-serif', fontSize: 7.5, color: 'rgba(28,25,23,0.4)',
                      }}>Original</span>
                    </div>
                    <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                      <LazyImageSimple imagePath={renderedImagePath} alt="Studio" className="w-full h-full" />
                      <span style={{
                        position: 'absolute', bottom: 2, right: 2,
                        fontFamily: 'DM Sans, sans-serif', fontSize: 7.5, color: 'rgba(28,25,23,0.4)',
                      }}>Studio</span>
                    </div>
                  </div>
                ) : (
                  <>
                    <LazyImageSimple imagePath={garmentImagePath ?? undefined} alt={detectedTitle} className="w-full h-full" />
                    {renderState === 'rendering' && (
                      <div style={{
                        position: 'absolute', inset: 0, background: 'rgba(28,25,23,0.6)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Loader2 className="w-5 h-5 text-background animate-spin" />
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Detected info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  fontFamily: '"Playfair Display", serif', fontStyle: 'italic',
                  fontSize: 18, color: '#1C1917', margin: 0, lineHeight: 1.3,
                }}>
                  {detectedTitle}
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
                  {chips.map((chip) => (
                    <span key={chip} style={{
                      background: '#EDE8DF', padding: '2px 7px',
                      fontFamily: 'DM Sans, sans-serif', fontSize: 9,
                      color: 'rgba(28,25,23,0.5)', textTransform: 'capitalize',
                    }}>
                      {chip}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* ── IDLE STATE ── */}
            {renderState === 'idle' && (
              <>
                {/* Primary row: equal-width, equal-height side-by-side buttons */}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={handleGenerateClick}
                    style={{
                      flex: 1, height: 44, background: '#1C1917', border: 'none', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    }}
                  >
                    <Sparkles style={{ width: 12, height: 12, color: 'rgba(245,240,232,0.6)', flexShrink: 0 }} />
                    <span style={{
                      fontFamily: '"Playfair Display", serif', fontStyle: 'italic',
                      fontSize: 12, color: '#F5F0E8',
                    }}>
                      Generate Studio Look
                    </span>
                  </button>

                  <button
                    onClick={handleSaveAndGo}
                    style={{
                      flex: 1, height: 44, background: '#EDE8DF', border: 'none', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <span style={{
                      fontFamily: 'DM Sans, sans-serif', fontSize: 12, color: '#1C1917',
                    }}>
                      Save to wardrobe →
                    </span>
                  </button>
                </div>

                {/* Tertiary: Turn off renders */}
                <div style={{ textAlign: 'center', marginTop: 8 }}>
                  <button
                    onClick={handleTurnOffRenders}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontFamily: 'DM Sans, sans-serif', fontSize: 9, color: 'rgba(28,25,23,0.35)',
                    }}
                  >
                    Turn off renders
                  </button>
                </div>
              </>
            )}

            {/* ── RENDERING STATE ── */}
            {renderState === 'rendering' && (
              <>
                <p style={{
                  fontFamily: 'DM Sans, sans-serif', fontSize: 9.5,
                  color: 'rgba(28,25,23,0.5)', textAlign: 'center', margin: '0 0 8px',
                }}>
                  Generating studio look...
                </p>
                <div style={{ textAlign: 'center' }}>
                  <button
                    onClick={handleSaveAndGo}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontFamily: 'DM Sans, sans-serif', fontSize: 9, color: 'rgba(28,25,23,0.4)',
                    }}
                  >
                    Save original instead →
                  </button>
                </div>
              </>
            )}

            {/* ── DONE STATE ── */}
            {renderState === 'done' && (
              <>
                <button
                  onClick={handleSaveAndGo}
                  style={{
                    width: '100%', height: 44, background: '#1C1917', color: '#F5F0E8',
                    border: 'none', fontFamily: 'DM Sans, sans-serif', fontSize: 12,
                    fontWeight: 500, cursor: 'pointer',
                  }}
                >
                  Save with Studio Look
                </button>
                <div style={{
                  display: 'flex', justifyContent: 'center', gap: 16, marginTop: 10,
                }}>
                  <button
                    onClick={handleSaveOriginal}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontFamily: 'DM Sans, sans-serif', fontSize: 9, color: 'rgba(28,25,23,0.4)',
                    }}
                  >
                    Use original
                  </button>
                  <button
                    onClick={handleTurnOffRenders}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontFamily: 'DM Sans, sans-serif', fontSize: 9, color: 'rgba(28,25,23,0.35)',
                    }}
                  >
                    Turn off renders
                  </button>
                </div>
              </>
            )}

            {/* ── FAILED STATE ── */}
            {renderState === 'failed' && (
              <>
                <p style={{
                  fontFamily: '"Playfair Display", serif', fontStyle: 'italic',
                  fontSize: 12, color: 'rgba(28,25,23,0.5)', textAlign: 'center',
                  margin: '0 0 10px',
                }}>
                  Studio render unavailable.
                </p>
                <div style={{ textAlign: 'center' }}>
                  <button
                    onClick={handleSaveAndGo}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontFamily: 'DM Sans, sans-serif', fontSize: 10, color: '#1C1917',
                      borderBottom: '0.5px solid rgba(28,25,23,0.25)', paddingBottom: 1,
                    }}
                  >
                    Save to wardrobe →
                  </button>
                </div>
                <div style={{ textAlign: 'center', marginTop: 6 }}>
                  <button
                    onClick={handleRetry}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontFamily: 'DM Sans, sans-serif', fontSize: 9, color: 'rgba(28,25,23,0.4)',
                    }}
                  >
                    Try again
                  </button>
                </div>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <PaywallModal isOpen={showPaywall} onClose={() => setShowPaywall(false)} reason="garments" />
    </>
  );
}
