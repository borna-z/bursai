import { useState, useEffect, useRef, useCallback } from 'react';
import { searchCities, type CitySuggestion } from '@/hooks/useForecast';

interface UseLocationSuggestionsResult {
  suggestions: CitySuggestion[];
  isLoading: boolean;
  clear: () => void;
}

/**
 * Debounced city search hook — queries Nominatim after 300ms of inactivity.
 * Caches results per query string in a simple Map.
 */
export function useLocationSuggestions(query: string): UseLocationSuggestionsResult {
  const [suggestions, setSuggestions] = useState<CitySuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const cache = useRef(new Map<string, CitySuggestion[]>());
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!query || query.length < 2) {
      setSuggestions([]);
      setIsLoading(false);
      return;
    }

    const key = query.toLowerCase().trim();
    if (cache.current.has(key)) {
      setSuggestions(cache.current.get(key)!);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      const results = await searchCities(key);
      cache.current.set(key, results);
      setSuggestions(results);
      setIsLoading(false);
    }, 300);

    return () => clearTimeout(timerRef.current);
  }, [query]);

  const clear = useCallback(() => {
    setSuggestions([]);
    setIsLoading(false);
  }, []);

  return { suggestions, isLoading, clear };
}
