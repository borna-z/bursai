import { CalendarIcon, Cloud, Globe, Briefcase, Luggage, Package } from 'lucide-react';
import type { DateRange } from 'react-day-picker';

import { AILoadingCard } from '@/components/ui/AILoadingCard';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import { LocationAutocomplete } from '@/components/ui/LocationAutocomplete';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useLanguage } from '@/contexts/LanguageContext';
import type { ForecastDay } from '@/hooks/useForecast';
import { hapticLight } from '@/lib/haptics';
import { cn } from '@/lib/utils';

import { WeatherMiniIcon } from './WeatherMiniIcon';
import type { LuggageType } from './types';

interface TravelStep1Props {
  destination: string;
  setDestination: (v: string) => void;
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
}

const LUGGAGE_OPTIONS: { id: LuggageType; labelKey: string; icon: typeof Briefcase }[] = [
  { id: 'carry_on', labelKey: 'travel.luggage_carry_on', icon: Briefcase },
  { id: 'carry_on_personal', labelKey: 'travel.luggage_carry_on_personal', icon: Luggage },
  { id: 'checked', labelKey: 'travel.luggage_checked', icon: Package },
];

export function TravelStep1({
  destination,
  setDestination,
  dateRange,
  setDateRange,
  dateLocale,
  dateLabel,
  tripNights,
  isFetchingWeather,
  weatherError,
  weatherForecast,
  forecastDays,
  luggageType,
  setLuggageType,
  handleLocationSelect,
}: TravelStep1Props) {
  const { t } = useLanguage();
  const previewForecastDays = forecastDays.slice(0, 5);

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <p className="label-editorial text-accent/70">{t('travel.step1_title') || 'Where and when'}</p>
        <h2 className="font-display italic text-[1.35rem] tracking-[-0.02em] text-foreground">
          {t('capsule.destination') || 'Destination'}
        </h2>
      </div>

      <Card className="space-y-4 p-5">
        <div className="space-y-2">
          <Label className="label-editorial">{t('capsule.destination')}</Label>
          <LocationAutocomplete
            value={destination}
            onChange={setDestination}
            onSelect={handleLocationSelect}
            placeholder={t('capsule.enter_city')}
            icon={<Globe className="h-4 w-4" strokeWidth={1.5} />}
            inputClassName="h-12 rounded-[1.25rem] bg-background/85 border-border/60"
          />
        </div>

        <div className="space-y-2">
          <Label className="label-editorial">{t('capsule.travel_dates')}</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'h-12 w-full justify-start rounded-[1.25rem] text-left font-normal',
                  !dateRange?.from && 'text-muted-foreground',
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground/60" />
                {dateLabel
                  ? `${dateLabel} (${tripNights} ${t('capsule.nights')})`
                  : t('capsule.select_dates_hint')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="range"
                selected={dateRange}
                onSelect={setDateRange}
                numberOfMonths={1}
                disabled={(date) => date < new Date()}
                locale={dateLocale}
                className="pointer-events-auto p-3"
              />
            </PopoverContent>
          </Popover>
        </div>

        {isFetchingWeather ? (
          <AILoadingCard
            phases={[
              { icon: Globe, label: `${t('capsule.looking_up') || 'Looking up'} ${destination}...`, duration: 1500 },
              { icon: Cloud, label: t('qgen.fetching_weather'), duration: 0 },
            ]}
          />
        ) : null}

        {weatherError ? (
          <p className="text-xs text-muted-foreground">{weatherError}</p>
        ) : null}

        {!isFetchingWeather && previewForecastDays.length > 0 ? (
          <div className="flex items-center gap-2 overflow-x-auto rounded-[1.25rem] border border-border/40 bg-background/60 px-3 py-3">
            {previewForecastDays.map((day) => (
              <div
                key={day.date}
                className="flex min-w-[58px] flex-col items-center gap-1 text-center"
              >
                <WeatherMiniIcon condition={day.condition} />
                <span className="text-[11px] font-medium text-foreground/80">
                  {Math.round(day.temperature_max)}°
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {Math.round(day.temperature_min)}°
                </span>
              </div>
            ))}
            {weatherForecast ? (
              <div className="ml-auto hidden flex-col text-right sm:flex">
                <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  {weatherForecast.condition}
                </span>
                <span className="text-[11px] text-foreground/70">
                  {weatherForecast.temperature_min}°–{weatherForecast.temperature_max}°
                </span>
              </div>
            ) : null}
          </div>
        ) : !isFetchingWeather && !weatherError ? (
          <p className="text-xs text-muted-foreground">
            {t('travel.weather_auto') || 'Weather loads automatically once destination and dates are set.'}
          </p>
        ) : null}
      </Card>

      <Card className="space-y-3 p-5">
        <Label className="label-editorial">{t('travel.luggage_label') || 'Luggage'}</Label>
        <div className="flex flex-wrap gap-2">
          {LUGGAGE_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const active = luggageType === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  hapticLight();
                  setLuggageType(opt.id);
                }}
                className={cn(
                  'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors',
                  active
                    ? 'border-foreground bg-foreground text-background shadow-sm'
                    : 'border-border/40 bg-transparent text-foreground/70 hover:border-border/60',
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {t(opt.labelKey)}
              </button>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
