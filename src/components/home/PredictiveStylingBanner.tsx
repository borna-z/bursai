import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Clock } from 'lucide-react';
import { usePlannedOutfits } from '@/hooks/usePlannedOutfits';
import { useLanguage } from '@/contexts/LanguageContext';
import { motion } from 'framer-motion';

/**
 * Step 25: Predictive Styling
 * Shows a predictive insight banner on the home page based on
 * tomorrow's calendar + weather + wear history patterns.
 * Lightweight client-side implementation that encourages users to
 * generate tomorrow's outfit.
 */
export function PredictiveStylingBanner() {
  const { t } = useLanguage();
  const navigate = useNavigate();

  // Check if tomorrow already has a planned outfit
  const tomorrow = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  }, []);

  const { data: plannedOutfits } = usePlannedOutfits();
  const hasTomorrowPlan = plannedOutfits?.some(p => p.date === tomorrow);

  // Don't show if tomorrow is already planned
  if (hasTomorrowPlan) return null;

  return (
    <motion.button
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.8 }}
      onClick={() => navigate('/plan', { state: { focusDate: tomorrow } })}
      className="w-full rounded-[1.25rem] surface-interactive p-4 flex items-center gap-3 text-left active:scale-[0.98] transition-transform"
    >
      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
        <Sparkles className="w-5 h-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[0.8125rem] font-bold tracking-[-0.01em]">{t('home.predictive_title')}</p>
        <p className="text-[0.75rem] text-muted-foreground/70 mt-0.5 leading-relaxed">{t('home.predictive_desc')}</p>
      </div>
      <Clock className="w-4 h-4 text-muted-foreground/50 flex-shrink-0" />
    </motion.button>
  );
}
