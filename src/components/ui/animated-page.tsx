import { motion } from 'framer-motion';
import { useMotionPreset } from '@/lib/motion';
import { ReactNode } from 'react';

interface AnimatedPageProps {
  children: ReactNode;
  className?: string;
}

export function AnimatedPage({ children, className }: AnimatedPageProps) {
  const { variants, transition } = useMotionPreset('PAGE');

  return (
    <motion.div
      variants={variants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={transition}
      className={className}
    >
      {children}
    </motion.div>
  );
}
