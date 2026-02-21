import { cn } from '@/lib/utils';
import hangerLogo from '@/assets/burs-logo-white.png';

interface BursMonogramProps {
  size?: number;
  className?: string;
}

export function BursMonogram({ size = 32, className }: BursMonogramProps) {
  return (
    <img
      src={hangerLogo}
      alt="BURS"
      width={size}
      height={size}
      className={cn('flex-shrink-0 object-contain', className)}
      style={{ imageRendering: 'auto' }}
    />
  );
}
