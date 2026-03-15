import { useReducedMotion } from 'framer-motion';
import { useMemo } from 'react';

// ─── Foundation tokens ───

/** App-wide cubic-bezier easing curve (equivalent to CSS ease) */
export const EASE_CURVE: [number, number, number, number] = [0.25, 0.1, 0.25, 1];

/** Snappier ease-out for exits and quick reveals */
export const EASE_OUT: [number, number, number, number] = [0.0, 0.0, 0.2, 1];

/** Shared duration constants */
export const DURATION_FAST = 0.12;
export const DURATION_DEFAULT = 0.2;
export const DURATION_MEDIUM = 0.3;
export const DURATION_SLOW = 0.35;

/** Stagger delay between children */
export const STAGGER_DELAY = 0.04;

/** Y-distance tokens by purpose */
export const DISTANCE = {
  /** Tab switch, lightweight swap */
  sm: 4,
  /** Standard content reveal */
  md: 8,
  /** Hero or page-level shift */
  lg: 12,
} as const;

// ─── Reusable transitions ───

/** Shared tween transition using EASE_CURVE */
export const EASE_TWEEN = {
  type: 'tween' as const,
  ease: EASE_CURVE,
  duration: DURATION_DEFAULT,
};

/** Tap transition for interactive elements */
export const TAP_TRANSITION = {
  type: 'tween' as const,
  ease: EASE_CURVE,
  duration: DURATION_FAST,
};

/** Subtle spring for interactive emphasis (nav, cards) */
export const SPRING_SUBTLE = {
  type: 'spring' as const,
  stiffness: 400,
  damping: 30,
  mass: 0.8,
};

/** Legacy alias */
export const SPRING_BOUNCE = SPRING_SUBTLE;

// ─── Purpose-based presets ───
// Each preset defines variants + transition for a specific motion layer.
// Consumers: use `useMotionPreset('PAGE')` or reference directly.

export const PRESETS = {
  /** Route-level wrapper (AnimatedRoutes). Fastest, shallowest. */
  ROUTE: {
    variants: {
      initial: { opacity: 0, y: 6 },
      animate: { opacity: 1, y: 0 },
      exit: { opacity: 0, y: -4 },
    },
    transition: { type: 'tween' as const, ease: EASE_CURVE, duration: DURATION_DEFAULT },
  },

  /** Full page content (AnimatedPage wrapper). Slightly deeper than route. */
  PAGE: {
    variants: {
      initial: { opacity: 0, y: DISTANCE.lg },
      animate: { opacity: 1, y: 0 },
      exit: { opacity: 0, y: -DISTANCE.md },
    },
    transition: { type: 'tween' as const, ease: EASE_CURVE, duration: DURATION_MEDIUM },
  },

  /** Tab switch within a page. Light and fast — no depth exaggeration. */
  TAB: {
    variants: {
      initial: { opacity: 0, y: DISTANCE.sm },
      animate: { opacity: 1, y: 0 },
      exit: { opacity: 0, y: -DISTANCE.sm },
    },
    transition: { type: 'tween' as const, ease: EASE_CURVE, duration: 0.18 },
  },

  /** Sheet/overlay — opacity only, no vertical movement. */
  SHEET: {
    variants: {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
    },
    transition: { type: 'tween' as const, ease: EASE_CURVE, duration: DURATION_DEFAULT },
  },

  /** Standard content section reveal. Most common preset. */
  REVEAL: {
    variants: {
      initial: { opacity: 0, y: DISTANCE.md },
      animate: { opacity: 1, y: 0 },
    },
    transition: { type: 'tween' as const, ease: EASE_CURVE, duration: DURATION_MEDIUM },
  },

  /** Hero module — slightly slower, slightly deeper for editorial weight. */
  HERO: {
    variants: {
      initial: { opacity: 0, y: 10 },
      animate: { opacity: 1, y: 0 },
    },
    transition: { type: 'tween' as const, ease: EASE_CURVE, duration: DURATION_SLOW },
  },

  /** Interactive press feedback. */
  PRESS: {
    whileTap: { scale: 0.975 },
    transition: { type: 'tween' as const, ease: EASE_CURVE, duration: DURATION_FAST },
  },

  /** State replacement crossfade (loading→content, swap→updated). */
  REPLACE: {
    variants: {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
    },
    transition: { type: 'tween' as const, ease: EASE_CURVE, duration: 0.15 },
  },

  /** Success confirmation pulse. */
  SUCCESS: {
    animate: { scale: [1, 1.04, 1] },
    transition: { type: 'spring' as const, stiffness: 300, damping: 20 },
  },

  /** Card reveal in lists/grids — no scale, opacity + y only. */
  CARD: {
    variants: {
      hidden: { opacity: 0, y: DISTANCE.md },
      visible: { opacity: 1, y: 0 },
    },
    transition: { type: 'tween' as const, ease: EASE_CURVE, duration: DURATION_MEDIUM },
  },

  /** Chat message appearance — quick, minimal. */
  MESSAGE: {
    variants: {
      initial: { opacity: 0, y: 6 },
      animate: { opacity: 1, y: 0 },
    },
    transition: { type: 'tween' as const, ease: EASE_OUT, duration: DURATION_DEFAULT },
  },
} as const;

// ─── Reduced-motion overrides ───

const REDUCED_VARIANTS = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

const REDUCED_TRANSITION = {
  type: 'tween' as const,
  duration: 0.1,
};

// ─── Hook: useMotionPreset ───

type PresetKey = keyof typeof PRESETS;

/**
 * Returns motion props for a named preset, automatically
 * falling back to reduced-motion safe values.
 */
export function useMotionPreset(key: PresetKey) {
  const prefersReduced = useReducedMotion();

  return useMemo(() => {
    const preset = PRESETS[key];

    if (prefersReduced) {
      return {
        variants: REDUCED_VARIANTS,
        transition: REDUCED_TRANSITION,
        whileTap: undefined,
      };
    }

    return {
      variants: 'variants' in preset ? preset.variants : undefined,
      transition: preset.transition,
      whileTap: 'whileTap' in preset ? preset.whileTap : undefined,
    };
  }, [key, prefersReduced]);
}

/**
 * Returns true if user prefers reduced motion.
 * Thin wrapper so consumers don't need to import framer-motion directly.
 */
export function usePrefersReduced(): boolean {
  return !!useReducedMotion();
}
