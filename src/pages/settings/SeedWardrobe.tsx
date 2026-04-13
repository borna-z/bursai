import { useNavigate } from 'react-router-dom';
import { Trash2, Loader2, CheckCircle, AlertCircle, RotateCcw, Clock } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { AnimatedPage } from '@/components/ui/animated-page';
import { hapticLight } from '@/lib/haptics';
import { SeedProvider, useSeed } from '@/contexts/SeedContext';
import { SEED_GARMENTS } from '@/data/seedGarments';

function SeedWardrobeInner() {
  const navigate = useNavigate();
  const {
    step, results, completed, failed, totalToProcess,
    currentItem, isRunning, progress, getTimeRemaining,
    run, retryFailed, cancel,
  } = useSeed();

  return (
    <AppLayout hideNav>
      <PageHeader title="Seed Wardrobe" eyebrow="Admin" showBack />
      <AnimatedPage className="px-[var(--page-px)] pb-8 pt-5 max-w-lg mx-auto space-y-6">
        <p className="text-sm text-muted-foreground">
          This will <strong>delete all existing garments</strong> and create {SEED_GARMENTS.length} clothing items
          with AI-generated product photos. You can navigate away — seeding continues in the background.
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
          <Button onClick={() => { hapticLight(); run(); }} disabled={isRunning} className="flex-1">
            {isRunning ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> {step === 'deleting' ? 'Deleting...' : 'Generating...'}</>
            ) : (
              <><Trash2 className="w-4 h-4" /> Delete All & Create {SEED_GARMENTS.length}</>
            )}
          </Button>

          {failed > 0 && step === 'done' && (
            <Button variant="outline" onClick={() => { hapticLight(); retryFailed(); }}>
              <RotateCcw className="w-4 h-4" /> Retry {failed}
            </Button>
          )}

          {isRunning && (
            <Button variant="outline" onClick={() => { hapticLight(); cancel(); }}>
              Cancel
            </Button>
          )}
        </div>

        {step === 'done' && (
          <Button variant="outline" className="w-full" onClick={() => { hapticLight(); navigate('/wardrobe'); }}>
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

export default function SeedWardrobe() {
  return (
    <SeedProvider>
      <SeedWardrobeInner />
    </SeedProvider>
  );
}
