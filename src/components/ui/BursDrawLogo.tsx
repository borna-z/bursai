import { motion } from 'framer-motion';

interface BursDrawLogoProps {
  onComplete?: () => void;
}

/**
 * Animated SVG logo that draws itself on screen.
 * Stylised "B" hanger monogram + "BURS" wordmark.
 */
export function BursDrawLogo({ onComplete }: BursDrawLogoProps) {
  // Hanger-B monogram path (simplified elegant shape)
  const monogramPath =
    // Top hook curve
    'M 40 8 C 40 3, 45 0, 50 0 C 55 0, 60 3, 60 8 L 60 14 ' +
    // Right shoulder
    'L 80 30 ' +
    // B outer right curve top
    'C 88 34, 88 46, 80 50 ' +
    // B outer right curve bottom (wider)
    'C 90 54, 90 68, 80 72 ' +
    // Bottom bar
    'L 30 72 ' +
    // Left edge
    'L 30 30 ' +
    // Left shoulder back to hook
    'L 40 22 Z';

  // Inner B cutouts
  const bCutoutTop = 'M 45 34 L 70 34 C 76 36, 76 44, 70 46 L 45 46 Z';
  const bCutoutBottom = 'M 45 50 L 72 50 C 80 53, 80 65, 72 68 L 45 68 Z';

  const pathLength = 500; // approximate

  return (
    <div className="flex flex-col items-center gap-5">
      {/* Monogram */}
      <motion.svg
        viewBox="0 0 100 80"
        width={72}
        height={58}
        fill="none"
        className="text-foreground"
        aria-hidden
      >
        {/* Main shape stroke draw */}
        <motion.path
          d={monogramPath}
          stroke="currentColor"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          fill="none"
          initial={{ strokeDasharray: pathLength, strokeDashoffset: pathLength }}
          animate={{ strokeDashoffset: 0 }}
          transition={{ duration: 1.2, ease: [0.25, 0.1, 0.25, 1] }}
        />

        {/* Fill fades in after stroke */}
        <motion.path
          d={monogramPath}
          fill="currentColor"
          stroke="none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9, duration: 0.5, ease: 'easeOut' }}
        />

        {/* Cutouts (subtract with background color) */}
        <motion.path
          d={bCutoutTop}
          className="fill-background"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.1, duration: 0.3 }}
        />
        <motion.path
          d={bCutoutBottom}
          className="fill-background"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.15, duration: 0.3 }}
        />
      </motion.svg>

      {/* Wordmark */}
      <div className="flex gap-[0.18em]" style={{ fontFamily: "'Sora', sans-serif" }}>
        {'BURS'.split('').map((letter, i) => (
          <motion.span
            key={i}
            className="text-lg font-semibold tracking-[0.14em] text-foreground"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              delay: 1.2 + i * 0.08,
              duration: 0.35,
              ease: [0.25, 0.1, 0.25, 1],
            }}
            onAnimationComplete={i === 3 ? onComplete : undefined}
          >
            {letter}
          </motion.span>
        ))}
      </div>
    </div>
  );
}
