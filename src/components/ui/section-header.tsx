import { cn } from '@/lib/utils';

interface SectionHeaderProps {
  title: string;
  className?: string;
  action?: string;
  onAction?: () => void;
}

export function SectionHeader({ title, className, action, onAction }: SectionHeaderProps) {
  return (
    <div className={cn("flex items-end justify-between gap-3 px-1 mb-4", className)}>
      <h3 className="text-[1.02rem] font-medium tracking-[-0.03em] text-foreground">
        {title}
      </h3>
      {action && onAction && (
        <button
          onClick={onAction}
          className="eyebrow-chip border-transparent bg-secondary/80 text-foreground/70 active:opacity-70"
        >
          {action}
        </button>
      )}
    </div>
  );
}
