import { motion, type HTMLMotionProps } from 'framer-motion';
import { cn } from '@/lib/utils';

/**
 * A motion.div wrapper that adds a subtle press/tap scale effect.
 * Wrap around any tappable card, row, or button surface.
 */
export function Pressable({ children, className, ...props }: HTMLMotionProps<'div'>) {
  return (
    <motion.div
      whileTap={{ scale: 0.975 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30, mass: 0.5 }}
      className={cn('will-change-transform', className)}
      {...props}
    >
      {children}
    </motion.div>
  );
}
