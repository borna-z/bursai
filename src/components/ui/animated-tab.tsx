import { AnimatePresence, motion } from 'framer-motion';
import { EASE_CURVE } from '@/lib/motion';
import { ReactNode } from 'react';

interface AnimatedTabProps {
  /** Unique key for the active tab */
  tabKey: string;
  children: ReactNode;
  className?: string;
}

const tabVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
};

const tabTransition = {
  type: 'tween' as const,
  ease: EASE_CURVE,
  duration: 0.25,
};

export function AnimatedTab({ tabKey, children, className }: AnimatedTabProps) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={tabKey}
        variants={tabVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={tabTransition}
        className={className}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
