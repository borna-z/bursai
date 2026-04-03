import { ArrowRight } from 'lucide-react';

import { InsightsSection } from '@/components/insights/InsightsSection';
import type { InsightsActionItem } from '@/components/insights/useInsightsDashboardAdapter';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const TONE_CLASS: Record<InsightsActionItem['tone'], string> = {
  neutral: 'bg-foreground/22',
  positive: 'bg-accent/45',
  warning: 'bg-accent',
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
      title="What to do next"
    >
      <div className="divide-y divide-border/35" data-testid="action-center">
        {actions.map((action) => (
          <div key={action.id} className="grid gap-4 py-4 sm:grid-cols-[8px_minmax(0,1fr)_auto] sm:items-center sm:gap-5">
            <div className={cn('hidden h-10 rounded-full sm:block', TONE_CLASS[action.tone])} />
            <div className="space-y-1">
              <h3 className="text-[0.98rem] font-medium tracking-[-0.03em] text-foreground">
                {action.title}
              </h3>
              <p className="text-[0.82rem] leading-5 text-muted-foreground/74">
                {action.detail}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="justify-self-start rounded-full px-4 sm:justify-self-end"
              onClick={() => onAction(action)}
            >
              {action.cta}
              <ArrowRight className="size-4" />
            </Button>
          </div>
        ))}
      </div>
    </InsightsSection>
  );
}
