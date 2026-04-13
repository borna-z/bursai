import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Camera, Check, ImagePlus, X } from 'lucide-react';

import { Card } from '@/components/ui/card';
import { PageIntro } from '@/components/ui/page-intro';
import { Button } from '@/components/ui/button';
import { useAnalyzeGarment } from '@/hooks/useAnalyzeGarment';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useStorage } from '@/hooks/useStorage';
import { supabase } from '@/integrations/supabase/client';
import { invokeEdgeFunction } from '@/lib/edgeFunctionClient';
import { standardizeGarmentAiRaw } from '@/lib/garmentIntelligence';
import { EASE_CURVE } from '@/lib/motion';
import { logger } from '@/lib/logger';

interface QuickUploadStepProps {
  onComplete: () => void;
  onSkip: () => void;
}

interface UploadItem {
  id: string;
  file: File;
  preview: string;
  status: 'pending' | 'uploading' | 'analyzing' | 'done' | 'error';
}

export function QuickUploadStep({ onComplete, onSkip }: QuickUploadStepProps) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { uploadGarmentImage } = useStorage();
  const { analyzeGarment } = useAnalyzeGarment();

  const [items, setItems] = useState<UploadItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (files: FileList | null) => {
    if (!files) return;

    const newItems: UploadItem[] = [];
    const remaining = 5 - items.length;
    for (let index = 0; index < Math.min(files.length, remaining); index += 1) {
      const file = files[index];
      if (!file.type.startsWith('image/')) continue;

      newItems.push({
        id: crypto.randomUUID(),
        file,
        preview: URL.createObjectURL(file),
        status: 'pending',
      });
    }

    setItems((current) => [...current, ...newItems]);
  };

  const removeItem = (id: string) => {
    setItems((current) => {
      const item = current.find((entry) => entry.id === id);
      if (item) URL.revokeObjectURL(item.preview);
      return current.filter((entry) => entry.id !== id);
    });
  };

  const processAll = async () => {
    if (!user || items.length === 0) return;
    setIsProcessing(true);

    for (const item of items) {
      try {
        setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, status: 'uploading' } : entry));
        const garmentId = crypto.randomUUID();
        const path = await uploadGarmentImage(item.file, garmentId);

        setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, status: 'analyzing' } : entry));

        const { data: analysis, error: analysisError } = await analyzeGarment(path, 'fast');
        if (analysisError) {
          logger.error('Quick upload analysis error:', analysisError);
        }

        const fallbackTitle = item.file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ') || 'New garment';

        const { error: insertError } = await supabase.from('garments').insert({
          id: garmentId,
          user_id: user.id,
          image_path: path,
          title: analysis?.title || fallbackTitle,
          category: analysis?.category || 'top',
          subcategory: analysis?.subcategory || null,
          color_primary: analysis?.color_primary || 'black',
          color_secondary: analysis?.color_secondary || null,
          pattern: analysis?.pattern || null,
          material: analysis?.material || null,
          fit: analysis?.fit || null,
          season_tags: analysis?.season_tags || null,
          formality: analysis?.formality || 3,
          ai_analyzed_at: analysis ? new Date().toISOString() : null,
          ai_provider: analysis?.ai_provider || null,
          ai_raw: standardizeGarmentAiRaw({
            aiRaw: analysis?.ai_raw || null,
            analysisConfidence: analysis?.confidence,
            source: 'quick_upload',
          }),
          enrichment_status: analysis ? 'complete' : 'failed',
          imported_via: 'quick_upload',
        });

        if (insertError) throw insertError;

        if (analysis) {
          invokeEdgeFunction('detect_duplicate_garment', {
            body: {
              image_path: path,
              category: analysis.category,
              color_primary: analysis.color_primary,
              title: analysis.title,
              subcategory: analysis.subcategory,
              material: analysis.material,
              exclude_garment_id: garmentId,
            },
          }).catch((error) => {
            logger.error('Quick upload duplicate detection error (non-blocking):', error);
          });
        }

        setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, status: 'done' } : entry));
      } catch {
        setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, status: 'error' } : entry));
      }
    }

    setIsProcessing(false);
    setTimeout(onComplete, 800);
  };

  const canAdd = items.length < 5;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="page-shell !max-w-lg !px-6 !pb-16 !pt-[calc(var(--safe-area-top)+6rem)] page-cluster">
        <Card surface="editorial" className="p-6">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[1.35rem] bg-background/82 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
            <Camera className="h-7 w-7 text-foreground/72" />
          </div>
          <div className="mt-5">
            <PageIntro
              center
              eyebrow="Onboarding"
              title="Add your first piece."
              description={t('onboarding.quickUpload.subtitle') || 'Snap or pick up to 5 items to kickstart your wardrobe. You can always add more later.'}
            />
          </div>
        </Card>

        <Card surface="utility" className="space-y-4 p-5">
          <div className="grid grid-cols-3 gap-3">
            {items.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04, duration: 0.24, ease: EASE_CURVE }}
                className="relative aspect-[3/4] overflow-hidden rounded-[1.35rem] border border-border/60 bg-secondary/35"
              >
                <img src={item.preview} alt="" className="h-full w-full object-cover" />

                {item.status !== 'pending' ? (
                  <div
                    className={`absolute inset-0 flex items-center justify-center ${
                      item.status === 'done'
                        ? 'bg-emerald-500/20'
                        : item.status === 'error'
                          ? 'bg-red-500/20'
                          : 'bg-black/40'
                    }`}
                  >
                    {item.status === 'uploading' ? <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/60 border-t-transparent" /> : null}
                    {item.status === 'analyzing' ? <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent/80 border-t-transparent" /> : null}
                    {item.status === 'done' ? <Check className="h-6 w-6 text-emerald-400" /> : null}
                    {item.status === 'error' ? <X className="h-6 w-6 text-red-400" /> : null}
                  </div>
                ) : null}

                {!isProcessing ? (
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60"
                  >
                    <X className="h-3.5 w-3.5 text-white/80" />
                  </button>
                ) : null}
              </motion.div>
            ))}

            {canAdd && !isProcessing ? (
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="flex aspect-[3/4] flex-col items-center justify-center gap-2 rounded-[1.35rem] border-2 border-dashed border-border/70 bg-background/80 transition-colors hover:bg-secondary/45"
              >
                <ImagePlus className="h-6 w-6 text-muted-foreground" />
                <span className="text-[0.7rem] uppercase tracking-[0.18em] text-muted-foreground">Add</span>
              </button>
            ) : null}
          </div>

          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(event) => handleFiles(event.target.files)}
          />
        </Card>

        <div className="action-bar-floating rounded-[1.6rem] p-3">
          <div className="flex flex-col gap-2">
            {items.length > 0 ? (
              <Button onClick={processAll} disabled={isProcessing} size="lg" className="w-full">
                {isProcessing ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground" />
                ) : (
                  <>
                    Add {items.length} garment{items.length > 1 ? 's' : ''}
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            ) : (
              <Button onClick={() => inputRef.current?.click()} size="lg" className="w-full">
                <Camera className="h-4 w-4" />
                Choose photos
              </Button>
            )}

            <Button variant="quiet" onClick={onSkip} disabled={isProcessing} className="w-full">
              {t('onboarding.skip') || 'Skip for now'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
