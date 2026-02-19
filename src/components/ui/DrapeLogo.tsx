import drapeLogoSrc from '@/assets/drape-logo.png';
import { cn } from '@/lib/utils';

interface DrapeLogoProps {
  variant?: 'icon' | 'wordmark' | 'horizontal';
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const sizeMap = {
  sm: { icon: 24, text: 'text-sm' },
  md: { icon: 32, text: 'text-base' },
  lg: { icon: 40, text: 'text-lg' },
  xl: { icon: 56, text: 'text-2xl' },
};

export function DrapeLogo({ variant = 'horizontal', className, size = 'md' }: DrapeLogoProps) {
  const { icon: iconSize, text: textSize } = sizeMap[size];

  const Icon = (
    <img
      src={drapeLogoSrc}
      alt="DRAPE"
      width={iconSize}
      height={iconSize}
      className="object-contain flex-shrink-0"
      style={{ imageRendering: 'auto' }}
    />
  );

  const Wordmark = (
    <span
      className={cn(
        'font-heading font-bold tracking-[0.12em] text-foreground leading-none',
        textSize
      )}
      style={{ fontFamily: "'Sora', sans-serif" }}
    >
      DRAPE
    </span>
  );

  if (variant === 'icon') {
    return <span className={cn('inline-flex', className)}>{Icon}</span>;
  }

  if (variant === 'wordmark') {
    return <span className={cn('inline-flex items-center', className)}>{Wordmark}</span>;
  }

  // horizontal: icon + wordmark
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      {Icon}
      {Wordmark}
    </span>
  );
}
