import { Lock, Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';

export function InsightsUpgradeNote({
  title,
  detail,
  cta,
  onOpenPricing,
}: {
  title: string;
  detail: string;
  cta: string;
  onOpenPricing: () => void;
}) {
  return (
    <div className="rounded-[1.2rem] border border-border/55 bg-background/72 p-4">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-[0.95rem] bg-secondary/75 text-foreground/70">
          <Lock className="size-4" />
        </div>
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="text-[0.78rem] font-medium uppercase tracking-[0.18em] text-muted-foreground/70">
            Premium depth
          </p>
          <h4 className="text-[0.98rem] font-semibold tracking-[-0.03em] text-foreground">
            {title}
          </h4>
          <p className="text-[0.86rem] leading-6 text-muted-foreground">
            {detail}
          </p>
        </div>
      </div>

      <Button variant="outline" size="sm" className="mt-4 rounded-full px-4" onClick={onOpenPricing}>
        <Sparkles className="size-4" />
        {cta}
      </Button>
    </div>
  );
}
