import { useMemo, useState } from 'react';
import { Award, Lock, Sparkles, BarChart3, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AILoadingCard } from '@/components/ui/AILoadingCard';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { invokeEdgeFunction } from '@/lib/edgeFunctionClient';
import { StaleIndicator } from '@/components/ui/StaleIndicator';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

interface StyleReport {
  archetype?: string | null;
  colorConfidence?: number | null;
  formalityRange?: string | null;
  adventurousness?: number | null;
  summary?: string | null;
}

function sanitizeScore(value: number | null | undefined) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Math.min(100, Math.max(0, Math.round(numeric)));
}

function sanitizeText(value: string | null | undefined) {
  return typeof value === 'string' ? value.trim() : '';
}

export function StyleReportCard({ isPremium, className }: { isPremium: boolean; className?: string }) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [report, setReport] = useState<StyleReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);

  const normalizedReport = useMemo(() => {
    if (!report) return null;

    return {
      archetype: sanitizeText(report.archetype),
      colorConfidence: sanitizeScore(report.colorConfidence),
      adventurousness: sanitizeScore(report.adventurousness),
      formalityRange: sanitizeText(report.formalityRange),
      summary: sanitizeText(report.summary),
    };
  }, [report]);

  const hasMeaningfulReport = Boolean(
    normalizedReport
    && (
      normalizedReport.archetype
      || normalizedReport.formalityRange
      || normalizedReport.summary
      || normalizedReport.colorConfidence !== null
      || normalizedReport.adventurousness !== null
    ),
  );

  const generate = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await invokeEdgeFunction<StyleReport & { error?: string }>('burs_style_engine', {
        timeout: 45000,
        body: {
          action: 'style_report',
          user_id: user.id,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setReport(data as StyleReport);
      setGeneratedAt(new Date().toISOString());
    } catch {
      toast.error(t('insights.report_error'));
    } finally {
      setLoading(false);
    }
  };

  if (!isPremium) {
    return (
      <div className={cn('surface-secondary space-y-3 p-4', className)}>
        <div className="flex items-center gap-2">
          <Award className="w-4 h-4 text-muted-foreground/50" />
          <span className="label-editorial">
            {t('insights.style_report')}
          </span>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-xl border border-border/12 bg-background/55 px-3.5 py-3">
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">Locked</p>
            <p className="text-xs leading-5 text-muted-foreground">
              Unlock a compact read on archetype, color confidence, and formality.
            </p>
          </div>
          <div className="rounded-full border border-border/20 bg-background/75 p-2.5">
            <Lock className="w-4 h-4 text-muted-foreground/60" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('surface-secondary space-y-4 p-4', className)}>
      <div className="flex items-center gap-2">
        <Award className="w-4 h-4 text-muted-foreground/50" />
        <span className="label-editorial">
          {t('insights.style_report')}
        </span>
      </div>

      {!normalizedReport && !loading ? (
        <div className="space-y-3 rounded-xl border border-border/12 bg-background/55 p-3.5">
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">Generate a compact style read</p>
            <p className="text-xs leading-5 text-muted-foreground">
              Archetype, color confidence, formality, and adventurousness in one pass.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={generate}
          >
            <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            {t('insights.generate_report')}
          </Button>
        </div>
      ) : null}

      {loading ? (
        <AILoadingCard
          phases={[
            { icon: BarChart3, label: t('insights.analyzing_wardrobe') || 'Analyzing wardrobe...', duration: 1500 },
            { icon: Sparkles, label: t('insights.computing_scores') || 'Computing scores...', duration: 2000 },
            { icon: Pencil, label: t('insights.writing_report') || 'Writing report...', duration: 0 },
          ]}
        />
      ) : null}

      {normalizedReport && !hasMeaningfulReport ? (
        <div className="space-y-3 rounded-xl border border-border/12 bg-background/55 p-3.5">
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">Report unavailable</p>
            <p className="text-xs leading-5 text-muted-foreground">
              Wear and save a few more complete looks, then generate again.
            </p>
          </div>
          <Button variant="outline" size="sm" className="rounded-full" onClick={generate}>
            <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            Generate again
          </Button>
        </div>
      ) : null}

      {normalizedReport && hasMeaningfulReport ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <div className="space-y-2 text-center">
            <span className="inline-block rounded-full bg-primary/10 px-4 py-1.5 text-[0.8125rem] font-bold tracking-[-0.01em] text-primary">
              {normalizedReport.archetype || 'Developing'}
            </span>
            <p className="caption">{t('insights.your_archetype')}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <ScorePill label={t('insights.color_confidence')} value={normalizedReport.colorConfidence} />
            <ScorePill label={t('insights.adventurousness')} value={normalizedReport.adventurousness} />
          </div>

          {normalizedReport.formalityRange ? (
            <div className="rounded-xl bg-muted/40 p-3 text-center">
              <p className="mb-1 text-xs uppercase tracking-wider text-muted-foreground/70">{t('insights.formality_range')}</p>
              <p className="text-sm font-medium">{normalizedReport.formalityRange}</p>
            </div>
          ) : null}

          {normalizedReport.summary ? (
            <p className="text-sm leading-relaxed text-muted-foreground">{normalizedReport.summary}</p>
          ) : null}
          <StaleIndicator updatedAt={generatedAt} staleAfterHours={24} onRefresh={generate} />
        </motion.div>
      ) : null}
    </div>
  );
}

function ScorePill({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="rounded-xl border border-border/10 bg-muted/40 p-3 text-center">
      <span className="text-[1.375rem] font-bold tabular-nums tracking-tight">
        {value ?? '--'}
      </span>
      <span className="text-[0.6875rem] font-medium text-muted-foreground/50">/100</span>
      <p className="caption mt-1">{label}</p>
    </div>
  );
}
