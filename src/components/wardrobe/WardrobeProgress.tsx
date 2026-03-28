import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Check, Lock, Plus } from 'lucide-react';

import { useLanguage } from '@/contexts/LanguageContext';
import { useWardrobeUnlocks } from '@/hooks/useWardrobeUnlocks';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { EASE_CURVE, STAGGER_DELAY } from '@/lib/motion';
import { cn } from '@/lib/utils';

interface WardrobeProgressProps {
  message?: string;
  compact?: boolean;
}

export function WardrobeProgress({
  message,
  compact = false,
}: WardrobeProgressProps) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { tiers, currentCount, nextTier, garmentsNeeded } = useWardrobeUnlocks();

  const nextTarget = nextTier?.minGarments ?? currentCount;
  const previousTargets = tiers
    .filter((tier) => tier.minGarments <= currentCount)
    .map((tier) => tier.minGarments);
  const prevTarget = previousTargets.length > 0 ? Math.max(...previousTargets) : 0;
  const range = nextTarget - prevTarget || 1;
  const progressPct = nextTier
    ? Math.min(((currentCount - prevTarget) / range) * 100, 100)
    : 100;

  const milestoneMap = new Map<number, typeof tiers>();
  tiers.forEach((tier) => {
    const existing = milestoneMap.get(tier.minGarments) ?? [];
    existing.push(tier);
    milestoneMap.set(tier.minGarments, existing);
  });

  const milestones = Array.from(milestoneMap.entries())
    .sort(([a], [b]) => a - b)
    .filter(([min]) => min > 0);

  return (
    <div className={cn('space-y-5', compact && 'space-y-4')}>
      {message ? (
        <p className="text-[13px] leading-relaxed text-muted-foreground/70">
          {message}
        </p>
      ) : null}

      {nextTier ? (
        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <span className="text-[12px] font-medium text-foreground">
              {currentCount} {t('unlock.garments_count')}
            </span>
            <span className="text-[11px] text-muted-foreground/50">
              {garmentsNeeded} {t('unlock.more_to_next')}
            </span>
          </div>
          <Progress value={progressPct} className="h-1.5 bg-muted/20" />
        </div>
      ) : null}

      <div className="space-y-2">
        {milestones.map(([minGarments, tierGroup], idx) => {
          const unlocked = currentCount >= minGarments;

          return (
            <motion.div
              key={minGarments}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * STAGGER_DELAY, duration: 0.3, ease: EASE_CURVE }}
              className={cn(
                'flex items-center gap-3 rounded-xl border p-3',
                unlocked
                  ? 'border-accent/15 bg-accent/[0.03]'
                  : 'border-border/15 bg-card/60',
              )}
            >
              <div
                className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
                  unlocked ? 'bg-accent/15' : 'bg-foreground/[0.04]',
                )}
              >
                {unlocked ? (
                  <Check className="h-3.5 w-3.5 text-accent" />
                ) : (
                  <Lock className="h-3.5 w-3.5 text-muted-foreground/40" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <span
                  className={cn(
                    'block text-[12px] font-medium',
                    unlocked ? 'text-foreground' : 'text-muted-foreground/60',
                  )}
                >
                  {tierGroup.map((tier) => t(tier.labelKey)).join(' · ')}
                </span>
                {!unlocked ? (
                  <span className="text-[10px] text-muted-foreground/40">
                    {t('unlock.add_x_to_unlock').replace('{count}', String(minGarments - currentCount))}
                  </span>
                ) : null}
              </div>
            </motion.div>
          );
        })}
      </div>

      <Button
        onClick={() => navigate('/wardrobe/add')}
        className="w-full"
        size={compact ? 'sm' : 'default'}
      >
        <Plus className="mr-1.5 h-4 w-4" />
        {t('unlock.add_to_wardrobe')}
      </Button>
    </div>
  );
}
