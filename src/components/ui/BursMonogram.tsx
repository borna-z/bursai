import { cn } from '@/lib/utils';

interface BursMonogramProps {
  size?: number;
  className?: string;
}

export function BursMonogram({ size = 32, className }: BursMonogramProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('flex-shrink-0', className)}
      aria-label="BURS"
    >
      {/* Geometric "B" monogram with fabric-fold aesthetic */}
      <path
        d="M16 8h18c7.2 0 13 4.8 13 11.5 0 4.2-2.4 7.8-6 9.8 4.8 2 8 6.2 8 11.2C49 48.4 42.6 54 34.5 54H16V8z"
        fill="currentColor"
      />
      {/* Inner cutouts for the "B" bowls */}
      <path
        d="M26 17v9h7.5c3.6 0 6.5-2 6.5-4.5S37.1 17 33.5 17H26z"
        fill="hsl(var(--background))"
      />
      <path
        d="M26 34v11h8c4 0 7-2.4 7-5.5S38 34 34 34h-8z"
        fill="hsl(var(--background))"
      />
      {/* Subtle fold line — optional accent */}
      <line
        x1="16" y1="31" x2="49" y2="31"
        stroke="hsl(var(--background))"
        strokeWidth="1.5"
        opacity="0.15"
      />
    </svg>
  );
}
