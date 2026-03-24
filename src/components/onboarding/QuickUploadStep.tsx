import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Camera, ImagePlus, ArrowRight, Check, X } from 'lucide-react';
import { EASE_CURVE } from '@/lib/motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useStorage } from '@/hooks/useStorage';
import { useAnalyzeGarment } from '@/hooks/useAnalyzeGarment';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { useIsDark } from '@/hooks/useIsDark';
import { invokeEdgeFunction } from '@/lib/edgeFunctionClient';
import { standardizeGarmentAiRaw } from '@/lib/garmentIntelligence';

interface QuickUploadStepProps {
  onComplete: () => void;
  onSkip: () => void;
}

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.08, duration: 0.4, ease: EASE_CURVE },
  }),
};

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
  const dark = useIsDark();
  const [items, setItems] = useState<UploadItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const newItems: UploadItem[] = [];
    const remaining = 5 - items.length;
    for (let i = 0; i < Math.min(files.length, remaining); i++) {
      const file = files[i];
      if (!file.type.startsWith('image/')) continue;
      newItems.push({
        id: crypto.randomUUID(),
        file,
        preview: URL.createObjectURL(file),
        status: 'pending',
      });
    }
    setItems(prev => [...prev, ...newItems]);
  };

  const removeItem = (id: string) => {
    setItems(prev => {
      const item = prev.find(i => i.id === id);
      if (item) URL.revokeObjectURL(item.preview);
      return prev.filter(i => i.id !== id);
    });
  };

  const processAll = async () => {
    if (!user || items.length === 0) return;
    setIsProcessing(true);

    for (const item of items) {
      try {
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'uploading' } : i));
        const garmentId = crypto.randomUUID();
        const path = await uploadGarmentImage(item.file, garmentId);
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'analyzing' } : i));

        const { data: analysis, error: analysisError } = await analyzeGarment(path);
        if (analysisError) {
          console.error('Quick upload analysis error:', analysisError);
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
          }).catch((err) => {
            console.error('Quick upload duplicate detection error (non-blocking):', err);
          });
        }

        setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'done' } : i));
      } catch {
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'error' } : i));
      }
    }

    setIsProcessing(false);
    setTimeout(onComplete, 800);
  };

  const canAdd = items.length < 5;

  return (
    <div className={cn('min-h-screen flex flex-col items-center relative overflow-hidden', dark ? 'dark-landing' : 'bg-background text-foreground')}>
      {dark && (
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] rounded-full bg-[radial-gradient(ellipse,rgba(99,102,241,0.08)_0%,transparent_70%)] blur-3xl" />
        </div>
      )}

      <div className="relative z-10 w-full max-w-sm mx-auto px-6 pt-16 pb-12 flex flex-col items-center flex-1">
        <motion.div
          variants={fadeUp} initial="hidden" animate="show" custom={0}
          className={cn('w-14 h-14 flex items-center justify-center mb-5', dark ? 'rounded-2xl bg-accent/15' : 'bg-muted')}
        >
          <Camera className={cn('w-7 h-7', dark ? 'text-accent' : 'text-foreground')} />
        </motion.div>

        <motion.h1
          variants={fadeUp} initial="hidden" animate="show" custom={1}
          style={{
            fontFamily: '"Playfair Display", serif', fontStyle: 'italic',
            fontSize: 20, textAlign: 'center', maxWidth: 240, marginBottom: 8,
          }}
          className={cn(dark ? 'text-white' : 'text-foreground')}
        >
          Add your first piece.
        </motion.h1>

        <motion.p
          variants={fadeUp} initial="hidden" animate="show" custom={2}
          className={cn('text-sm text-center mb-8 max-w-xs', dark ? 'text-white/40' : 'text-muted-foreground')}
        >
          {t('onboarding.quickUpload.subtitle') || 'Snap or pick up to 5 items to kickstart your wardrobe. You can always add more later.'}
        </motion.p>

        {/* Image grid */}
        <motion.div
          variants={fadeUp} initial="hidden" animate="show" custom={3}
          className="w-full grid grid-cols-3 gap-3 mb-8"
        >
          {items.map((item) => (
            <div key={item.id} className={cn(
              'relative aspect-[3/4] overflow-hidden border',
              dark ? 'rounded-xl bg-white/[0.04] border-white/[0.06]' : 'bg-muted border-border'
            )}>
              <img src={item.preview} alt="" className="w-full h-full object-cover" />
              {item.status !== 'pending' && (
                <div className={cn(
                  'absolute inset-0 flex items-center justify-center',
                  item.status === 'done' ? 'bg-emerald-500/20' : item.status === 'error' ? 'bg-red-500/20' : 'bg-black/40'
                )}>
                  {item.status === 'uploading' && <div className="w-6 h-6 border-2 border-white/60 border-t-transparent rounded-full animate-spin" />}
                  {item.status === 'analyzing' && <div className="w-6 h-6 border-2 border-accent/80 border-t-transparent rounded-full animate-spin" />}
                  {item.status === 'done' && <Check className="w-6 h-6 text-emerald-400" />}
                  {item.status === 'error' && <X className="w-6 h-6 text-red-400" />}
                </div>
              )}
              {!isProcessing && (
                <button
                  onClick={() => removeItem(item.id)}
                  className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center"
                >
                  <X className="w-3.5 h-3.5 text-white/80" />
                </button>
              )}
            </div>
          ))}

          {canAdd && !isProcessing && (
            <button
              onClick={() => inputRef.current?.click()}
              className={cn(
                'aspect-[3/4] border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-colors',
                dark
                  ? 'rounded-xl border-white/[0.1] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.15]'
                  : 'border-border bg-card hover:bg-muted hover:border-foreground/20'
              )}
            >
              <ImagePlus className={cn('w-6 h-6', dark ? 'text-white/30' : 'text-muted-foreground')} />
              <span className={cn('text-[11px] font-medium', dark ? 'text-white/25' : 'text-muted-foreground')}>Add</span>
            </button>
          )}
        </motion.div>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />

        {/* Actions */}
        <motion.div
          variants={fadeUp} initial="hidden" animate="show" custom={4}
          className="w-full space-y-3 mt-auto"
        >
          {items.length > 0 ? (
            <button
              onClick={processAll}
              disabled={isProcessing}
              style={{
                width: '100%', height: 52, background: '#1C1917', color: '#F5F0E8',
                border: 'none', fontFamily: 'DM Sans, sans-serif', fontSize: 13, fontWeight: 500,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                opacity: isProcessing ? 0.6 : 1,
              }}
            >
              {isProcessing ? (
                <div className="w-5 h-5 border-2 border-[#F5F0E8]/40 border-t-[#F5F0E8] rounded-full animate-spin" />
              ) : (
                <>
                  Add {items.length} garment{items.length > 1 ? 's' : ''}
                  <ArrowRight style={{ width: 14, height: 14 }} />
                </>
              )}
            </button>
          ) : (
            <button
              onClick={() => inputRef.current?.click()}
              style={{
                width: '100%', height: 52, background: '#1C1917', color: '#F5F0E8',
                border: 'none', fontFamily: 'DM Sans, sans-serif', fontSize: 13, fontWeight: 500,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              <Camera style={{ width: 16, height: 16 }} />
              Choose photos
            </button>
          )}

          <button
            onClick={onSkip}
            disabled={isProcessing}
            style={{
              width: '100%', height: 40, background: 'none', border: 'none',
              fontFamily: 'DM Sans, sans-serif', fontSize: 11,
              color: 'rgba(28,25,23,0.32)', cursor: 'pointer',
            }}
          >
            {t('onboarding.skip') || 'Skip for now'}
          </button>
        </motion.div>
      </div>
    </div>
  );
}
