import { useState, useEffect, useRef, useCallback } from 'react';
import { searchCities, type CitySuggestion } from '@/hooks/useForecast';
import { logger } from '@/lib/logger';

interface UseLocationSuggestionsResult {
  suggestions: CitySuggestion[];
  isLoading: boolean;
  error: string | null;
  hasSearched: boolean;
  clear: () => void;
}

/**
 * Debounced city search hook — queries Nominatim after 300ms of inactivity.
 * Caches results per query string in a simple Map.
 */
export function useLocationSuggestions(query: string): UseLocationSuggestionsResult {
  const [suggestions, setSuggestions] = useState<CitySuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const cache = useRef(new Map<string, CitySuggestion[]>());
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const skipRef = useRef(false);

  useEffect(() => {
    if (skipRef.current) {
      skipRef.current = false;
      return;
    }

    if (!query || query.length < 2) {
      setSuggestions([]);
      setIsLoading(false);
      setError(null);
      setHasSearched(false);
      return;
    }

    const key = query.toLowerCase().trim();
    if (cache.current.has(key)) {
      setSuggestions(cache.current.get(key)!);
      setIsLoading(false);
      setError(null);
      setHasSearched(true);
      return;
    }

    setIsLoading(true);
    setError(null);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      try {
        const results = await searchCities(key);
        cache.current.set(key, results);
        setSuggestions(results);
        setError(null);
      } catch (err) {
        logger.error('[useLocationSuggestions] search failed:', err);
        setSuggestions([]);
        setError('Could not search cities. Check your connection.');
      } finally {
        setIsLoading(false);
        setHasSearched(true);
      }
    }, 300);

    return () => clearTimeout(timerRef.current);
  }, [query]);

  const clear = useCallback(() => {
    skipRef.current = true;
    setSuggestions([]);
    setIsLoading(false);
    setError(null);
    setHasSearched(false);
  }, []);

  return { suggestions, isLoading, error, hasSearched, clear };
}
