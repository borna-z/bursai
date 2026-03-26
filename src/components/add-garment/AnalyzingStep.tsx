import { motion } from 'framer-motion';
import { CheckCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GarmentAnalysisState } from '@/components/ui/GarmentAnalysisState';
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
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-8">
      <div className="flex flex-col items-center gap-6 w-full max-w-xs">
        {analysisError ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center gap-4 w-full"
          >
            {imagePreview && (
              <div className="aspect-square w-48 overflow-hidden bg-secondary/60">
                <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
              </div>
            )}
            <p className="text-sm text-destructive text-center">{analysisError}</p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={onCancel}>
                {cancelLabel}
              </Button>
              <Button onClick={onRetry}>
                <RefreshCw className="w-4 h-4 mr-2" />
                {retryLabel}
              </Button>
            </div>
          </motion.div>
        ) : analysisSummary ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="flex flex-col items-center gap-2 bg-card p-4 w-full shadow-sm"
          >
            <CheckCircle className="w-6 h-6 text-accent" />
            <p className="font-medium text-center">{analysisSummary}</p>
            <p className="text-xs text-muted-foreground">{reviewText}</p>
            <p className="text-xs text-muted-foreground">{processingLabel}</p>
          </motion.div>
        ) : (
          <div className="w-full space-y-4">
            <GarmentAnalysisState imageUrl={imagePreview} />
            <div className="space-y-2">
              <Progress value={undefined} className="h-1.5 animate-pulse" />
              <p className="text-sm text-muted-foreground text-center">{processingLabel}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
