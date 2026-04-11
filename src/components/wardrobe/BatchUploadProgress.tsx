import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, AlertCircle, Upload, Sparkles, X, Clock3, ArrowRight, SkipForward } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useStorage } from '@/hooks/useStorage';
import { useAnalyzeGarment } from '@/hooks/useAnalyzeGarment';
import { invalidateWardrobeQueries } from '@/hooks/useGarments';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { finalizeCandidate, type GarmentIntakeCandidate } from '@/lib/finalizeCandidate';
import { getGarmentReviewDecision } from '@/lib/garmentIntelligence';
import { GarmentSavedCard } from '@/components/garment/GarmentSavedCard';
import { categoryLabel, colorLabel } from '@/lib/humanize';

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

const CONCURRENCY = 3;

export function BatchUploadProgress({ files, onComplete, onCancel }: BatchUploadProgressProps) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { uploadGarmentImage } = useStorage();
  const { analyzeGarment } = useAnalyzeGarment();
  const queryClient = useQueryClient();
  const [items, setItems] = useState<BatchItem[]>([]);
  const dispatchedRef = useRef<Set<number>>(new Set());
  const itemsRef = useRef<BatchItem[]>([]);
  const [lastSavedCard, setLastSavedCard] = useState<{
    garmentId: string;
    imagePath: string;
    title: string;
    category: string;
    colorPrimary: string;
  } | null>(null);

  const resolveCopy = useCallback((key: string, fallback: string) => {
    const translated = t(key);
    return translated && translated !== key ? translated : fallback;
  }, [t]);

  // Initialize items with previews
  useEffect(() => {
    const newItems: BatchItem[] = files.map(file => ({
      file,
      preview: URL.createObjectURL(file),
      status: 'waiting' as const,
    }));
    dispatchedRef.current = new Set();
    setItems(newItems);
    itemsRef.current = newItems;
    return () => newItems.forEach(item => URL.revokeObjectURL(item.preview));
  }, [files]);

  // Keep itemsRef in sync with items state so worker loops read fresh data
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const updateItem = useCallback((index: number, updates: Partial<BatchItem>) => {
    setItems(prev => prev.map((item, i) => i === index ? { ...item, ...updates } : item));
  }, []);

  const reviewCount = items.filter(i => i.status === 'review').length;
  const doneCount = items.filter(i => i.status === 'done').length;
  const skippedCount = items.filter(i => i.status === 'skipped').length;
  const errorCount = items.filter(i => i.status === 'error').length;
  const unresolvedCount = items.filter(i => ['waiting', 'uploading', 'analyzing', 'review'].includes(i.status)).length;
  const processingComplete =
    items.length > 0 &&
    dispatchedRef.current.size >= items.length &&
    items.every(i => ['done', 'skipped', 'error', 'review'].includes(i.status));
  const readyToContinue = processingComplete && unresolvedCount === 0;
  const totalProgress = items.length > 0 ? ((doneCount + skippedCount + errorCount) / items.length) * 100 : 0;
  const statusMessage = useMemo(() => {
    if (readyToContinue) {
      return t('batch.all_resolved').replace('{count}', String(items.length));
    }

    if (processingComplete && reviewCount > 0) {
      return t('batch.review_pending').replace('{count}', String(reviewCount));
    }

    return null;
  }, [items.length, processingComplete, readyToContinue, reviewCount, t]);

  const saveApprovedItem = useCallback(async (item: BatchItem) => {
    if (!item.analysis || !item.storagePath || !item.garmentId || !user) {
      throw new Error('Missing review item context');
    }

    const candidate: GarmentIntakeCandidate = {
      blob: new Blob([]),
      analysis: item.analysis,
      userId: user.id,
      source: 'batch_add',
      enableStudioQuality: true,
      confidence: item.analysis.confidence ?? null,
      existingGarmentId: item.garmentId,
      existingStoragePath: item.storagePath,
    };

    const saved = await finalizeCandidate(candidate);
    if (!saved) {
      throw new Error('finalizeCandidate returned null');
    }

    setLastSavedCard({
      garmentId: saved.garmentId,
      imagePath: saved.storagePath,
      title: item.analysis.title,
      category: item.analysis.category,
      colorPrimary: item.analysis.color_primary,
    });

    invalidateWardrobeQueries(queryClient, user.id);
  }, [queryClient, user]);

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
          ? t('batch.multi_garment_review')
          : item.analysis?.confidence == null
            ? t('batch.needs_review')
            : t('batch.low_confidence'),
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
        error: t('batch.multi_review_item').replace('{current}', '1').replace('{total}', String(detectedGarments.length)),
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
        error: t('batch.multi_review_item').replace('{current}', String(garmentIndex + 2)).replace('{total}', String(detectedGarments.length)),
      }));

      // Append to end instead of splicing — index stability matters for concurrent workers
      const appendStart = next.length;
      next.push(...reviewChildren);
      // Review children are pre-finalized (status 'review'); mark them dispatched
      // so pool accounting stays consistent with items.length
      for (let k = 0; k < reviewChildren.length; k++) {
        dispatchedRef.current.add(appendStart + k);
      }
      return next;
    });
  }, [t, updateItem]);

  // Process a single item — identical pipeline to sequential version, driven by index
  const processItem = useCallback(async (index: number) => {
    const currentItem = itemsRef.current[index];
    if (!currentItem || currentItem.status !== 'waiting') return;

    const garmentId = crypto.randomUUID();
    let path = '';

    updateItem(index, { status: 'uploading' });
    try {
      path = await uploadGarmentImage(currentItem.file, garmentId);
    } catch {
      updateItem(index, { status: 'error', error: t('batch.upload_failed') });
      return;
    }

    updateItem(index, { status: 'analyzing' });
    try {
      const { data, error } = await analyzeGarment(path, 'fast');
      if (error || !data) {
        updateItem(index, { status: 'error', error: error || t('batch.analyze_failed') });
        return;
      }

      const reviewDecision = getGarmentReviewDecision(data.confidence, {
        imageContainsMultipleGarments: data.image_contains_multiple_garments,
      });
      if (reviewDecision.needsReview) {
        queueReviewItems(index, {
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
        updateItem(index, { status: 'done', storagePath: path, garmentId, analysis: data });
      }
    } catch {
      updateItem(index, { status: 'error', error: t('batch.save_failed') });
    }
  }, [analyzeGarment, queueReviewItems, saveApprovedItem, t, updateItem, uploadGarmentImage]);

  // Launch concurrent worker pool once items are initialized
  useEffect(() => {
    if (!user || items.length === 0) return;
    if (dispatchedRef.current.size > 0) return;

    const findNextIndex = (): number => {
      const current = itemsRef.current;
      for (let i = 0; i < current.length; i++) {
        if (current[i]?.status === 'waiting' && !dispatchedRef.current.has(i)) {
          return i;
        }
      }
      return -1;
    };

    const worker = async () => {
      while (true) {
        const nextIndex = findNextIndex();
        if (nextIndex === -1) return;
        dispatchedRef.current.add(nextIndex);
        await processItem(nextIndex);
      }
    };

    for (let i = 0; i < CONCURRENCY; i++) {
      void worker();
    }
  }, [items.length, processItem, user]);

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
        ? t('batch.skipped_count').replace('{count}', String(skippedCount))
        : resolveCopy(
          'batch.added_cleanup',
          'Saved to wardrobe. Studio-quality images continue in the background.',
        ),
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
              {doneCount}/{items.length} {t('batch.added_label')}
            </span>
            <div className="flex items-center gap-2">
              {reviewCount > 0 && (
                <span className="text-amber-600 text-xs">{reviewCount} {t('batch.pending_review')}</span>
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
                  {readyToContinue ? t('batch.review_complete') : t('batch.review_still_needed')}
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
                  {t('common.continue')}
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
                <p className="text-sm font-medium text-amber-950">{t('batch.quick_review')}</p>
                <p className="text-xs text-amber-800">{t('batch.quick_review_desc')}</p>
              </div>
            </div>
            <div className="space-y-3">
              {items.map((item, index) => item.status === 'review' ? (
                <div key={`review-${index}`} className="flex items-center gap-3 rounded-lg bg-background p-3 shadow-sm">
                  <img src={item.preview} alt={item.analysis?.title || t('batch.review_garment')} className="h-16 w-16 rounded-md object-cover bg-muted" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.analysis?.title || t('batch.untitled_garment')}</p>
                    <p className="text-xs text-muted-foreground">
                      {[item.analysis?.category, item.analysis?.color_primary, item.analysis?.material].filter(Boolean).join(' · ')}
                    </p>
                    <p className="text-xs text-amber-700">{item.error}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleSkipReviewItem(index)}>{t('common.skip')}</Button>
                    <Button size="sm" onClick={() => handleApproveReviewItem(index)}>
                      {t('common.add')}
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
          {t('batch.background_hint')}
        </p>
      </div>

      {lastSavedCard && (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
          <div className="pointer-events-auto w-full max-w-sm">
            <GarmentSavedCard
              key={lastSavedCard.garmentId}
              garmentId={lastSavedCard.garmentId}
              imagePath={lastSavedCard.imagePath}
              title={lastSavedCard.title}
              category={categoryLabel(t, lastSavedCard.category)}
              colorPrimary={colorLabel(t, lastSavedCard.colorPrimary)}
              studioQualityEnabled={true}
              onDismiss={() => setLastSavedCard(null)}
              autoDismissMs={1800}
            />
          </div>
        </div>
      )}
    </div>
  );
}
