import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Check, Lock, ChevronRight, Trophy } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { EASE_CURVE, STAGGER_DELAY } from '@/lib/motion';
import { hapticLight, hapticSuccess } from '@/lib/haptics';
import { cn } from '@/lib/utils';

interface Challenge {
  id: string;
  title: string;
  description: string | null;
}

interface Participation {
  challenge_id: string;
  completed: boolean;
}

interface Props {
  challenges: Challenge[];
  participations: Record<string, Participation>;
  garmentCount: number;
  thresholds: number[];
  loading: boolean;
  onJoin: (id: string) => void;
}

export function DiscoverChallenges({ challenges, participations, garmentCount, thresholds, loading, onJoin }: Props) {
  const { t } = useLanguage();
  const navigate = useNavigate();

  if (loading) {
    return (
      <section className="space-y-3">
        <div className="h-4 w-28 rounded bg-muted/30 animate-pulse" />
        <div className="flex gap-3 overflow-hidden">
          {[0, 1, 2].map(i => (
            <div key={i} className="w-36 h-28 rounded-xl bg-muted/20 animate-pulse shrink-0" />
          ))}
        </div>
      </section>
    );
  }

  if (challenges.length === 0) return null;

  return (
    <section className="space-y-3">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-medium text-muted-foreground/70 tracking-wide uppercase">
          {t('discover.challenges_heading')}
        </h3>
        <button
          onClick={() => navigate('/discover')}
          className="text-[11px] font-medium text-accent flex items-center gap-0.5"
        >
          {t('discover.see_all')}
          <ChevronRight className="w-3 h-3" />
        </button>
      </div>

      {/* Horizontal scroll */}
      <div className="flex gap-3 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-none">
        {challenges.slice(0, 8).map((ch, i) => {
          const part = participations[ch.id];
          const threshold = thresholds[i] || 1;
          const isLocked = garmentCount < threshold;
          const isCompleted = part?.completed;
          const isJoined = !!part && !isCompleted;

          return (
            <motion.button
              key={ch.id}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * STAGGER_DELAY, duration: 0.35, ease: EASE_CURVE }}
              whileTap={{ scale: 0.96 }}
              onClick={() => {
                if (isLocked) return;
                if (!part) { hapticSuccess(); onJoin(ch.id); }
                else { hapticLight(); }
              }}
              className={cn(
                'relative w-40 shrink-0 rounded-xl border p-3.5 text-left space-y-2.5 transition-colors',
                isCompleted && 'border-accent/15 bg-accent/[0.04]',
                isLocked && 'border-border/10 bg-muted/[0.03] opacity-40',
                !isCompleted && !isLocked && 'border-border/15 bg-card/60',
              )}
            >
              {/* Icon + status */}
              <div className="flex items-center justify-between">
                <div className={cn(
                  'w-7 h-7 rounded-lg flex items-center justify-center',
                  isCompleted ? 'bg-accent/15' : 'bg-foreground/[0.04]'
                )}>
                  {isLocked ? (
                    <Lock className="w-3.5 h-3.5 text-muted-foreground/40" />
                  ) : isCompleted ? (
                    <Check className="w-3.5 h-3.5 text-accent" />
                  ) : (
                    <Trophy className="w-3.5 h-3.5 text-muted-foreground/60" />
                  )}
                </div>
                {isJoined && (
                  <div className="h-1.5 w-8 rounded-full bg-muted/30 overflow-hidden">
                    <div className="h-full w-1/2 rounded-full bg-accent/60" />
                  </div>
                )}
              </div>

              {/* Title */}
              <h4 className="text-[12px] font-medium text-foreground leading-tight line-clamp-2">
                {ch.title}
              </h4>

              {/* Status text */}
              <span className="text-[10px] text-muted-foreground/50 block">
                {isLocked
                  ? `${garmentCount}/${threshold}`
                  : isCompleted
                    ? t('challenges.joined_label')
                    : isJoined
                      ? t('discover.in_progress')
                      : t('discover.start')}
              </span>
            </motion.button>
          );
        })}
      </div>
    </section>
  );
}
