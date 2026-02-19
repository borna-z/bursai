import { useState, useCallback, useEffect } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { Home, Shirt, CalendarDays, Bot, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

interface AppTutorialStepProps {
  onComplete: () => void;
}

const SLIDES = [
  {
    icon: Home,
    titleKey: 'onboarding.tutorial.today.title',
    descKey: 'onboarding.tutorial.today.desc',
  },
  {
    icon: Shirt,
    titleKey: 'onboarding.tutorial.wardrobe.title',
    descKey: 'onboarding.tutorial.wardrobe.desc',
  },
  {
    icon: CalendarDays,
    titleKey: 'onboarding.tutorial.plan.title',
    descKey: 'onboarding.tutorial.plan.desc',
  },
  {
    icon: Bot,
    titleKey: 'onboarding.tutorial.stylist.title',
    descKey: 'onboarding.tutorial.stylist.desc',
  },
];

export function AppTutorialStep({ onComplete }: AppTutorialStepProps) {
  const { t } = useLanguage();
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: false });
  const [selectedIndex, setSelectedIndex] = useState(0);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on('select', onSelect);
    return () => { emblaApi.off('select', onSelect); };
  }, [emblaApi, onSelect]);

  const isLast = selectedIndex === SLIDES.length - 1;

  const handleNext = () => {
    if (isLast) {
      onComplete();
    } else {
      emblaApi?.scrollNext();
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="text-center pt-12 pb-4 px-6">
        <h1 className="text-2xl font-bold">{t('onboarding.tutorial.title')}</h1>
      </div>

      {/* Carousel */}
      <div className="flex-1 overflow-hidden" ref={emblaRef}>
        <div className="flex h-full">
          {SLIDES.map((slide, i) => {
            const Icon = slide.icon;
            const descLines = t(slide.descKey).split('\n');
            return (
              <div
                key={i}
                className="flex-[0_0_100%] min-w-0 flex flex-col items-center justify-center px-8 text-center"
              >
                <div className="w-20 h-20 rounded-2xl bg-accent/10 flex items-center justify-center mb-6">
                  <Icon className="w-10 h-10 text-accent" />
                </div>
                <h2 className="text-xl font-semibold mb-4">{t(slide.titleKey)}</h2>
                <ul className="space-y-2 text-muted-foreground text-sm max-w-xs">
                  {descLines.map((line, j) => (
                    <li key={j} className="flex items-start gap-2">
                      <span className="text-accent mt-0.5">•</span>
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>

      {/* Dots + Button */}
      <div className="pb-[calc(3rem+env(safe-area-inset-bottom))] px-6 space-y-6">
        {/* Dot indicator */}
        <div className="flex justify-center gap-2">
          {SLIDES.map((_, i) => (
            <div
              key={i}
              className={cn(
                'w-2 h-2 rounded-full transition-all',
                i === selectedIndex ? 'bg-accent w-6' : 'bg-muted-foreground/30'
              )}
            />
          ))}
        </div>

        <Button
          className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
          size="lg"
          onClick={handleNext}
        >
          {isLast ? t('onboarding.tutorial.start') : t('onboarding.tutorial.next')}
          <ArrowRight className="w-5 h-5 ml-2" />
        </Button>
      </div>
    </div>
  );
}
