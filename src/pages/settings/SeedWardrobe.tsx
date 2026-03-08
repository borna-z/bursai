import { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Trash2, Loader2, CheckCircle, AlertCircle, RotateCcw, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { AnimatedPage } from '@/components/ui/animated-page';
import { toast } from 'sonner';
import { SEED_GARMENTS } from '@/data/seedGarments';

const BATCH_SIZE = 1;
const DELAY_MS = 2000;

type StepStatus = 'idle' | 'deleting' | 'generating' | 'done' | 'error';

interface ItemResult {
  title: string;
  success: boolean;
  error?: string;
}

function formatTimeRemaining(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return m > 0 ? `~${m}m ${s}s remaining` : `~${s}s remaining`;
}

export default function SeedWardrobe() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState<StepStatus>('idle');
  const [results, setResults] = useState<ItemResult[]>([]);
  const [completed, setCompleted] = useState(0);
  const [failed, setFailed] = useState(0);
  const [totalToProcess, setTotalToProcess] = useState(0);
  const [startTime, setStartTime] = useState<number>(0);
  const [currentItem, setCurrentItem] = useState('');
  const cancelRef = useRef(false);

  const progress = totalToProcess > 0 ? Math.round(((completed + failed) / totalToProcess) * 100) : 0;

  const getTimeRemaining = () => {
    if (completed + failed === 0 || startTime === 0) return '';
    const elapsed = (Date.now() - startTime) / 1000;
    const rate = (completed + failed) / elapsed;
    const remaining = (totalToProcess - completed - failed) / rate;
    return formatTimeRemaining(remaining);
  };

  const run = useCallback(async () => {
    if (!user) return;
    cancelRef.current = false;
    setResults([]);
    setCompleted(0);
    setFailed(0);
    setTotalToProcess(SEED_GARMENTS.length);
    setStartTime(Date.now());

    // Step 1: Delete all existing
    setStep('deleting');
    try {
      const { error } = await supabase.functions.invoke('seed_wardrobe', {
        body: { action: 'delete_all' },
      });
      if (error) throw error;
      toast.success('All old garments deleted');
    } catch (err) {
      toast.error('Failed to delete old garments');
      setStep('error');
      return;
    }

    // Step 2: Create garments one at a time
    setStep('generating');
    let doneCount = 0;
    let failCount = 0;

    for (let i = 0; i < SEED_GARMENTS.length; i += BATCH_SIZE) {
      if (cancelRef.current) break;

      const batch = SEED_GARMENTS.slice(i, i + BATCH_SIZE);
      setCurrentItem(batch[0]?.title || '');

      try {
        const { data, error } = await supabase.functions.invoke('seed_wardrobe', {
          body: { action: 'create_batch', garments: batch, garment_index: i },
        });

        if (error) throw error;

        const batchResults: ItemResult[] = data?.results || [];
        setResults(prev => [...prev, ...batchResults]);

        for (const r of batchResults) {
          if (r.success) doneCount++;
          else failCount++;
        }
      } catch (err) {
        const errorResults = batch.map(g => ({
          title: g.title,
          success: false,
          error: err instanceof Error ? err.message : 'Batch failed',
        }));
        setResults(prev => [...prev, ...errorResults]);
        failCount += batch.length;
      }

      setCompleted(doneCount);
      setFailed(failCount);

      // Delay between items to avoid rate limiting
      if (i + BATCH_SIZE < SEED_GARMENTS.length && !cancelRef.current) {
        await new Promise(r => setTimeout(r, DELAY_MS));
      }
    }

    setStep('done');
    setCurrentItem('');
    toast.success(`Created ${doneCount} garments (${failCount} failed)`);
  }, [user]);

  const retryFailed = useCallback(async () => {
    if (!user) return;
    const failedItems = results.filter(r => !r.success);
    const failedDefs = failedItems
      .map(r => SEED_GARMENTS.find(g => g.title === r.title))
      .filter(Boolean);

    if (failedDefs.length === 0) return;

    cancelRef.current = false;
    setStep('generating');
    setTotalToProcess(failedDefs.length);
    setResults(prev => prev.filter(r => r.success));
    setStartTime(Date.now());
    let doneCount = completed;
    let failCount = 0;

    for (let i = 0; i < failedDefs.length; i += BATCH_SIZE) {
      if (cancelRef.current) break;
      const batch = failedDefs.slice(i, i + BATCH_SIZE);
      setCurrentItem(batch[0]?.title || '');

      try {
        const { data, error } = await supabase.functions.invoke('seed_wardrobe', {
          body: { action: 'create_batch', garments: batch, garment_index: 1000 + i },
        });
        if (error) throw error;

        const batchResults: ItemResult[] = data?.results || [];
        setResults(prev => [...prev, ...batchResults]);
        for (const r of batchResults) {
          if (r.success) doneCount++;
          else failCount++;
        }
      } catch (err) {
        const errorResults = batch.map(g => ({
          title: g!.title,
          success: false,
          error: 'Retry failed',
        }));
        setResults(prev => [...prev, ...errorResults]);
        failCount += batch.length;
      }

      setCompleted(doneCount);
      setFailed(failCount);

      if (i + BATCH_SIZE < failedDefs.length) {
        await new Promise(r => setTimeout(r, DELAY_MS));
      }
    }

    setStep('done');
    setCurrentItem('');
  }, [user, results, completed]);

  const isRunning = step === 'deleting' || step === 'generating';

  return (
    <AppLayout hideNav>
      <AnimatedPage className="px-6 pb-8 pt-12 max-w-lg mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/settings')} className="p-2 -ml-2 rounded-xl hover:bg-muted">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-semibold">Seed Wardrobe</h1>
        </div>

        <p className="text-sm text-muted-foreground">
          This will <strong>delete all existing garments</strong> and create {SEED_GARMENTS.length} clothing items
          with AI-generated product photos. Distribution: 40 tops, 20 bottoms, 10 shoes, 20 accessories, 10 specials.
          Estimated time: ~10 minutes.
        </p>

        {/* Stats */}
        <div className="flex gap-3 text-sm">
          <div className="bg-muted/50 rounded-xl px-4 py-3 flex-1 text-center">
            <p className="text-2xl font-semibold">{SEED_GARMENTS.length}</p>
            <p className="text-muted-foreground text-xs">To create</p>
          </div>
          <div className="bg-primary/10 rounded-xl px-4 py-3 flex-1 text-center">
            <p className="text-2xl font-semibold text-primary">{completed}</p>
            <p className="text-muted-foreground text-xs">Done</p>
          </div>
          <div className="bg-destructive/10 rounded-xl px-4 py-3 flex-1 text-center">
            <p className="text-2xl font-semibold text-destructive">{failed}</p>
            <p className="text-muted-foreground text-xs">Failed</p>
          </div>
        </div>

        {/* Progress */}
        {isRunning && (
          <div className="space-y-2">
            <Progress value={step === 'deleting' ? undefined : progress} className="h-2" />
            <p className="text-xs text-muted-foreground text-center">
              {step === 'deleting'
                ? 'Deleting old garments...'
                : `Generating... ${completed + failed} of ${totalToProcess}`}
            </p>
            {step === 'generating' && currentItem && (
              <p className="text-xs text-muted-foreground text-center truncate">
                Current: {currentItem}
              </p>
            )}
            {step === 'generating' && completed + failed > 0 && (
              <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1">
                <Clock className="w-3 h-3" /> {getTimeRemaining()}
              </p>
            )}
          </div>
        )}

        {step === 'done' && (
          <div className="p-4 rounded-xl bg-primary/10 text-center">
            <CheckCircle className="w-8 h-8 mx-auto mb-2 text-primary" />
            <p className="font-medium">Complete!</p>
            <p className="text-sm text-muted-foreground">{completed} garments created</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <Button onClick={run} disabled={isRunning} className="flex-1">
            {isRunning ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> {step === 'deleting' ? 'Deleting...' : 'Generating...'}</>
            ) : (
              <><Trash2 className="w-4 h-4" /> Delete All & Create {SEED_GARMENTS.length}</>
            )}
          </Button>

          {failed > 0 && step === 'done' && (
            <Button variant="outline" onClick={retryFailed}>
              <RotateCcw className="w-4 h-4" /> Retry {failed}
            </Button>
          )}

          {isRunning && (
            <Button variant="outline" onClick={() => { cancelRef.current = true; }}>
              Cancel
            </Button>
          )}
        </div>

        {step === 'done' && (
          <Button variant="outline" className="w-full" onClick={() => navigate('/wardrobe')}>
            View Wardrobe
          </Button>
        )}

        {/* Results log */}
        {results.length > 0 && (
          <div className="space-y-1 max-h-[40vh] overflow-y-auto">
            {results.map((item, i) => (
              <div key={i} className="flex items-center gap-3 py-1.5 px-3 rounded-lg text-sm">
                {item.success ? (
                  <CheckCircle className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-3.5 h-3.5 text-destructive flex-shrink-0" />
                )}
                <span className="truncate flex-1">{item.title}</span>
                {item.error && (
                  <span className="text-xs text-destructive truncate max-w-[100px]">{item.error}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </AnimatedPage>
    </AppLayout>
  );
}
