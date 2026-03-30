import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ImagePlus, Loader2, CheckCircle, AlertCircle, RotateCcw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useFlatGarments } from '@/hooks/useGarments';
import { useLanguage } from '@/contexts/LanguageContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { AnimatedPage } from '@/components/ui/animated-page';
import { hapticLight } from '@/lib/haptics';
import { motion, useReducedMotion } from 'framer-motion';
import { EASE_CURVE } from '@/lib/motion';

const BATCH_SIZE = 6;

type ItemStatus = 'pending' | 'generating' | 'done' | 'error';

interface BatchItem {
  id: string;
  title: string;
  status: ItemStatus;
  error?: string;
}

export default function GenerateImages() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: garments } = useFlatGarments();
  const { t } = useLanguage();
  const prefersReduced = useReducedMotion();
  const [items, setItems] = useState<BatchItem[]>([]);
  const [running, setRunning] = useState(false);
  const [completed, setCompleted] = useState(0);
  const [failed, setFailed] = useState(0);

  const total = items.length;
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

  const stagger = (i: number) =>
    prefersReduced ? {} : { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, transition: { delay: 0.08 * i, duration: 0.35, ease: EASE_CURVE } };

  const startGeneration = useCallback(async (retryIds?: string[]) => {
    if (!user || !garments) return;

    let targets: BatchItem[];
    if (retryIds) {
      targets = retryIds.map(id => {
        const g = garments.find(g => g.id === id);
        return { id, title: g?.title || id, status: 'pending' as ItemStatus };
      });
      setItems(prev => {
        const kept = prev.filter(i => !retryIds.includes(i.id));
        return [...kept, ...targets];
      });
    } else {
      targets = garments.map(g => ({
        id: g.id,
        title: g.title,
        status: 'pending' as ItemStatus,
      }));
      setItems(targets);
    }

    setRunning(true);
    setCompleted(0);
    setFailed(0);

    const ids = targets.map(t => t.id);
    let doneCount = 0;
    let failCount = 0;

    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      const batch = ids.slice(i, i + BATCH_SIZE);

      // Mark batch as generating
      setItems(prev =>
        prev.map(item =>
          batch.includes(item.id) ? { ...item, status: 'generating' } : item
        )
      );

      try {
        const { data, error } = await supabase.functions.invoke('generate_garment_images', {
          body: { garment_ids: batch },
        });

        if (error) throw error;

        const results: Array<{ id: string; success: boolean; error?: string }> =
          data?.results || [];

        setItems(prev =>
          prev.map(item => {
            const result = results.find(r => r.id === item.id);
            if (!result) return item;
            if (result.success) {
              doneCount++;
              return { ...item, status: 'done' };
            } else {
              failCount++;
              return { ...item, status: 'error', error: result.error };
            }
          })
        );
      } catch (err) {
        // Mark entire batch as failed
        setItems(prev =>
          prev.map(item =>
            batch.includes(item.id)
              ? { ...item, status: 'error', error: err instanceof Error ? err.message : 'Batch failed' }
              : item
          )
        );
        failCount += batch.length;
      }

      setCompleted(doneCount);
      setFailed(failCount);

      // Small delay between batches to avoid rate limiting
      if (i + BATCH_SIZE < ids.length) {
        await new Promise(r => setTimeout(r, 2000));
      }
    }

    setRunning(false);
  }, [user, garments]);

  const retryFailed = useCallback(() => {
    const failedIds = items.filter(i => i.status === 'error').map(i => i.id);
    if (failedIds.length > 0) startGeneration(failedIds);
  }, [items, startGeneration]);

  const failedItems = items.filter(i => i.status === 'error');

  return (
    <AppLayout hideNav>
      <PageHeader
        title={t('genimg.title')}
        eyebrow="Admin"
        showBack
        titleClassName="font-display italic"
      />
      <AnimatedPage className="px-4 pb-24 pt-4 max-w-lg mx-auto space-y-5">
        {/* Description */}
        <motion.div {...stagger(0)}>
          <p className="text-sm text-muted-foreground font-body leading-relaxed">
            {t('genimg.desc')}
          </p>
        </motion.div>

        {/* Stats strip */}
        <motion.div className="flex gap-3" {...stagger(1)}>
          <div className="surface-secondary rounded-[1.25rem] px-4 py-4 flex-1 text-center">
            <p className="text-2xl font-semibold tracking-tight">{garments?.length || 0}</p>
            <p className="text-[10px] font-body uppercase tracking-[0.14em] text-muted-foreground/50 mt-1">{t('genimg.total')}</p>
          </div>
          {total > 0 && (
            <>
              <div className="surface-secondary rounded-[1.25rem] px-4 py-4 flex-1 text-center border border-emerald-500/20">
                <p className="text-2xl font-semibold tracking-tight text-emerald-600">{completed}</p>
                <p className="text-[10px] font-body uppercase tracking-[0.14em] text-muted-foreground/50 mt-1">{t('genimg.generated')}</p>
              </div>
              <div className="surface-secondary rounded-[1.25rem] px-4 py-4 flex-1 text-center border border-destructive/20">
                <p className="text-2xl font-semibold tracking-tight text-destructive">{failed}</p>
                <p className="text-[10px] font-body uppercase tracking-[0.14em] text-muted-foreground/50 mt-1">{t('genimg.failed')}</p>
              </div>
            </>
          )}
        </motion.div>

        {/* Progress bar */}
        {total > 0 && (
          <motion.div className="space-y-2" {...stagger(2)}>
            <div className="surface-secondary rounded-[1.25rem] p-5 space-y-3">
              <div className="flex items-center justify-between">
                <p className="label-editorial text-muted-foreground/50 text-[10px]">Progress</p>
                <span className="text-sm font-semibold tabular-nums">{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-muted-foreground font-body text-center">
                {running ? `${t('genimg.processing')} ${completed + failed} / ${total}` : `${t('genimg.done')} — ${completed} / ${failed}`}
              </p>
            </div>
          </motion.div>
        )}

        {/* Action buttons */}
        <motion.div className="flex gap-3" {...stagger(3)}>
          <Button
            onClick={() => { hapticLight(); startGeneration(); }}
            disabled={running || !garments?.length}
            className="flex-1 rounded-full h-12"
          >
            {running ? (
              <><Loader2 className="w-4 h-4 animate-spin mr-2" /> {t('genimg.generating')}</>
            ) : (
              <><ImagePlus className="w-4 h-4 mr-2" /> {t('genimg.generate_all')}</>
            )}
          </Button>

          {failedItems.length > 0 && !running && (
            <Button variant="outline" className="rounded-full" onClick={() => { hapticLight(); retryFailed(); }}>
              <RotateCcw className="w-4 h-4 mr-2" /> {t('genimg.retry')} {failedItems.length}
            </Button>
          )}
        </motion.div>

        {/* Item list */}
        {items.length > 0 && (
          <motion.div className="surface-secondary rounded-[1.25rem] overflow-hidden" {...stagger(4)}>
            <div className="px-5 py-3 border-b border-border/40">
              <p className="label-editorial text-muted-foreground/50 text-[10px]">Processing Queue</p>
            </div>
            <div className="max-h-[50vh] overflow-y-auto divide-y divide-border/30">
              {items.map(item => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 py-3 px-5"
                >
                  {item.status === 'pending' && (
                    <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/20 flex-shrink-0" />
                  )}
                  {item.status === 'generating' && (
                    <Loader2 className="w-4 h-4 animate-spin text-accent flex-shrink-0" />
                  )}
                  {item.status === 'done' && (
                    <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  )}
                  {item.status === 'error' && (
                    <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0" />
                  )}
                  <span className="truncate flex-1 text-sm font-body">{item.title}</span>
                  {item.error && (
                    <span className="text-xs text-destructive truncate max-w-[120px] font-body">{item.error}</span>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatedPage>
    </AppLayout>
  );
}
