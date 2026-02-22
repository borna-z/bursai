import { cn } from '@/lib/utils';

interface SectionHeaderProps {
  title: string;
  className?: string;
}

export function SectionHeader({ title, className }: SectionHeaderProps) {
  return (
    <h3 className={cn(
      "text-xs font-medium text-muted-foreground uppercase tracking-widest px-1",
      className
    )}>
      {title}
    </h3>
  );
}
