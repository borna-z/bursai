import { cn } from '@/lib/utils';

interface SectionHeaderProps {
  title: string;
  className?: string;
}

export function SectionHeader({ title, className }: SectionHeaderProps) {
  return (
    <h3 className={cn(
      "text-[11px] font-medium text-muted-foreground/70 tracking-wide px-1",
      className
    )}>
      {title}
    </h3>
  );
}
