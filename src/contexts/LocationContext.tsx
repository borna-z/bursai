import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { useProfile, useUpdateProfile } from '@/hooks/useProfile';

interface LocationContextValue {
  /** The city to use everywhere — either from DB or auto-detected */
  effectiveCity: string | null;
  /** 'manual' if user set it, 'auto' if geolocation/default */
  locationSource: 'manual' | 'auto';
  /** Save a city to profile.home_city — locks it until changed */
  setManualCity: (city: string) => void;
  /** Clear home_city — go back to auto-detect */
  clearManualCity: () => void;
  isLoading: boolean;
}

const LocationContext = createContext<LocationContextValue | null>(null);

// eslint-disable-next-line react-refresh/only-export-components
export function useLocation() {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error('useLocation must be used inside LocationProvider');
  return ctx;
}

export function LocationProvider({ children }: { children: ReactNode }) {
  const { data: profile, isLoading: profileLoading } = useProfile();
  const updateProfile = useUpdateProfile();

  // Local state mirrors profile.home_city for instant UI
  const [localCity, setLocalCity] = useState<string | null>(null);
  const [source, setSource] = useState<'manual' | 'auto'>('auto');

  // Sync from profile when it loads
  useEffect(() => {
    if (!profile) return;
    if (profile.home_city) {
      setLocalCity(profile.home_city);
      setSource('manual');
    } else {
      setLocalCity(null);
      setSource('auto');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.home_city]);

  const setManualCity = useCallback((city: string) => {
    const trimmed = city.trim();
    if (!trimmed) return;
    setLocalCity(trimmed);
    setSource('manual');
    updateProfile.mutate({ home_city: trimmed });
  }, [updateProfile]);

  const clearManualCity = useCallback(() => {
    setLocalCity(null);
    setSource('auto');
    updateProfile.mutate({ home_city: null });
  }, [updateProfile]);

  return (
    <LocationContext.Provider
      value={{
        effectiveCity: localCity,
        locationSource: source,
        setManualCity,
        clearManualCity,
        isLoading: profileLoading,
      }}
    >
      {children}
    </LocationContext.Provider>
  );
}
