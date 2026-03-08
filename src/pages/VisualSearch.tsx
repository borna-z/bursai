import { useState, useRef } from 'react';
import { Camera, Upload, Search, Shirt, ShoppingBag, Sparkles, ArrowLeft, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
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

interface VisualMatch {
  detected_item: string;
  garment_id: string;
  confidence: number;
  reason: string;
}

interface VisualGap {
  detected_item: string;
  suggestion: string;
}

interface VisualResult {
  description: string;
  matches: VisualMatch[];
  gaps: VisualGap[];
}

export default function VisualSearchPage() {
  const { t, locale } = useLanguage();
  const { isPremium } = useSubscription();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<VisualResult | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);

  const handleFile = (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      toast.error(t('ai.file_too_large'));
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      setPreview(base64);
      setResult(null);
    };
    reader.readAsDataURL(file);
  };

  const analyze = async () => {
    if (!isPremium) { setShowPaywall(true); return; }
    if (!preview) return;
    setIsAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('visual_search', {
        body: { image_base64: preview, locale },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setResult(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('common.something_wrong'));
    } finally {
      setIsAnalyzing(false);
    }
  };

  const reset = () => { setPreview(null); setResult(null); };

  return (
    <AppLayout>
      <PageHeader title={t('ai.visual_search')} showBack />
      <AnimatedPage className="max-w-lg mx-auto px-4 pb-8 pt-4">
        {!preview ? (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                <Search className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-lg font-semibold">{t('ai.vs_title')}</h2>
              <p className="text-sm text-muted-foreground">{t('ai.vs_desc')}</p>
            </div>

            <input
              type="file"
              accept="image/*"
              ref={fileRef}
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />

            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                className="h-28 flex-col gap-2 rounded-2xl"
                onClick={() => { fileRef.current?.setAttribute('capture', 'environment'); fileRef.current?.click(); }}
              >
                <Camera className="w-6 h-6" />
                <span className="text-xs">{t('ai.vs_camera')}</span>
              </Button>
              <Button
                variant="outline"
                className="h-28 flex-col gap-2 rounded-2xl"
                onClick={() => { fileRef.current?.removeAttribute('capture'); fileRef.current?.click(); }}
              >
                <Upload className="w-6 h-6" />
                <span className="text-xs">{t('ai.vs_upload')}</span>
              </Button>
            </div>
          </div>
        ) : !result ? (
          <div className="space-y-6">
            <div className="relative rounded-2xl overflow-hidden aspect-[3/4]">
              <img src={preview} alt="Inspiration" className="w-full h-full object-cover" />
              {isAnalyzing && (
                <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
                  <Sparkles className="w-8 h-8 text-primary animate-pulse" />
                  <p className="text-sm font-medium">{t('ai.vs_analyzing')}</p>
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={reset}>
                <ArrowLeft className="w-4 h-4 mr-2" />{t('common.back')}
              </Button>
              <Button className="flex-1 rounded-xl" onClick={analyze} disabled={isAnalyzing}>
                <Search className="w-4 h-4 mr-2" />{t('ai.vs_find_matches')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="rounded-2xl overflow-hidden aspect-[3/4] relative">
              <img src={preview} alt="Inspiration" className="w-full h-full object-cover" />
              <div className="absolute bottom-3 left-3 right-3">
                <div className="bg-background/90 backdrop-blur-sm rounded-xl p-3">
                  <p className="text-sm">{result.description}</p>
                </div>
              </div>
            </div>

            {result.matches.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Shirt className="w-4 h-4 text-muted-foreground/50" />
                  <span className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wider">
                    {t('ai.vs_matches')} ({result.matches.length})
                  </span>
                </div>
                {result.matches.map((match, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                  >
                    <Card className="cursor-pointer hover:bg-accent/5 transition-colors"
                      onClick={() => navigate(`/wardrobe/${match.garment_id}`)}>
                      <CardContent className="p-3">
                        <div className="flex items-center gap-3">
                          <div className="w-14 h-16 rounded-xl flex-shrink-0 bg-muted flex items-center justify-center">
                            <Shirt className="w-5 h-5 text-muted-foreground/50" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{match.detected_item}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{match.reason}</p>
                          </div>
                          <div className="text-right">
                            <Badge variant={match.confidence >= 70 ? "default" : "secondary"} className="text-xs">
                              {match.confidence}%
                            </Badge>
                          </div>
                        </div>
                        <Progress value={match.confidence} className="h-1 mt-2" />
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}

            {result.gaps.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-muted-foreground/50" />
                  <span className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wider">
                    {t('ai.vs_gaps')} ({result.gaps.length})
                  </span>
                </div>
                {result.gaps.map((gap, i) => (
                  <Card key={i} className="border-dashed">
                    <CardContent className="p-3">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="w-4 h-4 text-warning mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-medium">{gap.detected_item}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{gap.suggestion}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            <Button variant="outline" className="w-full rounded-xl" onClick={reset}>
              {t('ai.vs_try_another')}
            </Button>
          </div>
        )}
      </AnimatedPage>
      <PaywallModal isOpen={showPaywall} onClose={() => setShowPaywall(false)} reason="outfits" />
    </AppLayout>
  );
}
