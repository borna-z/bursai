import { Badge } from '@/components/ui/badge';
import { getGarmentProcessingMessage, type GarmentDisplaySource } from '@/lib/garmentImage';
import { cn } from '@/lib/utils';

interface GarmentProcessingBadgeProps {
  renderStatus?: string | null;
  className?: string;
  displaySource?: GarmentDisplaySource;
}

export function GarmentProcessingBadge({ renderStatus, className, displaySource = 'original' }: GarmentProcessingBadgeProps) {
  const message = getGarmentProcessingMessage(renderStatus, displaySource);

  if (!message) return null;

  return (
    <Badge
      variant="secondary"
      className={cn(
        'border-transparent text-[10px] font-medium',
        message.tone === 'success'
          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
          : 'bg-background/80 text-muted-foreground',
        className,
      )}
    >
      {message.label}
    </Badge>
  );
}
