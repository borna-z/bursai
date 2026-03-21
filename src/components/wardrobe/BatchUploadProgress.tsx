import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, AlertCircle, Upload, Sparkles, X, Clock3, ArrowRight, SkipForward } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useStorage } from '@/hooks/useStorage';
import { useAnalyzeGarment } from '@/hooks/useAnalyzeGarment';
import { useCreateGarment } from '@/hooks/useGarments';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { invokeEdgeFunction } from '@/lib/edgeFunctionClient';
import type { Json } from '@/integrations/supabase/types';
import { buildGarmentIntelligenceFields, getGarmentReviewDecision, standardizeGarmentAiRaw, triggerGarmentPostSaveIntelligence } from '@/lib/garmentIntelligence';

interface BatchItem {
  file: File;
  preview: string;
  status: 'waiting' | 'uploading' | 'analyzing' | 'review' | 'done' | 'error' | 'skipped';
  error?: string;
  storagePath?: string;
  garmentId?: string;
  analysis?: Awaited<ReturnType<ReturnType<typeof useAnalyzeGarment>['analyzeGarment']>>['data'];
  reviewSourceIndex?: number;
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

  const updateItem = useCallback((index: number, updates: Partial<BatchItem>) => {
    setItems(prev => prev.map((item, i) => i === index ? { ...item, ...updates } : item));
  }, []);

  const reviewCount = items.filter(i => i.status === 'review').length;
  const doneCount = items.filter(i => i.status === 'done').length;
  const skippedCount = items.filter(i => i.status === 'skipped').length;
  const errorCount = items.filter(i => i.status === 'error').length;
  const unresolvedCount = items.filter(i => ['waiting', 'uploading', 'analyzing', 'review'].includes(i.status)).length;
  const processingComplete = items.length > 0 && currentIndex >= items.length && !isProcessing;
  const readyToContinue = processingComplete && unresolvedCount === 0;
  const totalProgress = items.length > 0 ? ((doneCount + skippedCount + errorCount) / items.length) * 100 : 0;
  const statusMessage = useMemo(() => {
    if (readyToContinue) {
      return `All ${items.length} items are resolved. Review is complete.`;
    }

    if (processingComplete && reviewCount > 0) {
      return `${reviewCount} review item${reviewCount === 1 ? '' : 's'} still need a decision.`;
    }

    return null;
  }, [items.length, processingComplete, readyToContinue, reviewCount]);

  const saveApprovedItem = useCallback(async (item: BatchItem) => {
    if (!item.analysis || !item.storagePath || !item.garmentId) {
      throw new Error('Missing review item context');
    }

    await createGarment.mutateAsync({
      id: item.garmentId,
      image_path: item.storagePath,
      title: item.analysis.title,
      category: item.analysis.category,
      subcategory: item.analysis.subcategory || null,
      color_primary: item.analysis.color_primary,
      color_secondary: item.analysis.color_secondary || null,
      pattern: item.analysis.pattern || null,
      material: item.analysis.material || null,
      fit: item.analysis.fit || null,
      season_tags: item.analysis.season_tags || null,
      formality: item.analysis.formality || 3,
      in_laundry: false,
      ai_analyzed_at: new Date().toISOString(),
      ai_provider: item.analysis.ai_provider || 'unknown',
      ai_raw: standardizeGarmentAiRaw({
        aiRaw: (item.analysis.ai_raw ?? null) as Json,
        analysisConfidence: item.analysis.confidence,
        source: 'batch_add',
        reviewDecision: getGarmentReviewDecision(item.analysis.confidence, {
          imageContainsMultipleGarments: item.analysis.image_contains_multiple_garments,
        }),
      }),
      ...buildGarmentIntelligenceFields({ storagePath: item.storagePath }),
    });

    triggerGarmentPostSaveIntelligence({
      garmentId: item.garmentId,
      storagePath: item.storagePath,
      source: 'batch_add',
      imageProcessing: { mode: 'edge' },
    });

    invokeEdgeFunction('detect_duplicate_garment', {
      body: {
        image_path: item.storagePath,
        category: item.analysis.category,
        color_primary: item.analysis.color_primary,
        title: item.analysis.title,
        subcategory: item.analysis.subcategory,
        material: item.analysis.material,
        exclude_garment_id: item.garmentId,
      },
    }).catch((err) =>
      console.error('Batch duplicate detection error (non-blocking):', err)
    );
  }, [createGarment]);

