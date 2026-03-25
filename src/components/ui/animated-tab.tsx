import { AnimatePresence, motion } from 'framer-motion';
import { useMotionPreset } from '@/lib/motion';
import { ReactNode } from 'react';

interface AnimatedTabProps {
  /** Unique key for the active tab */
  tabKey: string;
  children: ReactNode;
  className?: string;
}

export function AnimatedTab({ tabKey, children, className }: AnimatedTabProps) {
  const { variants, transition } = useMotionPreset('TAB');

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={tabKey}
        variants={variants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={transition}
        className={className}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
