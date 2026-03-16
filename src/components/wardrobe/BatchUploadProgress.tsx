import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, AlertCircle, Upload, Sparkles, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useStorage } from '@/hooks/useStorage';
import { useAnalyzeGarment } from '@/hooks/useAnalyzeGarment';
import { useCreateGarment } from '@/hooks/useGarments';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { invokeEdgeFunction } from '@/lib/edgeFunctionClient';
import type { Json } from '@/integrations/supabase/types';

interface BatchItem {
  file: File;
  preview: string;
  status: 'waiting' | 'uploading' | 'analyzing' | 'done' | 'error';
  error?: string;
}

interface BatchUploadProgressProps {
  files: File[];
  onComplete: () => void;
  onCancel: () => void;
}

export function BatchUploadProgress({ files, onComplete, onCancel }: BatchUploadProgressProps) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { uploadGarmentImage } = useStorage();
  const { analyzeGarment } = useAnalyzeGarment();
  const createGarment = useCreateGarment();
  const [items, setItems] = useState<BatchItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const processedRef = useRef(false);

  // Initialize items with previews
  useEffect(() => {
    const newItems: BatchItem[] = files.map(file => ({
      file,
      preview: URL.createObjectURL(file),
      status: 'waiting' as const,
    }));
    setItems(newItems);
    return () => newItems.forEach(item => URL.revokeObjectURL(item.preview));
  }, [files]);

  // Process queue
  useEffect(() => {
    if (processedRef.current || !user || items.length === 0 || isProcessing) return;
    if (currentIndex >= items.length) {
      processedRef.current = true;
      const doneCount = items.filter(i => i.status === 'done').length;
      toast.success(`${doneCount}/${items.length} ${t('batch.complete_toast')}`);
      setTimeout(onComplete, 800);
      return;
    }

    const processItem = async () => {
      setIsProcessing(true);
      const garmentId = crypto.randomUUID();
      const fileExt = items[currentIndex].file.name.split('.').pop() || 'jpg';
      const path = `${user.id}/${garmentId}.${fileExt}`;

      // Upload
      updateItem(currentIndex, { status: 'uploading' });
      try {
        await uploadGarmentImage(items[currentIndex].file, garmentId);
      } catch {
        updateItem(currentIndex, { status: 'error', error: t('batch.upload_failed') });
        setCurrentIndex(i => i + 1);
        setIsProcessing(false);
        return;
      }

      // Analyze
      updateItem(currentIndex, { status: 'analyzing' });
      try {
        const { data, error } = await analyzeGarment(path);
        if (error || !data) {
          updateItem(currentIndex, { status: 'error', error: error || t('batch.analyze_failed') });
          setCurrentIndex(i => i + 1);
          setIsProcessing(false);
          return;
        }

        // Save with AI defaults
        await createGarment.mutateAsync({
          id: garmentId,
          image_path: path,
          title: data.title,
          category: data.category,
          subcategory: data.subcategory || null,
          color_primary: data.color_primary,
          color_secondary: data.color_secondary || null,
          pattern: data.pattern || null,
          material: data.material || null,
          fit: data.fit || null,
          season_tags: data.season_tags || null,
          formality: data.formality || 3,
          in_laundry: false,
        });

        updateItem(currentIndex, { status: 'done' });
      } catch {
        updateItem(currentIndex, { status: 'error', error: t('batch.save_failed') });
      }

      setCurrentIndex(i => i + 1);
      setIsProcessing(false);
    };

    processItem();
  }, [currentIndex, items.length, isProcessing, user]);

  const updateItem = (index: number, updates: Partial<BatchItem>) => {
    setItems(prev => prev.map((item, i) => i === index ? { ...item, ...updates } : item));
  };

  const doneCount = items.filter(i => i.status === 'done').length;
  const errorCount = items.filter(i => i.status === 'error').length;
  const totalProgress = items.length > 0 ? ((doneCount + errorCount) / items.length) * 100 : 0;

  return (
    <div className="min-h-screen bg-background">
      <div className="p-4 flex items-center justify-between border-b border-border/40">
        <h2 className="text-lg font-semibold">{t('batch.title')}</h2>
        <Button variant="ghost" size="icon" onClick={onCancel}>
          <X className="w-5 h-5" />
        </Button>
      </div>

      <div className="p-4 space-y-4">
        {/* Total progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {doneCount}/{items.length} {t('batch.analyzed')}
            </span>
            {errorCount > 0 && (
              <span className="text-destructive text-xs">{errorCount} {t('batch.errors')}</span>
            )}
          </div>
          <Progress value={totalProgress} className="h-2" />
        </div>

        {/* Item grid */}
        <div className="grid grid-cols-3 gap-3">
          <AnimatePresence>
            {items.map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
                className="relative aspect-square rounded-xl overflow-hidden bg-muted"
              >
                <img
                  src={item.preview}
                  alt=""
                  className={cn(
                    'w-full h-full object-cover transition-opacity',
                    item.status === 'error' && 'opacity-40'
                  )}
                />
                {/* Status overlay */}
                <div className={cn(
                  'absolute inset-0 flex items-center justify-center',
                  item.status === 'done' && 'bg-black/20',
                  item.status === 'error' && 'bg-destructive/10',
                  (item.status === 'uploading' || item.status === 'analyzing') && 'bg-black/30'
                )}>
                  {item.status === 'waiting' && (
                    <div className="w-6 h-6 rounded-full bg-background/60 backdrop-blur-sm flex items-center justify-center">
                      <span className="text-xs text-muted-foreground">{index + 1}</span>
                    </div>
                  )}
                  {item.status === 'uploading' && (
                    <div className="flex flex-col items-center gap-1">
                      <div className="relative w-7 h-7 flex items-center justify-center">
                        <motion.div
                          className="absolute inset-0 rounded-full border border-white/30"
                          animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
                          transition={{ duration: 1.2, repeat: Infinity, ease: 'easeOut' }}
                        />
                        <Upload className="w-4 h-4 text-white z-10" />
                      </div>
                      <span className="text-[10px] text-white font-medium">{t('batch.uploading')}</span>
                    </div>
                  )}
                  {item.status === 'analyzing' && (
                    <div className="flex flex-col items-center gap-1">
                      <div className="relative w-7 h-7 flex items-center justify-center">
                        <motion.div
                          className="absolute inset-0 rounded-full border border-white/30"
                          animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
                          transition={{ duration: 1.2, repeat: Infinity, ease: 'easeOut' }}
                        />
                        <Sparkles className="w-4 h-4 text-white z-10" />
                      </div>
                      <span className="text-[10px] text-white font-medium">{t('batch.analyzing')}</span>
                    </div>
                  )}
                  {item.status === 'done' && (
                    <CheckCircle className="w-7 h-7 text-white drop-shadow-md" />
                  )}
                  {item.status === 'error' && (
                    <AlertCircle className="w-7 h-7 text-destructive drop-shadow-md" />
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Hint */}
        <p className="text-xs text-muted-foreground text-center">
          {t('batch.hint')}
        </p>
      </div>
    </div>
  );
}
