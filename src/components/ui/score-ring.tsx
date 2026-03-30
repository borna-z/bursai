import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface ScoreRingProps {
  value: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export function ScoreRing({ value, size = 132, strokeWidth = 8, className }: ScoreRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  const color =
    value >= 55
      ? 'hsl(var(--success))'
      : value >= 30
        ? 'hsl(var(--accent))'
        : 'hsl(var(--warning))';

  return (
    <svg width={size} height={size} className={cn('-rotate-90', className)}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="hsl(var(--muted))"
        strokeWidth={strokeWidth}
      />
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
      />
    </svg>
  );
}
