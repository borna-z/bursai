import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Check, Lock, Plus } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useWardrobeUnlocks } from '@/hooks/useWardrobeUnlocks';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { EASE_CURVE, STAGGER_DELAY } from '@/lib/motion';
import { cn } from '@/lib/utils';

interface Props {
  /** Optional message shown above the progress section */
  message?: string;
  /** If true, renders compact (for inline gates) */
  compact?: boolean;
}

export function WardrobeProgress({ message, compact = false }: Props) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { tiers, currentCount, nextTier, garmentsNeeded } = useWardrobeUnlocks();

  // Progress toward next milestone
  const nextTarget = nextTier?.minGarments ?? currentCount;
  // Find the previous milestone for progress calculation
  const prevMilestones = tiers.filter(t => t.minGarments <= currentCount).map(t => t.minGarments);
  const prevTarget = prevMilestones.length > 0 ? Math.max(...prevMilestones) : 0;
  const range = nextTarget - prevTarget || 1;
  const progressPct = nextTier
    ? Math.min(((currentCount - prevTarget) / range) * 100, 100)
    : 100;

  // Deduplicate tiers by minGarments for display (group features at same level)
  const milestoneMap = new Map<number, typeof tiers>();
  tiers.forEach(tier => {
    const existing = milestoneMap.get(tier.minGarments) ?? [];
    existing.push(tier);
    milestoneMap.set(tier.minGarments, existing);
  });
  const milestones = Array.from(milestoneMap.entries())
    .sort(([a], [b]) => a - b)
    .filter(([min]) => min > 0); // skip wardrobe (always unlocked)

  return (
    <div className={cn('space-y-5', compact && 'space-y-4')}>
      {/* Optional message */}
      {message && (
        <p className="text-[13px] text-muted-foreground/70 leading-relaxed">{message}</p>
      )}

      {/* Progress bar */}
      {nextTier && (
        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <span className="text-[12px] font-medium text-foreground">
              {currentCount} {t('unlock.garments_count')}
            </span>
            <span className="text-[11px] text-muted-foreground/60">
              {garmentsNeeded} {t('unlock.more_to_next')}
            </span>
          </div>
          <Progress value={progressPct} className="h-1.5 bg-muted/20" />
        </div>
      )}

      {/* Feature list */}
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
                  : 'border-border/15 bg-card/60'
              )}
            >
              {/* Icon */}
              <div className={cn(
                'w-7 h-7 rounded-lg flex items-center justify-center shrink-0',
                unlocked ? 'bg-accent/15' : 'bg-foreground/[0.04]'
              )}>
                {unlocked ? (
                  <Check className="w-3.5 h-3.5 text-accent" />
                ) : (
                  <Lock className="w-3.5 h-3.5 text-muted-foreground/40" />
                )}
              </div>

              {/* Label */}
              <div className="flex-1 min-w-0">
                <span className={cn(
                  'text-[12px] font-medium block',
                  unlocked ? 'text-foreground' : 'text-muted-foreground/60'
                )}>
                  {tierGroup.map(t => t.labelKey).map(k => t(k)).join(' · ')}
                </span>
                {!unlocked && (
                  <span className="text-[10px] text-muted-foreground/60">
                    {t('unlock.add_x_to_unlock').replace('{count}', String(minGarments - currentCount))}
                  </span>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* CTA */}
      <Button
        onClick={() => navigate('/wardrobe/add')}
        className="w-full"
        size={compact ? 'sm' : 'default'}
      >
        <Plus className="w-4 h-4 mr-1.5" />
        {t('unlock.add_to_wardrobe')}
      </Button>
    </div>
  );
}
