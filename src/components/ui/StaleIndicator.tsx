/**
 * StaleIndicator — Shows "last updated X ago" for AI-generated content.
 * Step 17: Stale Data Indicators
 */
import { useMemo } from 'react';
import { Clock } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface StaleIndicatorProps {
  /** ISO timestamp of when the data was last generated/fetched */
  updatedAt: string | null | undefined;
  /** Auto-refresh threshold in hours (default: 24) */
  staleAfterHours?: number;
  /** Called when stale and auto-refresh triggered */
  onRefresh?: () => void;
  className?: string;
}

function formatRelativeTime(date: Date, t: (k: string) => string): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHr / 24);

  if (diffMin < 1) return t('common.just_now');
  if (diffMin < 60) return `${diffMin}m ${t('insights.ago')}`;
  if (diffHr < 24) return `${diffHr}h ${t('insights.ago')}`;
  return `${diffDays}d ${t('insights.ago')}`;
}

export function StaleIndicator({
  updatedAt,
  staleAfterHours = 24,
  onRefresh,
  className = '',
}: StaleIndicatorProps) {
  const { t } = useLanguage();

  const { label, isStale } = useMemo(() => {
    if (!updatedAt) return { label: '', isStale: false };
    const date = new Date(updatedAt);
    if (isNaN(date.getTime())) return { label: '', isStale: false };

    const diffHr = (Date.now() - date.getTime()) / 3600000;
    return {
      label: formatRelativeTime(date, t),
      isStale: diffHr >= staleAfterHours,
    };
  }, [updatedAt, staleAfterHours, t]);

  // Auto-refresh if stale
  useMemo(() => {
    if (isStale && onRefresh) {
      onRefresh();
    }
  }, [isStale, onRefresh]);

  if (!updatedAt || !label) return null;

  return (
    <span className={`inline-flex items-center gap-1 text-[10px] text-muted-foreground/60 ${className}`}>
      <Clock className="w-2.5 h-2.5" />
      {label}
    </span>
  );
}
