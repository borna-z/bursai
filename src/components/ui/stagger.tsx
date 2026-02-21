import { motion } from 'framer-motion';
import { EASE_CURVE } from '@/lib/motion';
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
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'tween' as const,
      ease: EASE_CURVE,
      duration: 0.4,
    },
  },
};

export function StaggerContainer({
  children,
  className,
  delay = 0.05,
  stagger = 0.06,
}: StaggerContainerProps) {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      custom={{ delay, stagger }}
      className={cn(className)}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className }: StaggerItemProps) {
  return (
    <motion.div variants={itemVariants} className={cn(className)}>
      {children}
    </motion.div>
  );
}
