import { ArrowRight } from 'lucide-react';

import { InsightsSection } from '@/components/insights/InsightsSection';
import type { InsightsActionItem } from '@/components/insights/useInsightsDashboardAdapter';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const TONE_CLASS: Record<InsightsActionItem['tone'], string> = {
  neutral: 'bg-background/62',
  positive: 'bg-emerald-400/8',
  warning: 'bg-amber-400/10',
};

export function InsightsActionCenter({
  actions,
  onAction,
}: {
  actions: InsightsActionItem[];
  onAction: (action: InsightsActionItem) => void;
}) {
  return (
    <InsightsSection
      id="action-center"
      eyebrow="Action center"
      title="What to do next, based on the wardrobe you actually have."
      description="Insights only matters if it moves the user forward. Every action here is anchored to a real signal from the dashboard."
    >
      <div className="surface-secondary rounded-[1.6rem] p-5 sm:p-6">
        <div className="grid gap-3 lg:grid-cols-2" data-testid="action-center">
          {actions.map((action) => (
            <div
              key={action.id}
              className={cn('rounded-[1.2rem] border border-border/45 p-4', TONE_CLASS[action.tone])}
            >
              <p className="text-[0.72rem] uppercase tracking-[0.18em] text-muted-foreground/64">
                Recommended move
              </p>
              <h3 className="mt-3 text-[1rem] font-semibold tracking-[-0.03em] text-foreground">
                {action.title}
              </h3>
              <p className="mt-2 text-[0.88rem] leading-6 text-muted-foreground">
                {action.detail}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4 rounded-full px-4"
                onClick={() => onAction(action)}
              >
                {action.cta}
                <ArrowRight className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    </InsightsSection>
  );
}
