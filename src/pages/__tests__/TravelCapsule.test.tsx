import type { PropsWithChildren } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const isUnlockedMock = vi.fn();
const useTravelCapsuleMock = vi.fn();

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: (k: string) => k, locale: 'en' }),
}));

vi.mock('@/hooks/useWardrobeUnlocks', () => ({
  useWardrobeUnlocks: () => ({ isUnlocked: isUnlockedMock }),
}));

vi.mock('@/components/travel/useTravelCapsule', () => ({
  useTravelCapsule: () => useTravelCapsuleMock(),
}));

vi.mock('@/components/travel/TravelWizard', () => ({
  TravelWizard: ({ onGenerate }: { onGenerate: () => void }) => (
    <div data-testid="form-view">
      <button onClick={onGenerate}>Generate</button>
    </div>
  ),
}));

vi.mock('@/components/travel/TripHistoryList', () => ({
  TripHistoryList: () => <div data-testid="trip-history" />,
}));

vi.mock('@/components/ui/AILoadingCard', () => ({
  AILoadingCard: () => <div data-testid="ai-loading" />,
}));

vi.mock('@/components/ui/page-intro', () => ({
  PageIntro: ({ title }: { title: string }) => <div>{title}</div>,
}));

vi.mock('@/components/travel/TravelResultsView', () => ({
  TravelResultsView: ({ destination }: { destination: string }) => (
    <div data-testid="results-view">Results for {destination}</div>
  ),
}));

vi.mock('@/components/layout/AppLayout', () => ({
  AppLayout: ({ children }: PropsWithChildren) => <div>{children}</div>,
}));

vi.mock('@/components/layout/PageHeader', () => ({
  PageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}));

vi.mock('@/components/ui/animated-page', () => ({
  AnimatedPage: ({ children, className }: PropsWithChildren<{ className?: string }>) => (
    <div className={className}>{children}</div>
  ),
}));

vi.mock('@/components/discover/WardrobeProgress', () => ({
  WardrobeProgress: () => <div data-testid="wardrobe-progress">progress</div>,
}));

import TravelCapsule from '../TravelCapsule';

function buildCapsule(overrides: Record<string, unknown> = {}) {
  return {
    destination: 'Tokyo',
    setDestination: vi.fn(),
    dateRange: null,
    setDateRange: vi.fn(),
    vibe: 'minimal',
    setVibe: vi.fn(),
    outfitsPerDay: 1,
    setOutfitsPerDay: vi.fn(),
    mustHaveItems: [],
    setMustHaveItems: vi.fn(),
    minimizeItems: false,
    setMinimizeItems: vi.fn(),
    includeTravelDays: false,
    setIncludeTravelDays: vi.fn(),
    destCoords: null,
    showForm: true,
    setShowForm: vi.fn(),
    isFetchingWeather: false,
    weatherError: null,
    weatherForecast: null,
    allGarments: [],
    savedCapsules: [],
    dateLabel: '',
    dateSublabel: '',
    tripNights: 0,
    tripDays: 0,
    planningLookCount: 0,
    dateLocale: null,
    handleLocationSelect: vi.fn(),
    handleGenerate: vi.fn(),
    loadSavedCapsule: vi.fn(),
    removeSavedCapsule: vi.fn(),
    isGenerating: false,
    loadingStep: 0,
    loadingSteps: [],
    travelCardPhases: [],
    result: null,
    groupedItems: {},
    checkedItems: new Set<string>(),
    capsuleItemIds: [],
    toggleChecked: vi.fn(),
    itemOutfitCount: {},
    garmentMap: new Map(),
    allGarmentsMap: new Map(),
    isAddingToCalendar: false,
    addedToCalendar: false,
    handleAddToCalendar: vi.fn(),
    setResult: vi.fn(),
    setAddedToCalendar: vi.fn(),
    activeTab: 'outfits',
    setActiveTab: vi.fn(),
    tripDayForecasts: [],
    forecastDays: [],
    luggageType: 'carry_on_personal',
    setLuggageType: vi.fn(),
    companions: 'solo',
    setCompanions: vi.fn(),
    stylePreference: 'balanced',
    setStylePreference: vi.fn(),
    occasions: [],
    setOccasions: vi.fn(),
    savedTrips: [],
    removeCapsuleFromDb: vi.fn(),
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/plan/travel-capsule']}>
      <TravelCapsule />
    </MemoryRouter>,
  );
}

describe('TravelCapsule page', () => {
  beforeEach(() => {
    isUnlockedMock.mockReset();
    useTravelCapsuleMock.mockReset();
  });

  it('shows the wardrobe unlock gate when locked', () => {
    isUnlockedMock.mockReturnValue(false);
    useTravelCapsuleMock.mockReturnValue(buildCapsule());
    renderPage();
    expect(screen.getByTestId('wardrobe-progress')).toBeInTheDocument();
    expect(screen.queryByTestId('form-view')).not.toBeInTheDocument();
  });

  it('renders the form view when unlocked and no result yet', () => {
    isUnlockedMock.mockReturnValue(true);
    useTravelCapsuleMock.mockReturnValue(buildCapsule({ result: null }));
    renderPage();
    expect(screen.getByTestId('form-view')).toBeInTheDocument();
    expect(screen.queryByTestId('results-view')).not.toBeInTheDocument();
  });

  it('renders the results view when capsule result is present', () => {
    isUnlockedMock.mockReturnValue(true);
    useTravelCapsuleMock.mockReturnValue(
      buildCapsule({ result: { outfits: [] }, destination: 'Paris' }),
    );
    renderPage();
    expect(screen.getByTestId('results-view')).toBeInTheDocument();
    expect(screen.getByText(/Paris/)).toBeInTheDocument();
  });

  it('invokes handleGenerate when the form fires the action', () => {
    isUnlockedMock.mockReturnValue(true);
    const handleGenerate = vi.fn();
    useTravelCapsuleMock.mockReturnValue(buildCapsule({ handleGenerate }));
    renderPage();
    screen.getByRole('button', { name: /generate/i }).click();
    expect(handleGenerate).toHaveBeenCalled();
  });
});
