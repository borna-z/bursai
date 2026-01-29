import { cn } from '@/lib/utils';

interface MiniBarProps {
  value: number;
  maxValue?: number;
  color?: 'primary' | 'accent' | 'success' | 'warning';
  className?: string;
  showLabel?: boolean;
}

export function MiniBar({ 
  value, 
  maxValue = 100, 
  color = 'primary',
  className,
  showLabel = false
}: MiniBarProps) {
  const percentage = Math.min((value / maxValue) * 100, 100);
  
  const colorClasses = {
    primary: 'bg-primary',
    accent: 'bg-accent',
    success: 'bg-green-500',
    warning: 'bg-amber-500',
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div 
          className={cn("h-full rounded-full transition-all duration-500", colorClasses[color])}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-xs text-muted-foreground font-medium w-10 text-right">
          {Math.round(percentage)}%
        </span>
      )}
    </div>
  );
}

interface ColorBarProps {
  colors: { color: string; count: number; colorClass: string }[];
  total: number;
}

export function ColorBar({ colors, total }: ColorBarProps) {
  return (
    <div className="flex h-3 rounded-full overflow-hidden bg-muted">
      {colors.map((item, index) => {
        const width = (item.count / total) * 100;
        return (
          <div
            key={item.color}
            className={cn(item.colorClass, "transition-all duration-500")}
            style={{ width: `${width}%` }}
            title={`${item.color}: ${item.count} st (${Math.round(width)}%)`}
          />
        );
      })}
    </div>
  );
}
