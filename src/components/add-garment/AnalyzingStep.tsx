import { motion } from 'framer-motion';
import { CheckCircle, RefreshCw } from 'lucide-react';

import { AppLayout } from '@/components/layout/AppLayout';
import { AnimatedPage } from '@/components/ui/animated-page';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { GarmentAnalysisState } from '@/components/ui/GarmentAnalysisState';
import { PageIntro } from '@/components/ui/page-intro';
import { Progress } from '@/components/ui/progress';

interface AnalyzingStepProps {
  analysisError: string | null;
  analysisSummary: string | null;
  imagePreview: string | null;
  reviewText: string;
  processingLabel: string;
  retryLabel: string;
  cancelLabel: string;
  onRetry: () => void;
  onCancel: () => void;
}

export function AnalyzingStep({
  analysisError,
  analysisSummary,
  imagePreview,
  reviewText,
  processingLabel,
  retryLabel,
  cancelLabel,
  onRetry,
  onCancel,
}: AnalyzingStepProps) {
  return (
    <AppLayout hideNav>
      <AnimatedPage className="page-shell !max-w-lg !px-5 !pt-8 page-cluster">
        <Card surface="editorial" className="p-6">
          <PageIntro
            center
            eyebrow="Analyzing"
            title="Reviewing your garment."
            description={processingLabel}
            actions={<Button variant="quiet" onClick={onCancel}>{cancelLabel}</Button>}
          />
        </Card>

        {analysisError ? (
          <Card surface="utility" className="space-y-5 p-5 text-center">
            {imagePreview ? (
              <div className="mx-auto aspect-square w-52 overflow-hidden rounded-[1.1rem] bg-secondary/60">
                <img src={imagePreview} alt="Preview" className="h-full w-full object-cover" />
              </div>
            ) : null}
            <p className="text-sm leading-6 text-destructive">{analysisError}</p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="outline" onClick={onCancel}>{cancelLabel}</Button>
              <Button onClick={onRetry}>
                <RefreshCw className="mr-2 h-4 w-4" />
                {retryLabel}
              </Button>
            </div>
          </Card>
        ) : analysisSummary ? (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card surface="utility" className="space-y-3 p-5 text-center">
              <CheckCircle className="mx-auto h-6 w-6 text-accent" />
              <p className="text-base font-medium text-foreground">{analysisSummary}</p>
              <p className="text-sm text-muted-foreground">{reviewText}</p>
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{processingLabel}</p>
            </Card>
          </motion.div>
        ) : (
          <Card surface="utility" className="space-y-5 p-5">
            <GarmentAnalysisState imageUrl={imagePreview} />
            <div className="space-y-2">
              <Progress value={undefined} className="h-1.5 animate-pulse" />
              <p className="text-center text-sm text-muted-foreground">{processingLabel}</p>
            </div>
          </Card>
        )}
      </AnimatedPage>
    </AppLayout>
  );
}
