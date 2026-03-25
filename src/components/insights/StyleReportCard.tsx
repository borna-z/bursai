import { useState } from 'react';
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
  archetype: string;
  colorConfidence: number;
  formalityRange: string;
  adventurousness: number;
  summary: string;
}

export function StyleReportCard({ isPremium }: { isPremium: boolean }) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [report, setReport] = useState<StyleReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);

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

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Award className="w-4 h-4 text-muted-foreground/50" />
        <span className="label-editorial">
          {t('insights.style_report')}
        </span>
      </div>
      <div className={cn(!isPremium && "relative")}>
        <div className={cn(!isPremium && "blur-sm select-none")}>
          {!report && !loading && (
            <Button
              variant="outline"
              size="sm"
              className="w-full rounded-xl"
              onClick={generate}
            >
              <Sparkles className="w-3.5 h-3.5 mr-1.5" />{t('insights.generate_report')}
            </Button>
          )}

          {loading && (
            <AILoadingCard
              phases={[
                { icon: BarChart3, label: t('insights.analyzing_wardrobe') || 'Analyzing wardrobe...', duration: 1500 },
                { icon: Sparkles, label: t('insights.computing_scores') || 'Computing scores...', duration: 2000 },
                { icon: Pencil, label: t('insights.writing_report') || 'Writing report...', duration: 0 },
              ]}
            />
          )}

          {report && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              {/* Archetype badge */}
              <div className="text-center py-3">
                <span className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary text-[0.8125rem] font-bold tracking-[-0.01em]">
                  {report.archetype}
                </span>
                <p className="caption mt-2">{t('insights.your_archetype')}</p>
              </div>

              {/* Scores */}
              <div className="grid grid-cols-2 gap-3">
                <ScorePill label={t('insights.color_confidence')} value={report.colorConfidence} />
                <ScorePill label={t('insights.adventurousness')} value={report.adventurousness} />
              </div>

              <div className="rounded-xl bg-muted/40 p-3 text-center">
                <p className="text-xs text-muted-foreground/70 uppercase tracking-wider mb-1">{t('insights.formality_range')}</p>
                <p className="text-sm font-medium">{report.formalityRange}</p>
              </div>

              {/* Summary */}
              <p className="text-sm text-muted-foreground leading-relaxed">{report.summary}</p>
              <StaleIndicator updatedAt={generatedAt} staleAfterHours={24} onRefresh={generate} />
            </motion.div>
          )}
        </div>
        {!isPremium && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Lock className="w-5 h-5 text-muted-foreground/40" />
          </div>
        )}
      </div>
    </div>
  );
}

function ScorePill({ label, value }: { label: string; value: number }) {
  const pct = Math.min(Math.max(value, 0), 100);
  return (
    <div className="rounded-xl bg-muted/40 border border-border/10 p-3 text-center">
      <span className="text-[1.375rem] font-bold tabular-nums tracking-tight">{pct}</span>
      <span className="text-[0.6875rem] text-muted-foreground/50 font-medium">/100</span>
      <p className="caption mt-1">{label}</p>
    </div>
  );
}
