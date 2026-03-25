import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BursMonogram } from '@/components/ui/BursMonogram';

const MESSAGES = [
  'READING YOUR WARDROBE',
  'MATCHING YOUR STYLE',
  'CHECKING THE FORECAST',
  'ASSEMBLING YOUR LOOK',
] as const;

export function BursLoadingScreen() {
  const [msgIndex, setMsgIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setMsgIndex((i) => (i + 1) % MESSAGES.length);
    }, 2400);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#F5F0E8]">
      {/* Monogram with slow pulse */}
      <motion.div
        animate={{ opacity: [1, 0.4, 1] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      >
        <BursMonogram size={48} />
      </motion.div>

      {/* Progress line */}
      <div className="mt-6 w-[180px] h-px bg-[#1C1917]/10 overflow-hidden">
        <motion.div
          className="h-full bg-[#1C1917]"
          animate={{ width: ['0%', '100%'] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'linear' }}
        />
      </div>

      {/* Rotating message */}
      <div className="mt-4 h-4 relative overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.p
            key={msgIndex}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            className="text-[11px] font-['DM_Sans'] tracking-[0.15em] text-[#1C1917]/40"
          >
            {MESSAGES[msgIndex]}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
}
