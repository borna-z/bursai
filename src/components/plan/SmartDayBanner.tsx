import { Briefcase, Dumbbell, PartyPopper, Heart, Sparkles, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LazyImageSimple } from '@/components/ui/lazy-image';
import type { OccasionSlot } from '@/hooks/useSmartDayRecommendation';

interface SmartDayBannerProps {
  slots: OccasionSlot[];
  onGenerate: () => void;
  className?: string;
}

const occasionConfig: Record<string, { icon: React.ElementType; label: string; colorClass: string }> = {
  jobb:     { icon: Briefcase,   label: 'Jobbet',    colorClass: 'text-blue-600 dark:text-blue-400 bg-blue-500/10' },
  träning:  { icon: Dumbbell,    label: 'Träning',   colorClass: 'text-green-600 dark:text-green-400 bg-green-500/10' },
  fest:     { icon: PartyPopper, label: 'Fest',      colorClass: 'text-purple-600 dark:text-purple-400 bg-purple-500/10' },
  dejt:     { icon: Heart,       label: 'Dejt',      colorClass: 'text-rose-600 dark:text-rose-400 bg-rose-500/10' },
};

export function SmartDayBanner({ slots, onGenerate, className }: SmartDayBannerProps) {
  if (slots.length === 0) return null;

  return (
    <div className={cn(
      'rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-3',
      className
    )}>
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-primary" />
        <p className="text-xs font-semibold text-primary">Smart förslag baserat på dina händelser</p>
      </div>

      <div className="space-y-2">
        {slots.map((slot, idx) => {
          const config = occasionConfig[slot.occasion] || {
            icon: Sparkles,
            label: slot.occasion,
            colorClass: 'text-muted-foreground bg-muted',
          };
          const Icon = config.icon;

          return (
            <div key={idx} className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <div className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium', config.colorClass)}>
                  <Icon className="w-3 h-3" />
                  <span>{config.label}</span>
                </div>
                <span className="text-[10px] text-muted-foreground truncate max-w-[140px]">{slot.eventTitle}</span>
              </div>

              {/* Garment thumbnails */}
              <div className="flex gap-1.5">
                {slot.garments.map((g) => (
                  <div key={g.id} className="w-10 h-10 rounded-lg overflow-hidden bg-muted shrink-0">
                    <LazyImageSimple
                      imagePath={g.image_path}
                      alt={g.title}
                      className="w-full h-full"
                    />
                  </div>
                ))}
                {slot.garments.length > 0 && (
                  <div className="flex items-center">
                    <span className="text-[10px] text-muted-foreground">{slot.garments.map(g => g.title).join(', ')}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <button
        onClick={onGenerate}
        className="flex items-center gap-1 text-xs text-primary font-medium hover:underline active:opacity-70 transition-opacity"
      >
        Skapa outfit utifrån detta
        <ChevronRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
