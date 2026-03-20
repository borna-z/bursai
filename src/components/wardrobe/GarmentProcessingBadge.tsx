import { Badge } from '@/components/ui/badge';
import { getGarmentProcessingMessage } from '@/lib/garmentImage';
import { cn } from '@/lib/utils';

interface GarmentProcessingBadgeProps {
  status?: string | null;
  className?: string;
}

export function GarmentProcessingBadge({ status, className }: GarmentProcessingBadgeProps) {
  const message = getGarmentProcessingMessage(status);

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
