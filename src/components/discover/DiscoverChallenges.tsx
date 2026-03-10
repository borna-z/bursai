import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Check, Lock, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
        <div className="h-20 rounded-2xl bg-muted/20 animate-pulse" />
        <div className="h-14 rounded-xl bg-muted/10 animate-pulse" />
      </section>
    );
  }

  if (challenges.length === 0) return null;

  // Split: first = featured, rest = compact
  const featured = challenges[0];
  const compact = challenges.slice(1, 4);

  const featuredPart = participations[featured.id];
  const featuredThreshold = thresholds[0] || 1;
  const featuredLocked = garmentCount < featuredThreshold;

  return (
    <section className="space-y-4">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-medium text-muted-foreground/70 tracking-wide uppercase">
          {t('discover.challenges_heading')}
        </h3>
        <button
          onClick={() => navigate('/challenges')}
          className="text-[11px] font-medium text-accent flex items-center gap-0.5"
        >
          {t('discover.see_all')}
          <ChevronRight className="w-3 h-3" />
        </button>
      </div>

      {/* Featured challenge card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: EASE_CURVE }}
        whileTap={{ scale: 0.985 }}
        className={cn(
          'rounded-2xl border p-4 space-y-2',
          featuredPart?.completed
            ? 'border-accent/15 bg-accent/[0.04]'
            : featuredLocked
              ? 'border-border/10 bg-muted/[0.03] opacity-50'
              : 'border-border/15 bg-card'
        )}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-1.5">
              {featuredLocked && <Lock className="w-3 h-3 text-muted-foreground/40 shrink-0" />}
              <h4 className="text-sm font-medium text-foreground truncate">{featured.title}</h4>
            </div>
            <p className="text-[11px] text-muted-foreground/70 line-clamp-2 leading-relaxed">
              {featuredLocked
                ? t('discover.challenge_locked_clean').replace('{count}', String(featuredThreshold))
                : featured.description}
            </p>
          </div>
          {featuredPart?.completed && (
            <div className="w-6 h-6 rounded-full bg-accent/15 flex items-center justify-center shrink-0 ml-3">
              <Check className="w-3 h-3 text-accent" />
            </div>
          )}
        </div>

        {!featuredLocked && !featuredPart && (
          <Button
            size="sm"
            variant="outline"
            className="rounded-xl h-8 text-xs mt-1 border-accent/20 text-accent hover:bg-accent/10"
            onClick={() => { hapticSuccess(); onJoin(featured.id); }}
          >
            {t('discover.start')}
          </Button>
        )}

        {!featuredLocked && featuredPart && !featuredPart.completed && (
          <div className="flex items-center gap-2 mt-1">
            <div className="h-1 flex-1 rounded-full bg-muted/30 overflow-hidden">
              <div className="h-full w-1/2 rounded-full bg-accent/60" />
            </div>
            <span className="text-[10px] text-muted-foreground/50">{t('discover.in_progress')}</span>
          </div>
        )}
      </motion.div>

      {/* Compact challenge rows */}
      <div className="space-y-1.5">
        {compact.map((ch, i) => {
          const part = participations[ch.id];
          const threshold = thresholds[i + 1] || 1;
          const isLocked = garmentCount < threshold;

          return (
            <motion.div
              key={ch.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * STAGGER_DELAY, duration: 0.35, ease: EASE_CURVE }}
              className={cn(
                'flex items-center gap-3 rounded-xl px-3.5 py-3 transition-colors',
                isLocked ? 'opacity-40' : 'bg-card/50'
              )}
            >
              {/* Status dot */}
              <div className={cn(
                'w-2 h-2 rounded-full shrink-0',
                part?.completed ? 'bg-accent' :
                part ? 'bg-accent/40' :
                isLocked ? 'bg-muted-foreground/20' : 'bg-muted-foreground/30'
              )} />

              <div className="flex-1 min-w-0">
                <span className="text-[12px] font-medium text-foreground truncate block">{ch.title}</span>
              </div>

              {part?.completed ? (
                <Check className="w-3.5 h-3.5 text-accent shrink-0" />
              ) : isLocked ? (
                <span className="text-[10px] text-muted-foreground/40 shrink-0">
                  {garmentCount}/{threshold}
                </span>
              ) : !part ? (
                <button
                  onClick={() => { hapticLight(); onJoin(ch.id); }}
                  className="text-[10px] font-medium text-accent shrink-0"
                >
                  {t('discover.start')}
                </button>
              ) : (
                <span className="text-[10px] text-muted-foreground/50 shrink-0">
                  {t('discover.in_progress')}
                </span>
              )}
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
