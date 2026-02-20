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
      {/* Hook ring */}
      <path
        d="M32 4C28 4 25 7 25 11C25 14 27 16.5 30 17L30 24"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
      {/* Hanger body */}
      <path
        d="M32 17L12 38C10.5 39.5 11.5 42 13.5 42H50.5C52.5 42 53.5 39.5 52 38L32 17Z"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinejoin="round"
        strokeLinecap="round"
        fill="none"
      />
      {/* Stylised B crossbar */}
      <path
        d="M22 34H42"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {/* Bottom bar for the B shape */}
      <path
        d="M18 42L18 52C18 55 20 57 23 57L32 57"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M32 57C36 57 39 55.5 39 52.5C39 49.5 36.5 48 33 48H28"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}
