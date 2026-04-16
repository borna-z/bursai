import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StaleIndicator } from '@/components/ui/StaleIndicator';
import { EASE_CURVE } from '@/lib/motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { useGarmentsByIds, type GarmentBasic } from '@/hooks/useGarmentsByIds';
import type { GapResult } from '@/components/gaps/gapTypes';
import { GapHeroCard } from './GapHeroCard';
import { GapSecondaryCard } from './GapSecondaryCard';

interface GapResultsPanelProps {
  analyzedAt: string | null;
  hasRefreshError?: boolean;
  onRefresh: () => void;
  results: GapResult[];
}

export function GapResultsPanel({
  analyzedAt,
  hasRefreshError,
  onRefresh,
  results,
}: GapResultsPanelProps) {
  const { t } = useLanguage();

  const pairingIds = useMemo(() => {
    const set = new Set<string>();
    for (const gap of results) {
      for (const id of gap.pairing_garment_ids ?? []) set.add(id);
    }
    return Array.from(set);
  }, [results]);

  const { data: pairingGarments } = useGarmentsByIds(pairingIds);
  const garmentMap = useMemo(
    () => new Map<string, GarmentBasic>((pairingGarments ?? []).map((g) => [g.id, g])),
    [pairingGarments],
  );

  if (results.length === 0) return null;

  const [featured, ...rest] = results;

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: EASE_CURVE }}
      className="mt-5 border-t border-border/40 pt-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[0.72rem] uppercase tracking-[0.22em] text-muted-foreground/65">{t('gaps.results_label')}</p>
          <h2 className="mt-1 font-display italic text-[1.3rem] tracking-[-0.02em] text-foreground">{t('gaps.results_title')}</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StaleIndicator updatedAt={analyzedAt} />
          <Button onClick={onRefresh} variant="outline" className="rounded-full px-4">
            <RefreshCw className="size-4" />{t('gaps.refresh_scan')}
          </Button>
        </div>
      </div>

      {hasRefreshError ? (
        <div className="mt-3 border-l-2 border-destructive/40 py-2 pl-3 text-[0.88rem] text-foreground">{t('gaps.refresh_error')}</div>
      ) : null}

      <GapHeroCard gap={featured} garmentMap={garmentMap} />

      {rest.length > 0 ? (
        <div>
          {rest.map((gap, idx) => (
            <GapSecondaryCard key={`${idx}-${gap.search_query}`} gap={gap} index={idx} />
          ))}
        </div>
      ) : null}
    </motion.section>
  );
}
