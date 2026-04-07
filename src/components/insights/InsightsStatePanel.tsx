import {
  AlertCircle,
  CalendarDays,
  Shirt,
  Sparkles,
} from 'lucide-react';

import { EmptyState } from '@/components/layout/EmptyState';

export function InsightsStatePanel({
  kind,
  onPrimary,
  onSecondary,
}: {
  kind: 'empty' | 'no-wear-data' | 'error';
  onPrimary: () => void;
  onSecondary?: () => void;
}) {
  if (kind === 'empty') {
    return (
      <EmptyState
        icon={Shirt}
        title="Build your wardrobe first"
        description="Insights becomes meaningful once BURS can read a real wardrobe. Add garments or scan the first pieces in."
        action={{ label: 'Add garments', onClick: onPrimary, icon: Sparkles }}
        secondaryAction={onSecondary ? { label: 'Open wardrobe', onClick: onSecondary } : undefined}
        variant="editorial"
        compact
        className="rounded-[1.6rem]"
      />
    );
  }

  if (kind === 'no-wear-data') {
    return (
      <EmptyState
        icon={CalendarDays}
        title="Your wardrobe is ready, but wear history is still quiet"
        description="Start from the outfits you already wear. As activity comes in, Insights will unlock repeat behavior, formulas, and dormant pieces."
        action={{ label: 'Go to outfits', onClick: onPrimary, icon: Sparkles }}
        secondaryAction={onSecondary ? { label: 'Open wardrobe', onClick: onSecondary } : undefined}
        variant="editorial"
        compact
        className="rounded-[1.6rem]"
      />
    );
  }

  return (
    <EmptyState
      icon={AlertCircle}
      title="Insights could not refresh right now"
      description="The wardrobe intelligence layer hit a problem. Pull to refresh or try again in a moment."
      action={{ label: 'Retry insights', onClick: onPrimary, icon: Sparkles }}
      secondaryAction={onSecondary ? { label: 'Open wardrobe', onClick: onSecondary } : undefined}
      variant="editorial"
      compact
      className="rounded-[1.6rem]"
    />
  );
}
