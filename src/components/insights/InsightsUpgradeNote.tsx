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
    <div className="rounded-[1.05rem] border border-border/45 bg-background/45 px-4 py-3">
      <div className="flex items-start gap-3">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-[0.8rem] bg-secondary/70 text-foreground/64">
          <Lock className="size-3.5" />
        </div>
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="text-[0.74rem] font-medium uppercase tracking-[0.18em] text-muted-foreground/66">
            Premium depth
          </p>
          <h4 className="text-[0.94rem] font-medium tracking-[-0.03em] text-foreground">
            {title}
          </h4>
          <p className="text-[0.84rem] leading-5 text-muted-foreground">
            {detail}
          </p>
        </div>
      </div>

      <Button variant="outline" size="sm" className="mt-3 rounded-full px-4" onClick={onOpenPricing}>
        <Sparkles className="size-4" />
        {cta}
      </Button>
    </div>
  );
}
