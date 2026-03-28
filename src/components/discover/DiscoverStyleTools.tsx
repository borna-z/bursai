import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Heart } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { EASE_CURVE, STAGGER_DELAY } from '@/lib/motion';
import { hapticLight } from '@/lib/haptics';

const TOOLS = [
  {
    path: '/ai/mood-outfit',
    icon: Heart,
    titleKey: 'discover.tool_mood',
    subtitleKey: 'discover.tool_mood_desc',
  },
];

export function DiscoverStyleTools() {
  const { t } = useLanguage();
  const navigate = useNavigate();

  return (
    <section className="space-y-3">
      <h3 className="text-[11px] font-medium text-muted-foreground/70 tracking-wide uppercase">
        {t('discover.style_tools_heading')}
      </h3>

      <div className="grid grid-cols-2 gap-3">
        {TOOLS.map((tool, i) => (
          <motion.button
            key={tool.titleKey}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 + i * STAGGER_DELAY, duration: 0.4, ease: EASE_CURVE }}
            whileTap={{ scale: 0.97 }}
            onClick={() => { hapticLight(); navigate(tool.path); }}
            className="relative overflow-hidden rounded-xl border border-border/10 bg-card/60 p-4 text-left space-y-2.5 transition-colors"
          >
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-foreground/[0.04]">
              <tool.icon className="w-4 h-4 text-muted-foreground/60" />
            </div>
            <div>
              <h4 className="text-[13px] font-medium text-foreground leading-tight">
                {t(tool.titleKey)}
              </h4>
              <p className="text-[11px] text-muted-foreground/60 leading-snug mt-0.5">
                {t(tool.subtitleKey)}
              </p>
            </div>
          </motion.button>
        ))}
      </div>
    </section>
  );
}
