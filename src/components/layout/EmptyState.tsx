import { ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

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
  className?: string;
}

export function EmptyState({ 
  icon: Icon, 
  title, 
  description, 
  action,
  secondaryAction,
  compact = false,
  className 
}: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
      className={cn(
        'flex flex-col items-center justify-center px-6 text-center',
        compact ? 'py-14' : 'py-28',
        className,
      )}
    >
      <motion.div
        initial={{ scale: 0.8 }}
        animate={{ scale: 1 }}
        transition={{ duration: 0.5, delay: 0.1, type: 'spring', stiffness: 200 }}
        className={cn(
          'rounded-3xl bg-muted/30 flex items-center justify-center',
          compact ? 'w-14 h-14 mb-6' : 'w-20 h-20 mb-10',
        )}
      >
        <Icon className={cn('text-muted-foreground', compact ? 'w-6 h-6' : 'w-8 h-8')} />
      </motion.div>
      <motion.h3
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className={cn('font-bold tracking-[-0.02em] mb-2', compact ? 'text-base' : 'text-lg')}
      >
        {title}
      </motion.h3>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="text-[0.8125rem] text-muted-foreground/80 max-w-[280px] mb-6 leading-relaxed"
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
