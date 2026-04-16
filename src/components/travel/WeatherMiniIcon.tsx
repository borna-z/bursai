import { Sun, CloudRain, Cloud, Snowflake } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WeatherMiniIconProps {
  condition?: string;
  className?: string;
}

export function WeatherMiniIcon({ condition, className }: WeatherMiniIconProps) {
  const cls = cn('w-3.5 h-3.5', className);
  const label = condition || 'sunny';
  if (!condition) return <Sun className={cn(cls, 'text-primary')} aria-label={label} />;
  if (condition.includes('snow')) return <Snowflake className={cn(cls, 'text-accent')} aria-label={label} />;
  if (condition.includes('rain') || condition.includes('drizzle') || condition.includes('shower')) return <CloudRain className={cn(cls, 'text-accent')} aria-label={label} />;
  if (condition.includes('cloud') || condition.includes('fog')) return <Cloud className={cn(cls, 'text-muted-foreground')} aria-label={label} />;
  return <Sun className={cn(cls, 'text-primary')} aria-label={label} />;
}
