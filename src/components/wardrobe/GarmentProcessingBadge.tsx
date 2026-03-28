import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { getGarmentProcessingMessage, type GarmentDisplaySource } from '@/lib/garmentImage';
import { cn } from '@/lib/utils';

interface GarmentProcessingBadgeProps {
  status?: string | null;
  renderStatus?: string | null;
  className?: string;
  displaySource?: GarmentDisplaySource;
}

export function GarmentProcessingBadge({ status, renderStatus, className, displaySource = 'original' }: GarmentProcessingBadgeProps) {
  const { t } = useLanguage();
  const message = getGarmentProcessingMessage(status, renderStatus, displaySource);

  if (!message) return null;

  const translatedLabel = ({
    'Rendering mannequin image in background': t('garment.processing.rendering_background'),
    'Using cleaned cutout': t('garment.processing.using_cleaned_cutout'),
    'Using original photo': t('garment.processing.using_original_photo'),
    'Preparing image in background': t('garment.processing.preparing_image'),
    'Background cleanup in progress': t('garment.processing.background_cleanup'),
    'Using rendered mannequin image': t('garment.processing.using_rendered_image'),
  } as const)[message.label] ?? message.label;

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
      {translatedLabel}
    </Badge>
  );
}
