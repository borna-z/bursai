import { cn } from '@/lib/utils';

interface BursMonogramProps {
  size?: number;
  className?: string;
}

export function BursMonogram({ size = 32, className }: BursMonogramProps) {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      stroke="currentColor"
      strokeWidth="6"
      strokeLinecap="round"
      strokeLinejoin="round"
      width={size}
      height={size}
      className={cn("flex-shrink-0", className)}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Klädhängarens krok */}
      <path d="M40 25 C40 12 60 12 60 25 C60 38 40 40 40 50" />
      {/* Ryggen på B:et */}
      <path d="M40 45 V 85" />
      {/* Den nedre bågen på B:et */}
      <path d="M40 85 H 65 C 80 85, 80 55, 65 55 H 40" />
      {/* Vänster del av klädhängaren */}
      <path d="M40 55 L 15 70 L 25 85 H 40" />
      {/* Höger del av klädhängaren */}
      <path d="M65 55 L 85 70 L 75 85 H 60" />
    </svg>
  );
}
