import { cn } from '@/lib/utils';
import bursLogo from '@/assets/burs-logo-white.png';

interface BursMonogramProps {
  size?: number;
  className?: string;
}

export function BursMonogram({ size = 32, className }: BursMonogramProps) {
  return (
    <img
      src={bursLogo}
      alt="BURS"
      className={cn(
        'object-contain brightness-0',
        className
      )}
      style={{ width: size, height: 'auto' }}
      draggable={false}
    />
  );
}
