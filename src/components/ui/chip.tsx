import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

const chipVariants = cva(
  'inline-flex items-center gap-1.5 rounded-[var(--radius,9999px)] text-[0.8125rem] font-semibold transition-all cursor-pointer select-none active:scale-[0.96] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 outline-none',
  {
    variants: {
      variant: {
        default: 'bg-secondary/72 backdrop-blur-sm text-secondary-foreground hover:bg-secondary border border-border/65',
        selected: 'bg-accent text-accent-foreground shadow-[0_10px_22px_rgba(0,0,0,0.22)]',
        outline: 'border border-border/65 bg-background/56 backdrop-blur-sm hover:bg-secondary/60',
        filter: 'bg-muted/72 backdrop-blur-sm text-muted-foreground hover:bg-muted border border-border/65',
      },
      size: {
        sm: 'px-2.5 py-1 text-xs',
        md: 'px-3 py-1.5 text-sm',
        lg: 'px-4 py-2 text-sm min-h-[40px]',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
);

export interface ChipProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof chipVariants> {
  selected?: boolean;
  onRemove?: () => void;
  removable?: boolean;
}

const Chip = React.forwardRef<HTMLDivElement, ChipProps>(
  ({ className, variant, size, selected, onRemove, removable, children, ...props }, ref) => {
    const effectiveVariant = selected ? 'selected' : variant;
    
    return (
      <div
        ref={ref}
        className={cn(chipVariants({ variant: effectiveVariant, size }), className)}
        {...props}
      >
        {children}
        {removable && onRemove && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="rounded-full p-0.5 hover:bg-foreground/10 transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>
    );
  }
);
Chip.displayName = 'Chip';

// eslint-disable-next-line react-refresh/only-export-components
export { Chip, chipVariants };
