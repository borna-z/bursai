import { cn } from '@/lib/utils';

interface SectionHeaderProps {
  title: string;
  className?: string;
  action?: string;
  onAction?: () => void;
}

export function SectionHeader({ title, className, action, onAction }: SectionHeaderProps) {
  return (
    <div className={cn("flex items-center justify-between px-1 mb-2.5", className)}>
      <h3 className="text-[11px] font-medium text-muted-foreground/70 tracking-wide uppercase">
        {title}
      </h3>
      {action && onAction && (
        <button onClick={onAction} className="text-[11px] font-medium text-accent active:opacity-70 transition-opacity">
          {action}
        </button>
      )}
    </div>
  );
}
