import { motion, useReducedMotion } from 'framer-motion';
import { EASE_CURVE } from '@/lib/motion';
import { ReactNode } from 'react';

interface AnimatedPageProps {
  children: ReactNode;
  className?: string;
}

const pageVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

const reducedVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

const pageTransition = {
  type: 'tween' as const,
  ease: EASE_CURVE,
  duration: 0.4,
};

const reducedTransition = {
  type: 'tween' as const,
  duration: 0.15,
};

export function AnimatedPage({ children, className }: AnimatedPageProps) {
  const prefersReduced = useReducedMotion();

  return (
    <motion.div
      variants={prefersReduced ? reducedVariants : pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={prefersReduced ? reducedTransition : pageTransition}
      className={className}
    >
      {children}
    </motion.div>
  );
}
