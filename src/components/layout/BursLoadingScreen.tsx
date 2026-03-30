import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BursMonogram } from '@/components/ui/BursMonogram';

const MESSAGES = [
  'Reading your wardrobe',
  'Matching your style',
  'Checking the forecast',
  'Assembling your look',
] as const;

function BackgroundLines() {
  return (
    <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
      {[20, 50, 80].map((pct) => (
        <div key={pct} className="absolute top-0 bottom-0 w-px"
          style={{ left: `${pct}%`, background: 'linear-gradient(to bottom, transparent 10%, hsl(var(--border)/0.14) 30%, hsl(var(--border)/0.14) 70%, transparent 90%)' }} />
      ))}
    </div>
  );
}

export function BursLoadingScreen() {
  const [msgIndex, setMsgIndex] = useState(0);
  const [dotCount, setDotCount] = useState(1);

  useEffect(() => {
    const t = setInterval(() => setMsgIndex((i) => (i + 1) % MESSAGES.length), 2200);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setDotCount((d) => (d % 3) + 1), 480);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background overflow-hidden">
      <BackgroundLines />
      <motion.p className="absolute top-[max(env(safe-area-inset-top,0px),28px)] left-0 right-0 text-center text-[9px] uppercase tracking-[0.28em] text-muted-foreground/30"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1.2, delay: 0.4 }}>
        Personal Style Intelligence
      </motion.p>
      <div className="relative flex flex-col items-center gap-6">
        <motion.div initial={{ opacity: 0, scale: 0.88 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}>
          <motion.div animate={{ opacity: [1, 0.5, 1] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}>
            <BursMonogram size={52} />
          </motion.div>
        </motion.div>
        <motion.h1 className="font-display italic text-[2.2rem] tracking-[-0.01em] text-foreground leading-none"
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}>
          BURS
        </motion.h1>
        <motion.div className="w-[140px] h-px bg-foreground/10" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.8, delay: 0.6, ease: [0.22, 1, 0.36, 1] }} />
        <motion.div className="w-[140px] h-px bg-foreground/8 overflow-hidden relative" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4, delay: 0.9 }}>
          <motion.div className="absolute top-0 left-0 h-full w-1/2 bg-foreground/40" animate={{ x: ['-100%', '200%'] }} transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }} />
        </motion.div>
        <motion.div className="h-5 overflow-hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4, delay: 1.1 }}>
          <AnimatePresence mode="wait">
            <motion.p key={msgIndex} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.28 }}
              className="text-[11px] font-body tracking-[0.12em] text-muted-foreground/45 text-center">
              {MESSAGES[msgIndex]}<span className="inline-block w-5 text-left">{'.'.repeat(dotCount)}</span>
            </motion.p>
          </AnimatePresence>
        </motion.div>
      </div>
      <motion.p className="absolute bottom-[max(env(safe-area-inset-bottom,0px),28px)] left-0 right-0 text-center text-[9px] uppercase tracking-[0.22em] text-muted-foreground/20"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1.2, delay: 0.8 }}>
        © BURS
      </motion.p>
    </div>
  );
}
