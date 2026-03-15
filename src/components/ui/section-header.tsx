import { cn } from '@/lib/utils';

interface SectionHeaderProps {
  title: string;
  className?: string;
  action?: string;
  onAction?: () => void;
}

export function SectionHeader({ title, className, action, onAction }: SectionHeaderProps) {
  return (
    <div className={cn("flex items-center justify-between px-1 mb-3", className)}>
      <h3 className="label-editorial">
        {title}
      </h3>
      {action && onAction && (
        <button onClick={onAction} className="text-[0.6875rem] font-semibold text-accent tracking-wide active:opacity-70 transition-opacity">
          {action}
        </button>
      )}
    </div>
  );
}
