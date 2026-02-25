import { motion } from 'framer-motion';
import bursLogo from '@/assets/burs-hanger-logo.png';

interface BursDrawLogoProps {
  onComplete?: () => void;
}

export function BursDrawLogo({ onComplete }: BursDrawLogoProps) {
  return (
    <div className="flex flex-col items-center gap-6">
      {/* Logo image scales + fades in */}
      <motion.img
        src={bursLogo}
        alt="BURS"
        className="h-20 w-20 object-contain"
        initial={{ opacity: 0, scale: 0.7 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.7, ease: [0.25, 0.1, 0.25, 1] }}
      />

      {/* Handwriting stroke-draw text */}
      <motion.svg
        viewBox="0 0 220 44"
        width={176}
        height={35}
        className="text-foreground overflow-visible"
        aria-label="BURS"
      >
        {/* Stroke draws in like a pen */}
        <motion.text
          x="110"
          y="33"
          textAnchor="middle"
          fontSize="34"
          fontFamily="'Sora', 'Inter', sans-serif"
          fontWeight="600"
          letterSpacing="0.22em"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          initial={{ strokeDasharray: 500, strokeDashoffset: 500 }}
          animate={{ strokeDashoffset: 0 }}
          transition={{ duration: 1.6, ease: [0.4, 0, 0.2, 1], delay: 0.5 }}
        >
          BURS
        </motion.text>

        {/* Fill fades in after stroke */}
        <motion.text
          x="110"
          y="33"
          textAnchor="middle"
          fontSize="34"
          fontFamily="'Sora', 'Inter', sans-serif"
          fontWeight="600"
          letterSpacing="0.22em"
          fill="currentColor"
          stroke="none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.8, duration: 0.5, ease: 'easeOut' }}
          onAnimationComplete={() => onComplete?.()}
        >
          BURS
        </motion.text>
      </motion.svg>
    </div>
  );
}
