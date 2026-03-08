import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useSeed } from '@/contexts/SeedContext';
import { motion, AnimatePresence } from 'framer-motion';

export function SeedProgressPill() {
  const { isRunning, completed, failed, totalToProcess, step } = useSeed();
  const navigate = useNavigate();

  if (!isRunning) return null;

  const done = completed + failed;
  const pct = totalToProcess > 0 ? Math.round((done / totalToProcess) * 100) : 0;

  return (
    <AnimatePresence>
      <motion.button
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        onClick={() => navigate('/settings/seed-wardrobe')}
        className="fixed bottom-24 right-4 z-50 flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-primary-foreground shadow-lg text-sm font-medium"
      >
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        {step === 'deleting' ? 'Deleting...' : `Seeding ${done}/${totalToProcess}`}
        <span className="text-xs opacity-70">{pct}%</span>
      </motion.button>
    </AnimatePresence>
  );
}
