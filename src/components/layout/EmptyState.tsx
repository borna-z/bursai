import { LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { EASE_CURVE } from '@/lib/motion';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  /** Use compact for inline contexts (less vertical padding) */
  compact?: boolean;
  /** Premium editorial variant with softer background and glow */
  variant?: 'default' | 'editorial';
  className?: string;
  /** Custom class for the title element (e.g. for Playfair Display) */
  titleClassName?: string;
  /** Optional progress indicator (e.g. 2/3 garments added) */
  progress?: { current: number; target: number; label: string };
  /** Optional hint text below description */
  hint?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  compact = false,
  variant = 'default',
  className,
  titleClassName,
  progress,
  hint,
}: EmptyStateProps) {
  const isEditorial = variant === 'editorial';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE_CURVE }}
      className={cn(
        'flex flex-col items-center justify-center px-6 text-center',
        compact ? 'py-14' : 'py-28',
        isEditorial && 'surface-editorial',
        isEditorial && 'px-5',
        isEditorial && (compact ? 'py-10' : 'py-16'),
        className,
      )}
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.1, type: 'spring', stiffness: 200 }}
        className={cn(
          'flex items-center justify-center relative',
          compact ? 'w-14 h-14 mb-6' : 'w-20 h-20 mb-10',
          isEditorial
            ? 'rounded-[1.35rem] bg-background/76 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]'
            : 'rounded-[var(--radius,1.5rem)] bg-muted/30',
        )}
      >
        <Icon className={cn(
          compact ? 'w-6 h-6' : 'w-8 h-8',
          isEditorial ? 'text-foreground/55' : 'text-muted-foreground',
        )} />
        {isEditorial && !compact && (
          <div className="absolute -inset-3 rounded-3xl bg-accent-indigo/8 blur-xl pointer-events-none" />
        )}
      </motion.div>
      <motion.h3
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className={cn('mb-2.5 font-semibold tracking-[-0.04em]', compact ? 'text-base' : 'text-lg', titleClassName)}
      >
        {title}
      </motion.h3>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="text-[0.8125rem] text-muted-foreground/80 max-w-[280px] leading-relaxed"
      >
        {description}
      </motion.p>
      {hint && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35 }}
          className="text-[11px] text-muted-foreground/50 max-w-[260px] mt-1.5 leading-relaxed"
        >
          {hint}
        </motion.p>
      )}
      {progress && (
        <motion.div
          initial={{ opacity: 0, scaleX: 0.8 }}
          animate={{ opacity: 1, scaleX: 1 }}
          transition={{ delay: 0.35, duration: 0.4, ease: EASE_CURVE }}
          className="w-full max-w-[200px] mt-5 mb-2"
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] text-muted-foreground/50 uppercase tracking-wider font-medium">
              {progress.label}
            </span>
            <span className="text-[10px] text-muted-foreground/60 tabular-nums font-medium">
              {progress.current}/{progress.target}
            </span>
          </div>
          <div className="h-1 rounded-full bg-muted/30 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min((progress.current / progress.target) * 100, 100)}%` }}
              transition={{ delay: 0.5, duration: 0.6, ease: EASE_CURVE }}
              className="h-full rounded-full bg-primary/60"
            />
          </div>
        </motion.div>
      )}
      <div className={cn(!progress && 'mt-8', progress && 'mt-4')}>
      {action && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Button onClick={action.onClick} size={compact ? 'default' : 'lg'} variant={isEditorial ? 'editorial' : 'default'}>
            {action.icon && <action.icon className="w-4 h-4 mr-2" />}
            {action.label}
          </Button>
        </motion.div>
      )}
      {secondaryAction && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          onClick={secondaryAction.onClick}
          className="mt-3 text-xs text-muted-foreground/50 hover:text-foreground transition-colors"
        >
          {secondaryAction.label}
        </motion.button>
      )}
      </div>
    </motion.div>
  );
}
