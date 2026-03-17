import { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { SEED_GARMENTS } from '@/data/seedGarments';

/** Lightweight t() — falls back to key until translations are loaded */
function t(key: string): string {
  return key;
}

const BATCH_SIZE = 1;
const DELAY_MS = 2000;

export type SeedStep = 'idle' | 'deleting' | 'generating' | 'done' | 'error';

export interface SeedItemResult {
  title: string;
  success: boolean;
  error?: string;
}

interface SeedContextValue {
  step: SeedStep;
  results: SeedItemResult[];
  completed: number;
  failed: number;
  totalToProcess: number;
  startTime: number;
  currentItem: string;
  isRunning: boolean;
  progress: number;
  getTimeRemaining: () => string;
  run: () => Promise<void>;
  retryFailed: () => Promise<void>;
  cancel: () => void;
}

const SeedContext = createContext<SeedContextValue | null>(null);

export function useSeed() {
  const ctx = useContext(SeedContext);
  if (!ctx) throw new Error('useSeed must be used within SeedProvider');
  return ctx;
}

/** Safe version that returns null outside SeedProvider — used by global UI like SeedProgressPill */
export function useSeedMaybe() {
  return useContext(SeedContext);
}

function formatTimeRemaining(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return m > 0 ? `~${m}m ${s}s remaining` : `~${s}s remaining`;
}

export function SeedProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [step, setStep] = useState<SeedStep>('idle');
  const [results, setResults] = useState<SeedItemResult[]>([]);
  const [completed, setCompleted] = useState(0);
  const [failed, setFailed] = useState(0);
  const [totalToProcess, setTotalToProcess] = useState(0);
  const [startTime, setStartTime] = useState(0);
  const [currentItem, setCurrentItem] = useState('');
  const cancelRef = useRef(false);

  const isRunning = step === 'deleting' || step === 'generating';
  const progress = totalToProcess > 0 ? Math.round(((completed + failed) / totalToProcess) * 100) : 0;

  const getTimeRemaining = useCallback(() => {
    if (completed + failed === 0 || startTime === 0) return '';
    const elapsed = (Date.now() - startTime) / 1000;
    const rate = (completed + failed) / elapsed;
    const remaining = (totalToProcess - completed - failed) / rate;
    return formatTimeRemaining(remaining);
  }, [completed, failed, startTime, totalToProcess]);

  const run = useCallback(async () => {
    if (!user || isRunning) return;
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
      toast.success(t('seed.deleted'));
    } catch {
      toast.error(t('seed.delete_error'));
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

        const batchResults: SeedItemResult[] = data?.results || [];
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

      if (i + BATCH_SIZE < SEED_GARMENTS.length && !cancelRef.current) {
        await new Promise(r => setTimeout(r, DELAY_MS));
      }
    }

    setStep('done');
    setCurrentItem('');
    toast.success(`Created ${doneCount} garments (${failCount} failed)`);
  }, [user, isRunning]);

  const retryFailed = useCallback(async () => {
    if (!user || isRunning) return;
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

        const batchResults: SeedItemResult[] = data?.results || [];
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
  }, [user, isRunning, results, completed]);

  const cancel = useCallback(() => {
    cancelRef.current = true;
  }, []);

  return (
    <SeedContext.Provider
      value={{
        step, results, completed, failed, totalToProcess, startTime,
        currentItem, isRunning, progress, getTimeRemaining,
        run, retryFailed, cancel,
      }}
    >
      {children}
    </SeedContext.Provider>
  );
}
