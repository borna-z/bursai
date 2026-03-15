import { Lightbulb } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { useInsights } from '@/hooks/useInsights';
import { hapticLight } from '@/lib/haptics';
import { TAP_TRANSITION } from '@/lib/motion';

export function SmartInsightCard() {
  const { t } = useLanguage();
  const { data: insights } = useInsights();
  const navigate = useNavigate();

  const unusedCount = insights?.unusedGarments?.length || 0;

  if (unusedCount === 0) return null;

  const hint = t('home.unused_hint').replace('{count}', String(unusedCount));

  return (
    <motion.div
      whileTap={{ scale: 0.98 }}
      transition={TAP_TRANSITION}
      className="rounded-xl bg-foreground/[0.02] border border-border/30 p-4 flex items-center gap-3 will-change-transform"
    >
      <div className="w-9 h-9 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
        <Lightbulb className="w-4 h-4 text-accent" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[0.75rem] text-muted-foreground/80 leading-relaxed">{hint}</p>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => { hapticLight(); navigate('/outfits/unused'); }}
        className="text-[0.75rem] text-accent font-semibold flex-shrink-0 h-8 px-3 tracking-[-0.01em]"
      >
        {t('home.use_them')}
      </Button>
    </motion.div>
  );
}
