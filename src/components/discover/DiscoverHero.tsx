import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { EASE_CURVE } from '@/lib/motion';
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
  const ref = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });

  // Parallax: glow drifts up slower than scroll, content shifts subtly
  const glowY = useTransform(scrollYProgress, [0, 1], [30, -30]);
  const contentY = useTransform(scrollYProgress, [0, 1], [8, -8]);
  const glowScale = useTransform(scrollYProgress, [0, 0.5, 1], [0.9, 1.1, 0.95]);

  const title = challengeTitle || t('discover.hero_title');
  const description = challengeDescription || t('discover.hero_description');

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.6, ease: EASE_CURVE }}
      whileTap={{ scale: 0.985 }}
      className="relative overflow-hidden rounded-[1.25rem] border border-accent/10"
      style={{
        background: 'linear-gradient(165deg, hsl(var(--accent) / 0.08) 0%, hsl(var(--card)) 50%, hsl(var(--background)) 100%)',
      }}
    >
      {/* Parallax accent glow */}
      <motion.div
        className="absolute -top-20 -right-20 w-56 h-56 rounded-full opacity-20 blur-3xl pointer-events-none"
        style={{
          background: 'hsl(var(--accent) / 0.35)',
          y: glowY,
          scale: glowScale,
        }}
      />

      {/* Secondary warm glow – parallax offset */}
      <motion.div
        className="absolute -bottom-16 -left-16 w-40 h-40 rounded-full opacity-10 blur-3xl pointer-events-none"
        style={{
          background: 'hsl(var(--accent) / 0.25)',
          y: useTransform(scrollYProgress, [0, 1], [-20, 20]),
        }}
      />

      <motion.div className="relative p-6 space-y-4" style={{ y: contentY }}>
        {/* Eyebrow */}
        <motion.span
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.15, ease: EASE_CURVE }}
          className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-accent"
        >
          <Sparkles className="w-3 h-3" />
          {t('discover.featured')}
        </motion.span>

        {/* Title */}
        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.22, ease: EASE_CURVE }}
          className="font-['Playfair_Display'] italic text-[1.3rem] text-foreground leading-tight"
        >
          {title}
        </motion.h2>

        {/* Description */}
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3, ease: EASE_CURVE }}
          className="text-[13px] text-muted-foreground/80 leading-relaxed max-w-[280px]"
        >
          {description}
        </motion.p>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.38, ease: EASE_CURVE }}
        >
          <Button
            size="sm"
            className="rounded-full h-9 px-5 text-xs font-medium mt-1"
            onClick={() => {
              hapticLight();
              if (challengeId && onJoin) onJoin(challengeId);
              else navigate('/discover');
            }}
          >
            {t('discover.try_challenge')}
          </Button>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
