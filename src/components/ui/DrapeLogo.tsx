import { cn } from '@/lib/utils';
import { useTheme } from '@/contexts/ThemeContext';
import { BursMonogram } from './BursMonogram';

interface DrapeLogoProps {
  variant?: 'icon' | 'wordmark' | 'horizontal';
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  tinted?: boolean;
}

const sizeMap = {
  sm: { icon: 28, text: 'text-sm' },
  md: { icon: 40, text: 'text-base' },
  lg: { icon: 48, text: 'text-lg' },
  xl: { icon: 64, text: 'text-2xl' }
};

export function DrapeLogo({ variant = 'horizontal', className, size = 'md', tinted = true }: DrapeLogoProps) {
  const { accentColor } = useTheme();
  const { icon: iconSize, text: textSize } = sizeMap[size];

  const Icon = <BursMonogram size={iconSize} />;

  const Wordmark = (
    <span
      className={cn(
        'font-heading font-bold tracking-[0.12em] leading-none',
        textSize
      )}
      style={{
        fontFamily: "'Sora', sans-serif",
        color: tinted ? accentColor.hex : undefined
      }}
    >
      BURS
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

// Backward-compatible alias
export const BursLogo = DrapeLogo;
