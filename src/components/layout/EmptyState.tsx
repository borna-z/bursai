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
}

export function EmptyState({ 
  icon: Icon, 
  title, 
  description, 
  action,
  secondaryAction,
  compact = false,
  variant = 'default',
  className 
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
        isEditorial && 'rounded-2xl bg-gradient-to-b from-primary/[0.04] to-transparent border border-border/10',
        isEditorial && (compact ? 'py-10' : 'py-20'),
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
            ? 'rounded-2xl bg-primary/[0.08]'
            : 'rounded-[var(--radius,1.5rem)] bg-muted/30',
        )}
      >
        <Icon className={cn(
          compact ? 'w-6 h-6' : 'w-8 h-8',
          isEditorial ? 'text-primary/60' : 'text-muted-foreground',
        )} />
        {isEditorial && !compact && (
          <div className="absolute -inset-3 rounded-3xl bg-primary/5 blur-xl pointer-events-none" />
        )}
      </motion.div>
      <motion.h3
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className={cn('font-bold tracking-[-0.02em] mb-2.5', compact ? 'text-base' : 'text-lg')}
      >
        {title}
      </motion.h3>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="text-[0.8125rem] text-muted-foreground/80 max-w-[280px] mb-8 leading-relaxed"
      >
        {description}
      </motion.p>
      {action && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Button onClick={action.onClick} size={compact ? 'default' : 'lg'}>
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
    </motion.div>
  );
}
