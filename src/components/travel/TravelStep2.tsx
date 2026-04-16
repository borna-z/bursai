import { type Dispatch, type SetStateAction, useState } from 'react';
import {
  Briefcase,
  Wine,
  Umbrella,
  Mountain,
  Music,
  Heart,
  Map,
  Plane,
  Dumbbell,
  Minus,
  Plus,
  Shirt,
  ChevronDown,
  type LucideIcon,
} from 'lucide-react';

import { Label } from '@/components/ui/label';
import { LazyImageSimple } from '@/components/ui/lazy-image';
import { Switch } from '@/components/ui/switch';
import { useLanguage } from '@/contexts/LanguageContext';
import { getPreferredGarmentImagePath } from '@/lib/garmentImage';
import { hapticLight } from '@/lib/haptics';
import { cn } from '@/lib/utils';

import { GarmentSelectionPanel } from './GarmentSelectionPanel';
import { OCCASIONS, type Companion, type GarmentSelection, type OccasionId, type StylePreference } from './types';

const OCCASION_ICONS: Record<OccasionId, LucideIcon> = {
  work: Briefcase,
  dinner: Wine,
  beach: Umbrella,
  hiking: Mountain,
  nightlife: Music,
  wedding: Heart,
  sightseeing: Map,
  airport: Plane,
  active: Dumbbell,
};

type Garment = {
  id: string;
  title: string;
  image_path?: string;
  nobg_path?: string | null;
  category: string;
};

interface TravelStep2Props {
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
}

const COMPANION_OPTIONS: { id: Companion; labelKey: string }[] = [
  { id: 'solo', labelKey: 'travel.companions_solo' },
  { id: 'partner', labelKey: 'travel.companions_partner' },
  { id: 'friends', labelKey: 'travel.companions_friends' },
  { id: 'family', labelKey: 'travel.companions_family' },
];

const STYLE_OPTIONS: { id: StylePreference; labelKey: string }[] = [
  { id: 'casual', labelKey: 'travel.style_casual' },
  { id: 'balanced', labelKey: 'travel.style_balanced' },
  { id: 'dressy', labelKey: 'travel.style_dressy' },
];

const MAX_MUST_HAVES = 8;

