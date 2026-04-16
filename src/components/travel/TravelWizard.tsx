import { useState, useCallback, type Dispatch, type SetStateAction } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Package } from 'lucide-react';
import type { DateRange } from 'react-day-picker';

import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { EASE_CURVE } from '@/lib/motion';
import { hapticLight } from '@/lib/haptics';
import { cn } from '@/lib/utils';
import type { ForecastDay } from '@/hooks/useForecast';

import { TravelStep1 } from './TravelStep1';
import { TravelStep2 } from './TravelStep2';
import type {
  Companion,
  GarmentSelection,
  LuggageType,
  OccasionId,
  StylePreference,
} from './types';

type Garment = {
  id: string;
  title: string;
  image_path?: string;
  nobg_path?: string | null;
  category: string;
};

interface TravelWizardProps {
  // Step 1 state
  destination: string;
  setDestination: (v: string) => void;
  destCoords: { lat: number; lon: number } | null;
  dateRange: DateRange | undefined;
  setDateRange: (v: DateRange | undefined) => void;
  dateLocale: Locale;
  dateLabel: string | null;
  tripNights: number;
  isFetchingWeather: boolean;
  weatherError: string | null;
  weatherForecast: ForecastDay | null;
  forecastDays: ForecastDay[];
  luggageType: LuggageType;
  setLuggageType: (v: LuggageType) => void;
  handleLocationSelect: (city: string, coords: { lat: number; lon: number }) => void;

  // Step 2 state
  occasions: OccasionId[];
  setOccasions: Dispatch<SetStateAction<OccasionId[]>>;
  companions: Companion;
  setCompanions: (v: Companion) => void;
  stylePreference: StylePreference;
  setStylePreference: (v: StylePreference) => void;
  outfitsPerDay: number;
  setOutfitsPerDay: (v: number) => void;
  mustHaveItems: string[];
  setMustHaveItems: Dispatch<SetStateAction<string[]>>;
  minimizeItems: boolean;
  setMinimizeItems: (v: boolean) => void;
  includeTravelDays: boolean;
  setIncludeTravelDays: (v: boolean) => void;
  allGarments: Garment[] | undefined;
  garmentSelection: GarmentSelection | null;
  setGarmentSelection: (v: GarmentSelection | null) => void;

  // Action
  onGenerate: () => void;
  isGenerating: boolean;
}

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 40 : -40, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -40 : 40, opacity: 0 }),
};

export function TravelWizard(props: TravelWizardProps) {
  const { t } = useLanguage();
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);

  const canAdvanceFromStep1 =
    props.destination.trim().length >= 2 && !!props.dateRange?.from && !!props.dateRange?.to;

  const goNext = useCallback(() => {
    hapticLight();
    setDirection(1);
    setStep((s) => Math.min(s + 1, 1));
  }, []);

  const goBack = useCallback(() => {
    hapticLight();
    setDirection(-1);
    setStep((s) => Math.max(s - 1, 0));
  }, []);

  const handlePrimary = useCallback(() => {
    if (step === 0) {
      goNext();
    } else {
      hapticLight();
      props.onGenerate();
    }
  }, [step, goNext, props]);

  const primaryDisabled = step === 0 ? !canAdvanceFromStep1 : props.occasions.length === 0;
  const primaryLabel =
    step === 0
      ? t('travel.next') || 'Next'
      : props.isGenerating
        ? t('capsule.generating') || 'Generating...'
        : t('travel.generate') || 'Generate capsule';

  return (
    <div className="flex flex-col gap-6">
      <div className="relative min-h-[min(460px,70vh)]">
        <AnimatePresence mode="wait" custom={direction} initial={false}>
          <motion.div
            key={step}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.22, ease: EASE_CURVE }}
          >
            {step === 0 ? (
              <TravelStep1
                destination={props.destination}
                setDestination={props.setDestination}
                dateRange={props.dateRange}
                setDateRange={props.setDateRange}
                dateLocale={props.dateLocale}
                dateLabel={props.dateLabel}
                tripNights={props.tripNights}
                isFetchingWeather={props.isFetchingWeather}
                weatherError={props.weatherError}
                weatherForecast={props.weatherForecast}
                forecastDays={props.forecastDays}
                luggageType={props.luggageType}
                setLuggageType={props.setLuggageType}
                handleLocationSelect={props.handleLocationSelect}
              />
            ) : (
              <TravelStep2
                occasions={props.occasions}
                setOccasions={props.setOccasions}
                companions={props.companions}
                setCompanions={props.setCompanions}
                stylePreference={props.stylePreference}
                setStylePreference={props.setStylePreference}
                outfitsPerDay={props.outfitsPerDay}
                setOutfitsPerDay={props.setOutfitsPerDay}
                mustHaveItems={props.mustHaveItems}
                setMustHaveItems={props.setMustHaveItems}
                minimizeItems={props.minimizeItems}
                setMinimizeItems={props.setMinimizeItems}
                includeTravelDays={props.includeTravelDays}
                setIncludeTravelDays={props.setIncludeTravelDays}
                allGarments={props.allGarments}
                garmentSelection={props.garmentSelection}
                setGarmentSelection={props.setGarmentSelection}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex items-center justify-center gap-2" aria-hidden>
        {[0, 1].map((i) => (
          <span
            key={i}
            className={cn(
              'h-1.5 rounded-full transition-all duration-300',
              i === step ? 'w-6 bg-accent' : 'w-1.5 bg-border/60',
            )}
          />
        ))}
      </div>

      <div className="flex items-center justify-between gap-3">
        <Button
          variant="ghost"
          onClick={goBack}
          disabled={step === 0}
          className="rounded-full"
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          {t('travel.back') || 'Back'}
        </Button>
        <Button
          onClick={handlePrimary}
          disabled={primaryDisabled || props.isGenerating}
          size="lg"
          className="rounded-full px-6"
        >
          {step === 1 ? <Package className="mr-2 h-4 w-4" /> : null}
          {primaryLabel}
          {step === 0 ? <ChevronRight className="ml-1 h-4 w-4" /> : null}
        </Button>
      </div>
    </div>
  );
}
