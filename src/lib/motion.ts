/** App-wide cubic-bezier easing curve (equivalent to CSS ease) */
export const EASE_CURVE: [number, number, number, number] = [0.25, 0.1, 0.25, 1];

/** Shared duration constants */
export const DURATION_FAST = 0.15;
export const DURATION_DEFAULT = 0.25;
export const DURATION_SLOW = 0.35;

/** Stagger delay between children */
export const STAGGER_DELAY = 0.04;

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

/** Bouncy spring for interactive emphasis (nav, cards) */
export const SPRING_BOUNCE = {
  type: 'spring' as const,
  stiffness: 400,
  damping: 25,
  mass: 0.8,
};
