import { motion, useReducedMotion, type HTMLMotionProps } from 'framer-motion';
import { cn } from '@/lib/utils';
import { PRESETS } from '@/lib/motion';

/**
 * A motion.div wrapper that adds a subtle press/tap scale effect.
 * Wrap around any tappable card, row, or button surface.
 * Automatically disables scale when user prefers reduced motion.
 */
export function Pressable({ children, className, ...props }: HTMLMotionProps<'div'>) {
  const prefersReduced = useReducedMotion();

  return (
    <motion.div
      whileTap={prefersReduced ? undefined : PRESETS.PRESS.whileTap}
      transition={PRESETS.PRESS.transition}
      className={cn('will-change-transform', className)}
      {...props}
    >
      {children}
    </motion.div>
  );
}
