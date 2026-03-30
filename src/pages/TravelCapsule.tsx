import { motion } from 'framer-motion';
import { LockKeyhole } from 'lucide-react';
import { useWardrobeUnlocks } from '@/hooks/useWardrobeUnlocks';
import { WardrobeProgress } from '@/components/discover/WardrobeProgress';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { AnimatedPage } from '@/components/ui/animated-page';

import { useLanguage } from '@/contexts/LanguageContext';
import { TravelFormView } from '@/components/travel/TravelFormView';
import { TravelResultsView } from '@/components/travel/TravelResultsView';
import { useTravelCapsule } from '@/components/travel/useTravelCapsule';
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
        <AnimatedPage className="mx-auto flex max-w-md flex-col gap-5 px-5 pb-24 pt-4">
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: EASE_CURVE }}
            className="surface-secondary rounded-[1.25rem] p-5"
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
            <div className="mt-5 rounded-[1.25rem] border border-foreground/[0.06] bg-background/70 p-4">
              <WardrobeProgress message={t('unlock.travel_capsule_message')} compact />
            </div>
          </motion.section>
        </AnimatedPage>
      </AppLayout>
    );
  }

  // ─── Input Form ───
  if (!capsule.result) {
    return (
      <TravelFormView
        destination={capsule.destination}
        setDestination={capsule.setDestination}
        dateRange={capsule.dateRange}
        setDateRange={capsule.setDateRange}
        vibe={capsule.vibe}
        setVibe={capsule.setVibe}
        outfitsPerDay={capsule.outfitsPerDay}
        setOutfitsPerDay={capsule.setOutfitsPerDay}
        mustHaveItems={capsule.mustHaveItems}
        setMustHaveItems={capsule.setMustHaveItems}
        minimizeItems={capsule.minimizeItems}
        setMinimizeItems={capsule.setMinimizeItems}
        includeTravelDays={capsule.includeTravelDays}
        setIncludeTravelDays={capsule.setIncludeTravelDays}
        destCoords={capsule.destCoords}
        showForm={capsule.showForm}
        setShowForm={capsule.setShowForm}
        isFetchingWeather={capsule.isFetchingWeather}
        weatherError={capsule.weatherError}
        weatherForecast={capsule.weatherForecast}
        allGarments={capsule.allGarments}
        savedCapsules={capsule.savedCapsules}
        dateLabel={capsule.dateLabel}
        tripNights={capsule.tripNights}
        tripDays={capsule.tripDays}
        planningLookCount={capsule.planningLookCount}
        dateLocale={capsule.dateLocale}
        handleLocationSelect={capsule.handleLocationSelect}
        handleGenerate={capsule.handleGenerate}
        loadSavedCapsule={capsule.loadSavedCapsule}
        removeSavedCapsule={capsule.removeSavedCapsule}
        isGenerating={capsule.isGenerating}
        loadingStep={capsule.loadingStep}
        loadingSteps={capsule.loadingSteps}
        travelCardPhases={capsule.travelCardPhases}
      />
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