  const queueReviewItems = useCallback((index: number, item: BatchItem, storagePath: string, garmentId: string) => {
    const detectedGarments = Array.isArray(item.analysis?.detected_garments)
      ? item.analysis.detected_garments.filter((garment) => garment && typeof garment === 'object')
      : [];

    if (detectedGarments.length <= 1) {
      updateItem(index, {
        status: 'review',
        storagePath,
        garmentId,
        analysis: item.analysis,
        error: item.analysis?.image_contains_multiple_garments
          ? 'Multiple garments detected — review this photo before adding.'
          : item.analysis?.confidence == null
            ? 'Needs quick review before adding.'
            : 'Low-confidence match — review before adding.',
      });
      return;
    }

    setItems((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        status: 'review',
        storagePath,
        garmentId,
        analysis: {
          ...item.analysis!,
          ...detectedGarments[0],
          season_tags: detectedGarments[0].season_tags ?? item.analysis?.season_tags ?? [],
          formality: detectedGarments[0].formality ?? item.analysis?.formality ?? 3,
          confidence: detectedGarments[0].confidence ?? item.analysis?.confidence,
          image_contains_multiple_garments: true,
          detected_garments: [detectedGarments[0]],
        },
        reviewSourceIndex: index,
        error: `Multiple garments detected — review item 1 of ${detectedGarments.length}.`,
      };

      const reviewChildren = detectedGarments.slice(1).map((garment, garmentIndex) => ({
        file: next[index].file,
        preview: next[index].preview,
        status: 'review' as const,
        storagePath,
        garmentId: crypto.randomUUID(),
        reviewSourceIndex: index,
        analysis: {
          ...item.analysis!,
          ...garment,
          season_tags: garment.season_tags ?? item.analysis?.season_tags ?? [],
          formality: garment.formality ?? item.analysis?.formality ?? 3,
          confidence: garment.confidence ?? item.analysis?.confidence,
          image_contains_multiple_garments: true,
          detected_garments: [garment],
        },
        error: `Multiple garments detected — review item ${garmentIndex + 2} of ${detectedGarments.length}.`,
      }));

      next.splice(index + 1, 0, ...reviewChildren);
      return next;
    });
  }, [updateItem]);

  // Process queue
  useEffect(() => {
    if (!user || items.length === 0 || isProcessing) return;
    if (currentIndex >= items.length) {
      return;
    }

    const currentItem = items[currentIndex];
    if (!currentItem) return;
    if (currentItem.status !== 'waiting') {
      setCurrentIndex((i) => i + 1);
      return;
    }

    const processItem = async () => {
      setIsProcessing(true);
      const garmentId = crypto.randomUUID();
      let path = '';

      updateItem(currentIndex, { status: 'uploading' });
      try {
        path = await uploadGarmentImage(currentItem.file, garmentId);
      } catch {
        updateItem(currentIndex, { status: 'error', error: t('batch.upload_failed') });
        setCurrentIndex(i => i + 1);
        setIsProcessing(false);
        return;
      }

      updateItem(currentIndex, { status: 'analyzing' });
      try {
        const { data, error } = await analyzeGarment(path);
        if (error || !data) {
          updateItem(currentIndex, { status: 'error', error: error || t('batch.analyze_failed') });
          setCurrentIndex(i => i + 1);
          setIsProcessing(false);
          return;
        }

        const reviewDecision = getGarmentReviewDecision(data.confidence, {
          imageContainsMultipleGarments: data.image_contains_multiple_garments,
        });
        if (reviewDecision.needsReview) {
          queueReviewItems(currentIndex, {
            ...currentItem,
            storagePath: path,
            garmentId,
            analysis: data,
          }, path, garmentId);
        } else {
          await saveApprovedItem({
            ...currentItem,
            storagePath: path,
            garmentId,
            analysis: data,
          });

          updateItem(currentIndex, { status: 'done', storagePath: path, garmentId, analysis: data });
        }
      } catch {
        updateItem(currentIndex, { status: 'error', error: t('batch.save_failed') });
      }

      setCurrentIndex(i => i + 1);
      setIsProcessing(false);
    };

    processItem();
  }, [analyzeGarment, currentIndex, isProcessing, items, queueReviewItems, saveApprovedItem, t, updateItem, uploadGarmentImage, user]);

  const handleApproveReviewItem = async (index: number) => {
    updateItem(index, { status: 'uploading', error: undefined });
    try {
      await saveApprovedItem(items[index]);
      updateItem(index, { status: 'done' });
    } catch {
      updateItem(index, { status: 'error', error: t('batch.save_failed') });
    }
  };

  const handleSkipReviewItem = (index: number) => {
    updateItem(index, { status: 'skipped', error: undefined });
  };

  const handleContinue = () => {
    if (!readyToContinue) return;

    toast.success(`${doneCount}/${items.length} ${t('batch.complete_toast')}`, {
      description: skippedCount > 0
        ? `${skippedCount} item${skippedCount === 1 ? '' : 's'} were skipped during review.`
        : 'Added to wardrobe. Background cleanup continues automatically.',
    });

    onComplete();
  };

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
              {doneCount}/{items.length} added
            </span>
            <div className="flex items-center gap-2">
              {reviewCount > 0 && (
                <span className="text-amber-600 text-xs">{reviewCount} pending review</span>
              )}
              {errorCount > 0 && (
                <span className="text-destructive text-xs">{errorCount} {t('batch.errors')}</span>
              )}
            </div>
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
                    (item.status === 'error' || item.status === 'skipped') && 'opacity-40'
                  )}
                />
                {/* Status overlay */}
                <div className={cn(
                  'absolute inset-0 flex items-center justify-center',
                  item.status === 'done' && 'bg-black/20',
                  item.status === 'error' && 'bg-destructive/10',
                  item.status === 'review' && 'bg-amber-500/20',
                  item.status === 'skipped' && 'bg-muted/40',
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
                      <span className="text-[10px] text-white font-medium">Uploading</span>
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
                      <span className="text-[10px] text-white font-medium">Saving details</span>
                    </div>
                  )}
                  {item.status === 'review' && (
                    <div className="flex flex-col items-center gap-1">
                      <Clock3 className="w-7 h-7 text-amber-700 drop-shadow-md" />
                      <span className="text-[10px] font-medium text-amber-900">Review</span>
                    </div>
                  )}
                  {item.status === 'done' && (
                    <CheckCircle className="w-7 h-7 text-white drop-shadow-md" />
                  )}
                  {item.status === 'error' && (
                    <AlertCircle className="w-7 h-7 text-destructive drop-shadow-md" />
                  )}
                  {item.status === 'skipped' && (
                    <SkipForward className="w-7 h-7 text-muted-foreground drop-shadow-md" />
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {statusMessage && (
          <div className={cn(
            'rounded-xl border p-4',
            readyToContinue
              ? 'border-emerald-200 bg-emerald-50/70'
              : 'border-amber-200 bg-amber-50/60'
          )}>
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <p className={cn(
                  'text-sm font-medium',
                  readyToContinue ? 'text-emerald-950' : 'text-amber-950'
                )}>
                  {readyToContinue ? 'Review complete' : 'Review still needed'}
                </p>
                <p className={cn(
                  'text-xs',
                  readyToContinue ? 'text-emerald-800' : 'text-amber-800'
                )}>
                  {statusMessage}
                </p>
              </div>
              {readyToContinue && (
                <Button size="sm" onClick={handleContinue}>
                  Continue
                  <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        )}

        {reviewCount > 0 && (
          <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/60 p-4">
            <div className="flex items-center gap-2">
              <Clock3 className="h-4 w-4 text-amber-700" />
              <div>
                <p className="text-sm font-medium text-amber-950">Quick review</p>
                <p className="text-xs text-amber-800">Only uncertain or multi-garment photos need approval. Confident single-garment items were added automatically.</p>
              </div>
            </div>
            <div className="space-y-3">
              {items.map((item, index) => item.status === 'review' ? (
                <div key={`review-${index}`} className="flex items-center gap-3 rounded-lg bg-background p-3 shadow-sm">
                  <img src={item.preview} alt={item.analysis?.title || 'Review garment'} className="h-16 w-16 rounded-md object-cover bg-muted" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.analysis?.title || 'Untitled garment'}</p>
                    <p className="text-xs text-muted-foreground">
                      {[item.analysis?.category, item.analysis?.color_primary, item.analysis?.material].filter(Boolean).join(' · ')}
                    </p>
                    <p className="text-xs text-amber-700">{item.error}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleSkipReviewItem(index)}>Skip</Button>
                    <Button size="sm" onClick={() => handleApproveReviewItem(index)}>
                      Add
                      <ArrowRight className="ml-1 h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ) : null)}
            </div>
          </div>
        )}

        {/* Hint */}
        <p className="text-xs text-muted-foreground text-center">
          Items appear in your wardrobe as they finish saving. Cleanup and enrichment continue quietly in the background.
        </p>
      </div>
    </div>
  );
}
