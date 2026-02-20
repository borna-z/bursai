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
      className={cn("flex-shrink-0 object-fill", className)} src="/lovable-uploads/27d60588-0ae0-4a11-b8f6-ad5063b34899.png" />);


}