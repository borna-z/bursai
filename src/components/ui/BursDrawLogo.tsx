import { motion } from 'framer-motion';
import bursLogo from '@/assets/burs-logo-white.png';

interface BursDrawLogoProps {
  onComplete?: () => void;
}

/**
 * Splash logo: actual BURS icon image + handwritten-style BURS text reveal.
 */
export function BursDrawLogo({ onComplete }: BursDrawLogoProps) {
  // SVG text path for "BURS" with a handwriting stroke-draw effect
  return (
    <div className="flex flex-col items-center gap-5">
      {/* Logo image fades/scales in */}
      <motion.img
        src={bursLogo}
        alt="BURS"
        className="h-14 w-auto object-contain"
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
      />

      {/* Handwriting-style text reveal */}
      <motion.svg
        viewBox="0 0 200 40"
        width={160}
        height={32}
        className="text-foreground overflow-visible"
        aria-label="BURS"
      >
        {/* The text rendered as a stroked path that draws itself */}
        <motion.text
          x="100"
          y="30"
          textAnchor="middle"
          fontSize="32"
          fontFamily="'Sora', 'Inter', sans-serif"
          fontWeight="600"
          letterSpacing="0.18em"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
          initial={{ strokeDasharray: 400, strokeDashoffset: 400 }}
          animate={{ strokeDashoffset: 0 }}
          transition={{ duration: 1.4, ease: [0.25, 0.1, 0.25, 1], delay: 0.3 }}
        >
          BURS
        </motion.text>

        {/* Fill fades in after stroke finishes */}
        <motion.text
          x="100"
          y="30"
          textAnchor="middle"
          fontSize="32"
          fontFamily="'Sora', 'Inter', sans-serif"
          fontWeight="600"
          letterSpacing="0.18em"
          fill="currentColor"
          stroke="none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.4, duration: 0.45, ease: 'easeOut' }}
          onAnimationComplete={() => onComplete?.()}
        >
          BURS
        </motion.text>
      </motion.svg>
    </div>
  );
}
