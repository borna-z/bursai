import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ImagePlus, Loader2, CheckCircle, AlertCircle, RotateCcw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useFlatGarments } from '@/hooks/useGarments';
import { useLanguage } from '@/contexts/LanguageContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { AnimatedPage } from '@/components/ui/animated-page';

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
  const [items, setItems] = useState<BatchItem[]>([]);
  const [running, setRunning] = useState(false);
  const [completed, setCompleted] = useState(0);
  const [failed, setFailed] = useState(0);

  const total = items.length;
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

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
    const { t } = useLanguage();

    return (
    <AppLayout hideNav>
      <AnimatedPage className="px-6 pb-8 pt-12 max-w-lg mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/settings')} className="p-2 -ml-2 rounded-xl hover:bg-muted">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-semibold">{t('genimg.title')}</h1>
        </div>

        <p className="text-sm text-muted-foreground">
          {t('genimg.desc')}
        </p>

        {/* Stats */}
        <div className="flex gap-4 text-sm">
          <div className="bg-muted/50 rounded-xl px-4 py-3 flex-1 text-center">
            <p className="text-2xl font-semibold">{garments?.length || 0}</p>
            <p className="text-muted-foreground text-xs">{t('genimg.total')}</p>
          </div>
          {total > 0 && (
            <>
              <div className="bg-emerald-500/10 rounded-xl px-4 py-3 flex-1 text-center">
                <p className="text-2xl font-semibold text-emerald-600">{completed}</p>
                <p className="text-muted-foreground text-xs">{t('genimg.generated')}</p>
              </div>
              <div className="bg-destructive/10 rounded-xl px-4 py-3 flex-1 text-center">
                <p className="text-2xl font-semibold text-destructive">{failed}</p>
                <p className="text-muted-foreground text-xs">{t('genimg.failed')}</p>
              </div>
            </>
          )}
        </div>

        {/* Progress bar */}
        {total > 0 && (
          <div className="space-y-2">
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-muted-foreground text-center">
              {running ? `${t('genimg.processing')} ${completed + failed} / ${total}` : `${t('genimg.done')} — ${completed} / ${failed}`}
            </p>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-3">
          <Button
            onClick={() => startGeneration()}
            disabled={running || !garments?.length}
            className="flex-1"
          >
            {running ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> {t('genimg.generating')}</>
            ) : (
              <><ImagePlus className="w-4 h-4" /> {t('genimg.generate_all')}</>
            )}
          </Button>

          {failedItems.length > 0 && !running && (
            <Button variant="outline" onClick={retryFailed}>
              <RotateCcw className="w-4 h-4" /> {t('genimg.retry')} {failedItems.length}
            </Button>
          )}
        </div>

        {/* Item list */}
        {items.length > 0 && (
          <div className="space-y-1 max-h-[50vh] overflow-y-auto">
            {items.map(item => (
              <div
                key={item.id}
                className="flex items-center gap-3 py-2 px-3 rounded-lg text-sm"
              >
                {item.status === 'pending' && (
                  <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/20" />
                )}
                {item.status === 'generating' && (
                  <Loader2 className="w-4 h-4 animate-spin text-accent" />
                )}
                {item.status === 'done' && (
                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                )}
                {item.status === 'error' && (
                  <AlertCircle className="w-4 h-4 text-destructive" />
                )}
                <span className="truncate flex-1">{item.title}</span>
                {item.error && (
                  <span className="text-xs text-destructive truncate max-w-[120px]">{item.error}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </AnimatedPage>
    </AppLayout>
  );
}