export function TravelStep2({
  occasions,
  setOccasions,
  companions,
  setCompanions,
  stylePreference,
  setStylePreference,
  outfitsPerDay,
  setOutfitsPerDay,
  mustHaveItems,
  setMustHaveItems,
  minimizeItems,
  setMinimizeItems,
  includeTravelDays,
  setIncludeTravelDays,
  allGarments,
  garmentSelection,
  setGarmentSelection,
}: TravelStep2Props) {
  const { t } = useLanguage();
  const [mustHavesOpen, setMustHavesOpen] = useState(false);

  const toggleOccasion = (id: OccasionId) => {
    hapticLight();
    setOccasions((prev) =>
      prev.includes(id) ? prev.filter((o) => o !== id) : [...prev, id],
    );
  };

  const toggleMustHave = (id: string) => {
    hapticLight();
    setMustHaveItems((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_MUST_HAVES) return prev;
      return [...prev, id];
    });
  };

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <p className="label-editorial text-accent/70">{t('travel.step2_title') || 'Plan your trip'}</p>
        <h2 className="font-display italic text-[1.35rem] tracking-[-0.02em] text-foreground">
          {t('travel.what_kind') || 'What kind of trip?'}
        </h2>
      </div>

      <div className="space-y-3">
        <Label className="label-editorial">{t('travel.occasions_label') || 'Occasions'}</Label>
        <div className="grid grid-cols-3 gap-2">
          {OCCASIONS.map((opt) => {
            const Icon = OCCASION_ICONS[opt.id];
            const active = occasions.includes(opt.id);
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => toggleOccasion(opt.id)}
                className={cn(
                  'flex flex-col items-center gap-1.5 rounded-[1.1rem] border px-2 py-3 text-center transition-colors',
                  active
                    ? 'border-accent bg-accent/10 text-foreground'
                    : 'border-border/40 bg-transparent text-foreground/70 hover:border-border/60',
                )}
              >
                <Icon className="h-4 w-4" strokeWidth={1.5} />
                <span className="text-[11px] font-medium leading-tight">
                  {t(opt.labelKey)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-3 border-t border-border/40 pt-6">
        <Label className="label-editorial">{t('travel.companions_label') || 'Who are you with?'}</Label>
        <div className="flex flex-wrap gap-2">
          {COMPANION_OPTIONS.map((opt) => {
            const active = companions === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  hapticLight();
                  setCompanions(opt.id);
                }}
                className={cn(
                  'rounded-full border px-4 py-2 text-sm transition-colors',
                  active
                    ? 'border-foreground bg-foreground text-background'
                    : 'border-border/40 bg-transparent text-foreground/70 hover:border-border/60',
                )}
              >
                {t(opt.labelKey)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-3 border-t border-border/40 pt-6">
        <Label className="label-editorial">{t('travel.style_label') || 'Style preference'}</Label>
        <div className="flex flex-wrap gap-2">
          {STYLE_OPTIONS.map((opt) => {
            const active = stylePreference === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  hapticLight();
                  setStylePreference(opt.id);
                }}
                className={cn(
                  'rounded-full border px-4 py-2 text-sm transition-colors',
                  active
                    ? 'border-foreground bg-foreground text-background'
                    : 'border-border/40 bg-transparent text-foreground/70 hover:border-border/60',
                )}
              >
                {t(opt.labelKey)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-3 border-t border-border/40 pt-6">
        <div className="space-y-1">
          <Label className="label-editorial">{t('capsule.outfits_per_day')}</Label>
          <p className="text-xs text-muted-foreground">{t('capsule.outfits_per_day_desc')}</p>
        </div>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => {
              hapticLight();
              setOutfitsPerDay(Math.max(1, outfitsPerDay - 1));
            }}
            disabled={outfitsPerDay <= 1}
            className="flex h-11 w-11 items-center justify-center rounded-[1rem] border border-border/40 disabled:opacity-35"
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="font-display italic text-[1.8rem] leading-none tracking-[-0.02em]">
            {outfitsPerDay}
          </span>
          <button
            type="button"
            onClick={() => {
              hapticLight();
              setOutfitsPerDay(Math.min(4, outfitsPerDay + 1));
            }}
            disabled={outfitsPerDay >= 4}
            className="flex h-11 w-11 items-center justify-center rounded-[1rem] border border-border/40 disabled:opacity-35"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>

      {(allGarments?.length ?? 0) > 0 ? (
        <div className="space-y-3 border-t border-border/40 pt-6">
          <button
            type="button"
            onClick={() => setMustHavesOpen((v) => !v)}
            className="flex w-full items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <Shirt className="h-4 w-4 text-muted-foreground" />
              <span className="label-editorial">
                {t('capsule.must_haves')}
                {mustHaveItems.length > 0 ? ` · ${mustHaveItems.length}` : ''}
              </span>
            </div>
            <ChevronDown
              className={cn(
                'h-4 w-4 text-muted-foreground transition-transform',
                mustHavesOpen ? 'rotate-180' : '',
              )}
            />
          </button>

          {mustHavesOpen ? (
            <div className={cn(
              'max-h-[320px] overflow-y-auto scrollbar-hide',
              (allGarments ?? []).length > 16 && 'scroll-fade-bottom',
            )}>
            <div className="grid grid-cols-4 gap-2">
              {(allGarments ?? []).map((garment) => {
                const active = mustHaveItems.includes(garment.id);
                const limitReached = !active && mustHaveItems.length >= MAX_MUST_HAVES;
                return (
                  <button
                    key={garment.id}
                    type="button"
                    disabled={limitReached}
                    onClick={() => toggleMustHave(garment.id)}
                    className={cn(
                      'relative aspect-square overflow-hidden rounded-[1rem] border transition-all',
                      active
                        ? 'border-accent ring-2 ring-accent/30'
                        : 'border-border/40',
                      limitReached && 'opacity-40',
                    )}
                  >
                    <LazyImageSimple
                      imagePath={getPreferredGarmentImagePath(garment)}
                      alt={garment.title}
                      className="h-full w-full object-cover"
                    />
                    {active ? (
                      <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[0.62rem] font-medium text-white">
                        ✓
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {(allGarments?.length ?? 0) > 0 ? (
        <div className="space-y-3 border-t border-border/40 pt-6">
          <GarmentSelectionPanel
            allGarments={allGarments ?? []}
            value={garmentSelection}
            onChange={setGarmentSelection}
          />
        </div>
      ) : null}

      <div className="border-t border-border/40 pt-6">
        <label className="flex cursor-pointer items-center justify-between gap-3">
          <div>
            <span className="text-sm font-medium text-foreground">{t('capsule.minimize')}</span>
            <p className="mt-1 text-xs text-muted-foreground">{t('capsule.minimize_desc')}</p>
          </div>
          <Switch checked={minimizeItems} onCheckedChange={setMinimizeItems} />
        </label>
      </div>

      <div className="border-t border-border/40 pt-6">
        <label className="flex cursor-pointer items-center justify-between gap-3">
          <div>
            <span className="text-sm font-medium text-foreground">{t('capsule.include_travel_days')}</span>
            <p className="mt-1 text-xs text-muted-foreground">{t('capsule.include_travel_days_desc')}</p>
          </div>
          <Switch checked={includeTravelDays} onCheckedChange={setIncludeTravelDays} />
        </label>
      </div>
    </div>
  );
}
