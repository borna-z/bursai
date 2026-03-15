import { motion, useReducedMotion } from 'framer-motion';
import { EASE_CURVE, DISTANCE, DURATION_MEDIUM, STAGGER_DELAY } from '@/lib/motion';
import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface StaggerContainerProps {
  children: ReactNode;
  className?: string;
  /** Delay before first child animates (seconds) */
  delay?: number;
  /** Stagger interval between children (seconds) */
  stagger?: number;
}

interface StaggerItemProps {
  children: ReactNode;
  className?: string;
}

const containerVariants = {
  hidden: {},
  show: (custom: { delay: number; stagger: number }) => ({
    transition: {
      delayChildren: custom.delay,
      staggerChildren: custom.stagger,
    },
  }),
};

const itemVariants = {
  hidden: { opacity: 0, y: DISTANCE.md },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'tween' as const,
      ease: EASE_CURVE,
      duration: DURATION_MEDIUM,
    },
  },
};

const reducedItemVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { type: 'tween' as const, duration: 0.1 },
  },
};

export function StaggerContainer({
  children,
  className,
  delay = 0.05,
  stagger = STAGGER_DELAY,
}: StaggerContainerProps) {
  const prefersReduced = useReducedMotion();

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      custom={{ delay, stagger: prefersReduced ? 0 : stagger }}
      className={cn(className)}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className }: StaggerItemProps) {
  const prefersReduced = useReducedMotion();

  return (
    <motion.div
      variants={prefersReduced ? reducedItemVariants : itemVariants}
      className={cn(className)}
    >
      {children}
    </motion.div>
  );
}
