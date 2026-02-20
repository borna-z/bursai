import { format, addDays, isToday, isTomorrow } from 'date-fns';
import { Calendar, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { WeatherForecastBadge } from '@/components/outfit/WeatherForecastBadge';
import { useLanguage } from '@/contexts/LanguageContext';

interface PreselectDateSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectDate: (date: Date) => void;
  isLoading?: boolean;
}

export function PreselectDateSheet({
  open,
  onOpenChange,
  onSelectDate,
  isLoading,
}: PreselectDateSheetProps) {
  const { t } = useLanguage();
  const days = Array.from({ length: 7 }, (_, i) => addDays(new Date(), i));

  const getDateLabel = (date: Date): string => {
    if (isToday(date)) return t('plan.today');
    if (isTomorrow(date)) return t('plan.tomorrow');
    return date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-auto max-h-[70vh] rounded-t-2xl">
        <SheetHeader className="text-left pb-4">
          <SheetTitle>{t('plan.plan_outfit')}</SheetTitle>
          <SheetDescription>
            {t('plan.choose_day')}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-2 pb-6">
          {days.map((date) => {
            const dateStr = format(date, 'yyyy-MM-dd');
            return (
              <button
                key={dateStr}
                onClick={() => onSelectDate(date)}
                disabled={isLoading}
                className={cn(
                  'w-full flex items-center justify-between p-3 rounded-lg',
                  'border bg-card hover:bg-muted/50 transition-colors active:scale-[0.99]',
                  isLoading && 'opacity-50'
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center',
                    isToday(date) ? 'bg-primary text-primary-foreground' : 'bg-muted'
                  )}>
                    <Calendar className="w-4 h-4" />
                  </div>
                  <span className="font-medium capitalize">{getDateLabel(date)}</span>
                </div>
                <WeatherForecastBadge date={dateStr} compact />
              </button>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
