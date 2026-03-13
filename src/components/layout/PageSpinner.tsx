import { motion } from 'framer-motion';
import bursLogo from '@/assets/burs-monogram.png';

interface PageSpinnerProps {
  className?: string;
}

export function PageSpinner({ className }: PageSpinnerProps) {
  return (
    <div className={className ?? "flex items-center justify-center min-h-[60vh]"}>
      <motion.img
        src={bursLogo}
        alt="BURS"
        className="w-16 h-16 object-contain"
        animate={{ opacity: [0.4, 1, 0.4] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  );
}
