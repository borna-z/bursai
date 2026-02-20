import { cn } from '@/lib/utils';
import hangerLogo from '@/assets/burs-hanger-logo.png';

interface BursMonogramProps {
  size?: number;
  className?: string;
}

export function BursMonogram({ size = 32, className }: BursMonogramProps) {
  return (
    <img

      alt="BURS"
      width={size}
      height={size}
      className={cn("flex-shrink-0 border-black shadow-none rounded-none object-fill", className)} src="/lovable-uploads/cf845de2-f083-487e-89a4-320be1284aaf.png" />);


}