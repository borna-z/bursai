import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Heart, Search } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { EASE_CURVE, STAGGER_DELAY } from '@/lib/motion';
import { hapticLight } from '@/lib/haptics';

const CARDS = [
  {
    path: '/ai/mood-outfit',
    icon: Heart,
    titleKey: 'discover.mood_title',
    subtitleKey: 'discover.mood_sub',
    accentClass: 'text-pink-400',
    glowColor: 'hsl(330 60% 50% / 0.08)',
  },
  {
    path: '/ai/visual-search',
    icon: Search,
    titleKey: 'discover.visual_title',
    subtitleKey: 'discover.visual_sub',
    accentClass: 'text-blue-400',
    glowColor: 'hsl(210 60% 50% / 0.08)',
  },
];

export function DiscoverSecondaryRow() {
  const { t } = useLanguage();
  const navigate = useNavigate();

  return (
    <div className="grid grid-cols-2 gap-3">
      {CARDS.map((card, i) => (
        <motion.button
          key={card.path}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 + i * STAGGER_DELAY, duration: 0.4, ease: EASE_CURVE }}
          whileTap={{ scale: 0.97 }}
          onClick={() => { hapticLight(); navigate(card.path); }}
          className="relative overflow-hidden rounded-2xl border border-border/20 p-4 text-left"
          style={{ background: `linear-gradient(160deg, ${card.glowColor}, hsl(var(--card)))` }}
        >
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center mb-3 bg-foreground/[0.04] ${card.accentClass}`}>
            <card.icon className="w-4 h-4" />
          </div>
          <h3 className="text-[13px] font-medium text-foreground leading-tight">
            {t(card.titleKey)}
          </h3>
          <p className="text-[11px] text-muted-foreground/70 mt-1 leading-snug">
            {t(card.subtitleKey)}
          </p>
        </motion.button>
      ))}
    </div>
  );
}
