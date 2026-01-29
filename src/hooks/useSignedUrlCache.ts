import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

// In-memory cache for signed URLs with expiration
interface CacheEntry {
  url: string;
  expiresAt: number;
}

const urlCache = new Map<string, CacheEntry>();
const CACHE_DURATION_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Gets a cached signed URL or fetches a new one
 */
export async function getCachedSignedUrl(imagePath: string): Promise<string | null> {
  const cached = urlCache.get(imagePath);
  
  // Return cached URL if still valid
  if (cached && cached.expiresAt > Date.now()) {
    return cached.url;
  }
  
  try {
    const { data, error } = await supabase.storage
      .from('garments')
      .createSignedUrl(imagePath, 3600); // 1 hour
    
    if (error) throw error;
    
    // Cache the URL
    urlCache.set(imagePath, {
      url: data.signedUrl,
      expiresAt: Date.now() + CACHE_DURATION_MS,
    });
    
    return data.signedUrl;
  } catch {
    return null;
  }
}

/**
 * Hook to get a signed URL with caching, lazy loading, and retry logic
 */
export function useCachedSignedUrl(imagePath: string | undefined) {
  const [signedUrl, setSignedUrl] = useState<string | null>(() => {
    // Check cache immediately on mount
    if (imagePath) {
      const cached = urlCache.get(imagePath);
      if (cached && cached.expiresAt > Date.now()) {
        return cached.url;
      }
    }
    return null;
  });
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const retryCount = useRef(0);
  const elementRef = useRef<HTMLDivElement | null>(null);
  const hasStartedFetch = useRef(false);

  const fetchUrl = useCallback(async () => {
    if (!imagePath || hasStartedFetch.current) return;
    
    hasStartedFetch.current = true;
    setIsLoading(true);
    setHasError(false);
    
    const url = await getCachedSignedUrl(imagePath);
    
    if (url) {
      setSignedUrl(url);
      setHasError(false);
      retryCount.current = 0;
    } else if (retryCount.current < 1) {
      // Retry once
      retryCount.current++;
      hasStartedFetch.current = false;
      const retryUrl = await getCachedSignedUrl(imagePath);
      if (retryUrl) {
        setSignedUrl(retryUrl);
        setHasError(false);
      } else {
        setHasError(true);
      }
    } else {
      setHasError(true);
    }
    
    setIsLoading(false);
  }, [imagePath]);

  // Reset when imagePath changes
  useEffect(() => {
    if (imagePath) {
      const cached = urlCache.get(imagePath);
      if (cached && cached.expiresAt > Date.now()) {
        setSignedUrl(cached.url);
        hasStartedFetch.current = true;
      } else {
        hasStartedFetch.current = false;
        setSignedUrl(null);
      }
    } else {
      setSignedUrl(null);
      hasStartedFetch.current = false;
    }
  }, [imagePath]);

  // Lazy load with IntersectionObserver
  useEffect(() => {
    if (!imagePath || signedUrl || !elementRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          fetchUrl();
          observer.disconnect();
        }
      },
      { rootMargin: '100px' }
    );

    observer.observe(elementRef.current);

    return () => {
      observer.disconnect();
    };
  }, [imagePath, signedUrl, fetchUrl]);

  const setRef = useCallback((node: HTMLDivElement | null) => {
    elementRef.current = node;
    
    // If element is already in view and we haven't fetched yet, fetch immediately
    if (node && imagePath && !signedUrl && !hasStartedFetch.current) {
      const rect = node.getBoundingClientRect();
      const isInViewport = rect.top < window.innerHeight + 100 && rect.bottom > -100;
      if (isInViewport) {
        fetchUrl();
      }
    }
  }, [imagePath, signedUrl, fetchUrl]);

  return { signedUrl, isLoading, hasError, setRef, refetch: fetchUrl };
}

/**
 * Batch fetch multiple signed URLs
 */
export async function batchGetSignedUrls(imagePaths: string[]): Promise<Map<string, string>> {
  const results = new Map<string, string>();
  
  await Promise.all(
    imagePaths.map(async (path) => {
      const url = await getCachedSignedUrl(path);
      if (url) {
        results.set(path, url);
      }
    })
  );
  
  return results;
}
