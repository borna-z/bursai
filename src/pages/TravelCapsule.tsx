import { useNavigate } from 'react-router-dom';
import { useWardrobeUnlocks } from '@/hooks/useWardrobeUnlocks';
import { WardrobeProgress } from '@/components/discover/WardrobeProgress';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { AnimatedPage } from '@/components/ui/animated-page';
import { PageIntro } from '@/components/ui/page-intro';
import { useLanguage } from '@/contexts/LanguageContext';
import { TravelFormView } from '@/components/travel/TravelFormView';
import { TravelResultsView } from '@/components/travel/TravelResultsView';
import { useTravelCapsule } from '@/components/travel/useTravelCapsule';

export default function TravelCapsule() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { isUnlocked } = useWardrobeUnlocks();
  const capsule = useTravelCapsule();

  // Gate: require enough garments
  if (!isUnlocked('travel_capsule')) {
    return (
      <AppLayout hideNav>
        <PageHeader
          title={t('capsule.title')}
          subtitle="Unlocks once your wardrobe has enough pieces to build a real packing edit."
          showBack
        />
        <AnimatedPage className="page-shell !px-5 !pt-6 page-cluster">
          <PageIntro
            eyebrow="Planner"
            title={t('capsule.title')}
            description={t('unlock.travel_capsule_message')}
          />
          <WardrobeProgress message={t('unlock.travel_capsule_message')} />
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
