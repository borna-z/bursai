import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { EASE_CURVE, STAGGER_DELAY } from '@/lib/motion';
import { hapticLight } from '@/lib/haptics';

interface Props {
  challengeTitle?: string;
  challengeDescription?: string;
  challengeId?: string;
  onJoin?: (id: string) => void;
}

export function DiscoverHero({ challengeTitle, challengeDescription, challengeId, onJoin }: Props) {
  const { t } = useLanguage();
  const navigate = useNavigate();

  const title = challengeTitle || t('discover.hero_title');
  const description = challengeDescription || t('discover.hero_description');

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE_CURVE }}
      whileTap={{ scale: 0.985 }}
      className="relative overflow-hidden rounded-2xl border border-accent/10"
      style={{
        background: 'linear-gradient(165deg, hsl(var(--accent) / 0.08) 0%, hsl(var(--card)) 50%, hsl(var(--background)) 100%)',
      }}
    >
      {/* Subtle accent glow */}
      <div
        className="absolute -top-20 -right-20 w-56 h-56 rounded-full opacity-20 blur-3xl pointer-events-none"
        style={{ background: 'hsl(var(--accent) / 0.35)' }}
      />

      <div className="relative p-6 space-y-4">
        {/* Eyebrow */}
        <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-accent">
          <Sparkles className="w-3 h-3" />
          {t('discover.featured')}
        </span>

        {/* Title */}
        <h2 className="text-xl font-semibold tracking-tight text-foreground leading-tight">
          {title}
        </h2>

        {/* Description */}
        <p className="text-[13px] text-muted-foreground/80 leading-relaxed max-w-[280px]">
          {description}
        </p>

        {/* CTA */}
        <Button
          size="sm"
          className="rounded-xl h-9 px-5 text-xs font-medium mt-1"
          onClick={() => {
            hapticLight();
            if (challengeId && onJoin) onJoin(challengeId);
            else navigate('/challenges');
          }}
        >
          {t('discover.try_challenge')}
        </Button>
      </div>
    </motion.div>
  );
}
