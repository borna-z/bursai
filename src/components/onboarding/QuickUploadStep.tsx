import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Camera, ImagePlus, ArrowRight, Check, X } from 'lucide-react';
import { EASE_CURVE } from '@/lib/motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useStorage } from '@/hooks/useStorage';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { cn } from '@/lib/utils';

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

        // Generate a garment ID for the file path
        const garmentId = crypto.randomUUID();
        const path = await uploadGarmentImage(item.file, garmentId);

        setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'analyzing' } : i));

        // Insert garment with the same ID
        await supabase.from('garments').insert({
          id: garmentId,
          user_id: user.id,
          image_path: path,
          title: item.file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ') || 'New garment',
          category: 'tops',
          color_primary: 'black',
        });

        // Trigger AI analysis (non-blocking)
        try {
          await supabase.functions.invoke('analyze_garment', {
            body: { image_path: path, user_id: user.id },
          });
        } catch {
          // Non-critical
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
    <div className="dark-landing min-h-screen flex flex-col items-center relative overflow-hidden">
      {/* Aurora */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] rounded-full bg-[radial-gradient(ellipse,rgba(99,102,241,0.08)_0%,transparent_70%)] blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-sm mx-auto px-6 pt-16 pb-12 flex flex-col items-center flex-1">
        <motion.div
          variants={fadeUp} initial="hidden" animate="show" custom={0}
          className="w-14 h-14 rounded-2xl bg-accent/15 flex items-center justify-center mb-5"
        >
          <Camera className="w-7 h-7 text-accent" />
        </motion.div>

        <motion.h1
          variants={fadeUp} initial="hidden" animate="show" custom={1}
          className="text-2xl font-bold text-white tracking-tight mb-2 text-center"
        >
          {t('onboarding.quickUpload.title') || 'Add a few garments'}
        </motion.h1>

        <motion.p
          variants={fadeUp} initial="hidden" animate="show" custom={2}
          className="text-white/40 text-sm text-center mb-8 max-w-xs"
        >
          {t('onboarding.quickUpload.subtitle') || 'Snap or pick up to 5 items to kickstart your wardrobe. You can always add more later.'}
        </motion.p>

        {/* Image grid */}
        <motion.div
          variants={fadeUp} initial="hidden" animate="show" custom={3}
          className="w-full grid grid-cols-3 gap-3 mb-8"
        >
          {items.map((item) => (
            <div key={item.id} className="relative aspect-[3/4] rounded-xl overflow-hidden bg-white/[0.04] border border-white/[0.06]">
              <img src={item.preview} alt="" className="w-full h-full object-cover" />
              {/* Status overlay */}
              {item.status !== 'pending' && (
                <div className={cn(
                  'absolute inset-0 flex items-center justify-center',
                  item.status === 'done' ? 'bg-emerald-500/20' : item.status === 'error' ? 'bg-red-500/20' : 'bg-black/40'
                )}>
                  {item.status === 'uploading' && (
                    <div className="w-6 h-6 border-2 border-white/60 border-t-transparent rounded-full animate-spin" />
                  )}
                  {item.status === 'analyzing' && (
                    <div className="w-6 h-6 border-2 border-accent/80 border-t-transparent rounded-full animate-spin" />
                  )}
                  {item.status === 'done' && <Check className="w-6 h-6 text-emerald-400" />}
                  {item.status === 'error' && <X className="w-6 h-6 text-red-400" />}
                </div>
              )}
              {/* Remove button (only when not processing) */}
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

          {/* Add button */}
          {canAdd && !isProcessing && (
            <button
              onClick={() => inputRef.current?.click()}
              className="aspect-[3/4] rounded-xl border-2 border-dashed border-white/[0.1] bg-white/[0.02] flex flex-col items-center justify-center gap-2 hover:bg-white/[0.04] hover:border-white/[0.15] transition-colors"
            >
              <ImagePlus className="w-6 h-6 text-white/30" />
              <span className="text-[11px] text-white/25 font-medium">Add</span>
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
              className={cn(
                'w-full h-12 rounded-xl font-semibold text-[15px] flex items-center justify-center gap-2 transition-all',
                'bg-white text-black hover:bg-white/90 active:scale-[0.98]',
                isProcessing && 'opacity-60 cursor-not-allowed'
              )}
            >
              {isProcessing ? (
                <div className="w-5 h-5 border-2 border-black/40 border-t-black rounded-full animate-spin" />
              ) : (
                <>
                  Add {items.length} garment{items.length > 1 ? 's' : ''}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          ) : (
            <button
              onClick={() => inputRef.current?.click()}
              className="w-full h-12 rounded-xl font-semibold text-[15px] flex items-center justify-center gap-2 bg-white text-black hover:bg-white/90 active:scale-[0.98] transition-all"
            >
              <Camera className="w-4.5 h-4.5" />
              Choose photos
            </button>
          )}

          <button
            onClick={onSkip}
            disabled={isProcessing}
            className="w-full h-10 text-sm text-white/30 hover:text-white/50 transition-colors"
          >
            {t('onboarding.skip') || 'Skip for now'}
          </button>
        </motion.div>
      </div>
    </div>
  );
}
