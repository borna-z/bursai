import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ReactNode } from 'react';
import { PRESETS } from '@/lib/motion';

interface FadeReplaceProps {
  /** When true, children are rendered; when false, nothing shows (or fallback). */
  show: boolean;
  /** Unique key to trigger re-animation when content identity changes. */
  contentKey?: string;
  children: ReactNode;
  /** Optional fallback while show is false (e.g. skeleton). */
  fallback?: ReactNode;
  className?: string;
}

/**
 * Crossfade wrapper for loading→content transitions.
 * Dissolves old content out and new content in via AnimatePresence.
 * Use selectively at major continuity moments (hero, day content swap).
 */
export function FadeReplace({ show, contentKey, children, fallback, className }: FadeReplaceProps) {
  const prefersReduced = useReducedMotion();
  const duration = prefersReduced ? 0.05 : PRESETS.REPLACE.transition.duration;

  return (
    <AnimatePresence mode="wait">
      {show ? (
        <motion.div
          key={contentKey ?? 'content'}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration }}
          className={className}
        >
          {children}
        </motion.div>
      ) : fallback ? (
        <motion.div
          key="fallback"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration }}
          className={className}
        >
          {fallback}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
