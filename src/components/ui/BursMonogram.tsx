import { cn } from '@/lib/utils';
import { useTheme } from '@/contexts/ThemeContext';
import monogramDark from '@/assets/burs-monogram.png';
import monogramWhite from '@/assets/burs-logo-white.png';

interface BursMonogramProps {
  size?: number;
  className?: string;
}

export function BursMonogram({ size = 40, className }: BursMonogramProps) {
  const { resolvedTheme } = useTheme();
  const src = resolvedTheme === 'dark' ? monogramWhite : monogramDark;

  return (
    <img
      src={src}
      alt="BURS"
      width={size}
      height={size}
      className={cn('flex-shrink-0 object-contain', className)}
      style={{ imageRendering: 'auto' }}
    />
  );
}
