import { motion } from 'framer-motion';
import { LockKeyhole, Package } from 'lucide-react';
import { useWardrobeUnlocks } from '@/hooks/useWardrobeUnlocks';
import { WardrobeProgress } from '@/components/discover/WardrobeProgress';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { AILoadingCard } from '@/components/ui/AILoadingCard';
import { AnimatedPage } from '@/components/ui/animated-page';
import { PageIntro } from '@/components/ui/page-intro';

import { useLanguage } from '@/contexts/LanguageContext';
import { TravelResultsView } from '@/components/travel/TravelResultsView';
import { TravelWizard } from '@/components/travel/TravelWizard';
import { TripHistoryList } from '@/components/travel/TripHistoryList';
import { useTravelCapsule } from '@/components/travel/useTravelCapsule';
import type {
  Companion,
  LuggageType,
  OccasionId,
  StylePreference,
  TravelCapsuleRow,
} from '@/components/travel/types';
import { EASE_CURVE } from '@/lib/motion';

export default function TravelCapsule() {
  const { t } = useLanguage();
  const { isUnlocked } = useWardrobeUnlocks();
  const capsule = useTravelCapsule();

  // Gate: require enough garments
  if (!isUnlocked('travel_capsule')) {
    return (
      <AppLayout hideNav>
        <PageHeader
          title={t('travel.title') || 'Travel Capsule'}
          eyebrow="AI Packing"
          showBack
        />
        <AnimatedPage className="mx-auto flex max-w-md flex-col gap-5 px-[var(--page-px)] pb-24 pt-4">
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: EASE_CURVE }}
            className="rounded-[1.25rem] p-5"
          >
            <div className="flex items-start gap-4">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-[1rem] bg-secondary/65 text-foreground/70">
                <LockKeyhole className="size-5" />
              </div>
              <div className="space-y-2">
                <p className="label-editorial text-muted-foreground/60">
                  {t('gaps.locked_label') || 'Locked'}
                </p>
                <h2 className="font-display italic text-[1.2rem] font-medium tracking-[-0.02em] text-foreground">
                  {t('capsule.title') || 'Travel Capsule'}
                </h2>
                <p className="max-w-[30rem] text-[0.94rem] leading-6 text-muted-foreground">
                  Unlocks once your wardrobe has enough pieces to build a real packing edit.
                </p>
              </div>
            </div>
            <div className="mt-5 rounded-[1.25rem] p-4">
              <WardrobeProgress message={t('unlock.travel_capsule_message')} compact />
            </div>
          </motion.section>
        </AnimatedPage>
      </AppLayout>
    );
  }

  // ─── Input Wizard ───
  if (!capsule.result) {
    const handleSelectTrip = (trip: TravelCapsuleRow) => {
      capsule.setResult(trip.result);
      capsule.setDestination(trip.destination);

      // Hydrate date range from persisted YYYY-MM-DD values in local time.
      // Parsing date-only strings directly uses UTC and can shift a day for
      // users in negative offsets.
      if (trip.start_date && trip.end_date) {
        capsule.setDateRange({
          from: new Date(`${trip.start_date}T00:00:00`),
          to: new Date(`${trip.end_date}T00:00:00`),
        });
      } else {
        capsule.setDateRange(undefined);
      }

      // destCoords is not persisted — weather strip will be absent for
      // historical trips. Clear any stale coords so we don't mis-attribute.
      capsule.setDestCoords(null);

      // Restore trip preferences with sensible defaults for older rows.
      capsule.setOccasions((trip.occasions ?? []) as OccasionId[]);
      capsule.setLuggageType(
        (trip.luggage_type as LuggageType) || 'carry_on_personal',
      );
      capsule.setCompanions((trip.companions as Companion) || 'solo');
      capsule.setStylePreference(
        (trip.style_preference as StylePreference) || 'balanced',
      );
    };

    return (
      <AppLayout hideNav>
        <AnimatedPage className="page-shell !px-5 !pt-6 page-cluster">
          <PageIntro
            eyebrow={t('travel.eyebrow') || 'Travel capsule'}
            title={t('capsule.title') || 'Travel capsule'}
            description={
              t('travel.intro') ||
              'Plan a trip in two steps — BURS picks the pieces from your wardrobe.'
            }
          />

          {capsule.isGenerating ? (
            <section className="space-y-3">
              <AILoadingCard phases={capsule.travelCardPhases} />
              <p className="text-center text-sm text-muted-foreground">
                {capsule.loadingSteps[capsule.loadingStep]}
              </p>
            </section>
          ) : (
            <>
              <TravelWizard
                destination={capsule.destination}
                setDestination={capsule.setDestination}
                destCoords={capsule.destCoords}
                dateRange={capsule.dateRange}
                setDateRange={capsule.setDateRange}
                dateLocale={capsule.dateLocale}
                dateLabel={capsule.dateLabel}
                tripNights={capsule.tripNights}
                isFetchingWeather={capsule.isFetchingWeather}
                weatherError={capsule.weatherError}
                weatherForecast={capsule.weatherForecast}
                forecastDays={capsule.forecastDays}
                luggageType={capsule.luggageType}
                setLuggageType={capsule.setLuggageType}
                handleLocationSelect={capsule.handleLocationSelect}
                occasions={capsule.occasions}
                setOccasions={capsule.setOccasions}
                companions={capsule.companions}
                setCompanions={capsule.setCompanions}
                stylePreference={capsule.stylePreference}
                setStylePreference={capsule.setStylePreference}
                outfitsPerDay={capsule.outfitsPerDay}
                setOutfitsPerDay={capsule.setOutfitsPerDay}
                mustHaveItems={capsule.mustHaveItems}
                setMustHaveItems={capsule.setMustHaveItems}
                minimizeItems={capsule.minimizeItems}
                setMinimizeItems={capsule.setMinimizeItems}
                allGarments={capsule.allGarments}
                garmentSelection={capsule.garmentSelection}
                setGarmentSelection={capsule.setGarmentSelection}
                onGenerate={capsule.handleGenerate}
                isGenerating={capsule.isGenerating}
              />

              <TripHistoryList
                trips={capsule.savedTrips}
                onSelect={handleSelectTrip}
                onDelete={(id) => { void capsule.removeCapsuleFromDb(id); }}
              />
            </>
          )}
        </AnimatedPage>
      </AppLayout>
    );
  }

  // ─── Results Screen ───
  const packedCount = Object.values(capsule.groupedItems).flat().filter(g => capsule.checkedItems.has(g.id)).length;
  const totalItems = capsule.capsuleItemIds.length;

  return (
    <TravelResultsView
      result={capsule.result}
      destination={capsule.destination}
      vibe={capsule.vibe}
      dateLabel={capsule.dateLabel}
      dateSublabel={capsule.dateSublabel}
      dateRange={capsule.dateRange}
      dateLocale={capsule.dateLocale}
      weatherForecast={capsule.weatherForecast}
      tripDayForecasts={capsule.tripDayForecasts}
      activeTab={capsule.activeTab}
      setActiveTab={capsule.setActiveTab}
      groupedItems={capsule.groupedItems}
      checkedItems={capsule.checkedItems}
      toggleChecked={capsule.toggleChecked}
      itemOutfitCount={capsule.itemOutfitCount}
      capsuleItemIds={capsule.capsuleItemIds}
      garmentMap={capsule.garmentMap}
      allGarmentsMap={capsule.allGarmentsMap}
      totalItems={totalItems}
      packedCount={packedCount}
      isAddingToCalendar={capsule.isAddingToCalendar}
      addedToCalendar={capsule.addedToCalendar}
      handleAddToCalendar={capsule.handleAddToCalendar}
      setResult={capsule.setResult}
      setAddedToCalendar={capsule.setAddedToCalendar}
    />
  );
}
