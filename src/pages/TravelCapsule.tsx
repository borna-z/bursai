import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useWardrobeUnlocks } from '@/hooks/useWardrobeUnlocks';
import { WardrobeProgress } from '@/components/discover/WardrobeProgress';
import { AppLayout } from '@/components/layout/AppLayout';
import { AnimatedPage } from '@/components/ui/animated-page';
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
        <AnimatedPage className="px-5 pb-8 pt-12 max-w-lg mx-auto space-y-6">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-xl hover:bg-muted/30 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-semibold">{t('capsule.title')}</h1>
            </div>
          </div>
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
        durationDays={capsule.durationDays}
        setDurationDays={capsule.setDurationDays}
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
