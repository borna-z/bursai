import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { AnimatedPage } from '@/components/ui/animated-page';
import { GapResultsPanel } from '@/components/gaps/GapResultsPanel';
import {
  GapAutorunState,
  GapErrorState,
  GapHero,
  GapLoadingState,
  GapLockedState,
  GapNoGapsState,
  GapReadyState,
} from '@/components/gaps/GapStateViews';
import { buildGapsPath, loadGapSnapshot, readGapNavigationIntent, saveGapSnapshot } from '@/components/gaps/gapRouteState';
import type { GapResult, GapViewState } from '@/components/gaps/gapTypes';
import { useWardrobeGapAnalysis } from '@/hooks/useAdvancedFeatures';
import { useGarmentCount } from '@/hooks/useGarments';
import { useWardrobeUnlocks } from '@/hooks/useWardrobeUnlocks';
import { hapticSuccess } from '@/lib/haptics';
import { EASE_CURVE } from '@/lib/motion';

function deriveViewState({
  hasError,
  hasResults,
  isAutorunPending,
  isLoading,
  isUnlocked,
  results,
}: {
  hasError: boolean;
  hasResults: boolean;
  isAutorunPending: boolean;
  isLoading: boolean;
  isUnlocked: boolean;
  results: GapResult[] | null;
}): GapViewState {
  if (!isUnlocked) return 'locked';
  if (isAutorunPending) return 'autorun';
  if (isLoading) return 'loading';
  if (hasError && !hasResults) return 'error';
  if (results && results.length > 0) return 'results';
  if (results && results.length === 0) return 'no-gaps';
  return 'ready';
}

export default function GarmentGapsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { locale, t } = useLanguage();
  const { user } = useAuth();
  const { data: garmentCount } = useGarmentCount();
  const { isUnlocked } = useWardrobeUnlocks();
  const gapAnalysis = useWardrobeGapAnalysis();
  const snapshot = useMemo(() => loadGapSnapshot(user?.id), [user?.id]);
  const [results, setResults] = useState<GapResult[] | null>(snapshot?.results ?? null);
  const [analysisTimestamp, setAnalysisTimestamp] = useState<string | null>(snapshot?.analyzedAt ?? null);
  const [isAutorunPending, setIsAutorunPending] = useState(() =>
    readGapNavigationIntent({ search: location.search, state: location.state }).autorun,
  );
  const [refreshError, setRefreshError] = useState(false);
  const hasTriggeredAutorun = useRef(false);

  const unlocked = isUnlocked('gap_analysis');
  const count = garmentCount ?? 0;
  const hasResults = results !== null;
  const viewState = deriveViewState({
    hasError: gapAnalysis.isError,
    hasResults,
    isAutorunPending,
    isLoading: gapAnalysis.isPending,
    isUnlocked: unlocked,
    results,
  });

  useEffect(() => {
    if (!snapshot || results !== null) return;
    setResults(snapshot.results);
    setAnalysisTimestamp(snapshot.analyzedAt);
  }, [results, snapshot]);

  const handleScan = useCallback(async () => {
    if (!user || !unlocked || gapAnalysis.isPending) return;

    hapticSuccess();
    setRefreshError(false);
    setIsAutorunPending(false);

    try {
      const data = await gapAnalysis.mutateAsync({ locale });
      const nextResults = data?.gaps ?? [];
      const analyzedAt = new Date().toISOString();
      setResults(nextResults);
      setAnalysisTimestamp(analyzedAt);
      saveGapSnapshot(user.id, { analyzedAt, results: nextResults });
    } catch {
      if (results) {
        setRefreshError(true);
        return;
      }
    }
  }, [gapAnalysis, locale, results, unlocked, user]);

  useEffect(() => {
    if (!isAutorunPending || hasTriggeredAutorun.current || !user || !unlocked) return;

    hasTriggeredAutorun.current = true;
    void navigate(buildGapsPath(), {
      replace: true,
      state: { source: 'gaps' },
    });
    void handleScan();
  }, [handleScan, isAutorunPending, navigate, unlocked, user]);

  return (
    <AppLayout>
      <PageHeader
        title={t('gaps.garment_gaps') || 'Wardrobe Gaps'}
        eyebrow={t('gaps.wardrobe_intelligence') || 'Wardrobe Intelligence'}
        showBack
      />
      <AnimatedPage className="mx-auto flex max-w-5xl flex-col gap-5 px-5 pb-24 pt-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: EASE_CURVE }}
        >
          <GapHero currentCount={count} isUnlocked={unlocked} hasSnapshot={hasResults} />
        </motion.div>

        <AnimatePresence initial={false} mode="wait">
          {viewState === 'locked' ? <GapLockedState key="locked" /> : null}
          {viewState === 'ready' ? <GapReadyState key="ready" onScan={() => void handleScan()} /> : null}
          {viewState === 'autorun' ? <GapAutorunState key="autorun" /> : null}
          {viewState === 'loading' ? <GapLoadingState key="loading" /> : null}
          {viewState === 'error' ? <GapErrorState key="error" onRetry={() => void handleScan()} /> : null}
          {viewState === 'results' && results ? (
            <GapResultsPanel
              key="results"
              analyzedAt={analysisTimestamp}
              hasRefreshError={refreshError}
              onRefresh={() => void handleScan()}
              results={results}
            />
          ) : null}
          {viewState === 'no-gaps' ? (
            <GapNoGapsState key="no-gaps" onRefresh={() => void handleScan()} />
          ) : null}
        </AnimatePresence>
      </AnimatedPage>
    </AppLayout>
  );
}
