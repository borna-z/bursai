import { Briefcase, Dumbbell, PartyPopper, Heart, Sparkles, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LazyImageSimple } from '@/components/ui/lazy-image';
import { useLanguage } from '@/contexts/LanguageContext';
import type { OccasionSlot } from '@/hooks/useSmartDayRecommendation';

interface SmartDayBannerProps {
  slots: OccasionSlot[];
  onGenerate: () => void;
  className?: string;
}

const occasionConfig: Record<string, { icon: React.ElementType; label: string }> = {
  jobb:     { icon: Briefcase,   label: 'Jobb' },
  träning:  { icon: Dumbbell,    label: 'Träning' },
  fest:     { icon: PartyPopper, label: 'Fest' },
  dejt:     { icon: Heart,       label: 'Dejt' },
};

export function SmartDayBanner({ slots, onGenerate, className }: SmartDayBannerProps) {
  const { t } = useLanguage();

  if (slots.length === 0) return null;

  return (
    <div className={cn(
      'rounded-xl bg-muted/40 p-3 space-y-3',
      className
    )}>
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-muted-foreground" />
        <p className="text-xs font-medium text-muted-foreground">{t('smart.title')}</p>
      </div>

      <div className="space-y-2">
        {slots.map((slot, idx) => {
          const config = occasionConfig[slot.occasion] || {
            icon: Sparkles,
            label: slot.occasion,
          };
          const Icon = config.icon;

          return (
            <div key={idx} className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border border-border text-foreground/70">
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
        className="flex items-center gap-1 text-xs text-foreground/70 font-medium hover:text-foreground active:opacity-70 transition-all press"
      >
        {t('smart.create_from')}
        <ChevronRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
