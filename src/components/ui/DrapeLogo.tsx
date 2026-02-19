import drapeLogoSrc from '@/assets/drape-logo.png';
import { cn } from '@/lib/utils';
import { useTheme } from '@/contexts/ThemeContext';

interface DrapeLogoProps {
  variant?: 'icon' | 'wordmark' | 'horizontal';
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  tinted?: boolean;
}

const sizeMap = {
  sm: { icon: 24, text: 'text-sm' },
  md: { icon: 32, text: 'text-base' },
  lg: { icon: 40, text: 'text-lg' },
  xl: { icon: 56, text: 'text-2xl' },
};

export function DrapeLogo({ variant = 'horizontal', className, size = 'md', tinted = true }: DrapeLogoProps) {
  const { accentColor } = useTheme();
  const { icon: iconSize, text: textSize } = sizeMap[size];

  const Icon = (
    <span className="relative inline-block flex-shrink-0" style={{ width: iconSize, height: iconSize }}>
      <img
        src={drapeLogoSrc}
        alt="DRAPE"
        width={iconSize}
        height={iconSize}
        className="object-contain dark:invert"
        style={{ imageRendering: 'auto' }}
      />
      {tinted && (
        <span
          className="absolute inset-0 mix-blend-color pointer-events-none"
          style={{ backgroundColor: accentColor.hex }}
        />
      )}
    </span>
  );

  const Wordmark = (
    <span
      className={cn(
        'font-heading font-bold tracking-[0.12em] leading-none',
        textSize
      )}
      style={{
        fontFamily: "'Sora', sans-serif",
        color: tinted ? accentColor.hex : undefined,
      }}
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

  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      {Icon}
      {Wordmark}
    </span>
  );
}
