import { useInsights } from '@/hooks/useInsights';
import { useLanguage } from '@/contexts/LanguageContext';
import { Skeleton } from '@/components/ui/skeleton';
import { StaleIndicator } from '@/components/ui/StaleIndicator';

function MiniUsageRing({ percentage }: { percentage: number }) {
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <svg width="48" height="48" viewBox="0 0 48 48" className="flex-shrink-0">
      <circle cx="24" cy="24" r={radius} fill="none" stroke="hsl(var(--muted))" strokeWidth="3" />
      <circle
        cx="24" cy="24" r={radius} fill="none"
        stroke="hsl(var(--accent))" strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform="rotate(-90 24 24)"
        className="transition-all duration-700"
      />
      <text x="24" y="25" textAnchor="middle" dominantBaseline="central"
        className="fill-foreground text-[11px] font-semibold"
      >
        {percentage}%
      </text>
    </svg>
  );
}

export function InsightsBanner() {
  const { t } = useLanguage();
  const { data: insights, isLoading, dataUpdatedAt, refetch } = useInsights();

  if (isLoading) {
    return <Skeleton className="h-[72px] w-full rounded-2xl" />;
  }

  if (!insights || insights.totalGarments === 0) return null;

  return (
    <div
      className="w-full flex items-center gap-4 rounded-2xl bg-card/50 backdrop-blur border border-border/20 p-4 text-left"
    >
      <MiniUsageRing percentage={insights.usageRate} />

      <div className="flex-1 min-w-0 space-y-0.5">
        <p className="text-[13px] font-medium text-foreground">
          {t('insights.wardrobe_usage')}
          <StaleIndicator
            updatedAt={dataUpdatedAt ? new Date(dataUpdatedAt).toISOString() : null}
            onRefresh={() => refetch()}
            className="ml-2"
          />
        </p>
        <p className="text-[12px] text-muted-foreground/60">
          {insights.garmentsUsedLast30Days}/{insights.totalGarments} {t('insights.used_label')} · {insights.unusedGarments.length} {t('insights.unused_label')}
        </p>
      </div>

    </div>
  );
}
