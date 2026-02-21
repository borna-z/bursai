import { useState, useCallback, useEffect } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { Home, Shirt, CalendarDays, Bot, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { EASE_CURVE } from '@/lib/motion';
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

const slideVariants = {
  enter: { opacity: 0, scale: 0.95 },
  center: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 },
};

const slideTransition = {
  type: 'tween' as const,
  ease: EASE_CURVE,
  duration: 0.35,
};

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
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={slideTransition}
        className="text-center pt-12 pb-4 px-6"
      >
        <h1 className="text-2xl font-bold">{t('onboarding.tutorial.title')}</h1>
      </motion.div>

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
                <AnimatePresence mode="wait">
                  {selectedIndex === i && (
                    <motion.div
                      key={i}
                      variants={slideVariants}
                      initial="enter"
                      animate="center"
                      exit="exit"
                      transition={slideTransition}
                      className="flex flex-col items-center"
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
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>

      {/* Dots + Button */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...slideTransition, delay: 0.2 }}
        className="pb-[calc(3rem+env(safe-area-inset-bottom))] px-6 space-y-6"
      >
        {/* Dot indicator */}
        <div className="flex justify-center gap-2">
          {SLIDES.map((_, i) => (
            <motion.div
              key={i}
              animate={{
                width: i === selectedIndex ? 24 : 8,
                backgroundColor: i === selectedIndex ? 'hsl(var(--accent))' : 'hsl(var(--muted-foreground) / 0.3)',
              }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="h-2 rounded-full"
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
      </motion.div>
    </div>
  );
}
