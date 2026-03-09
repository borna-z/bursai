import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

// In-memory cache for signed URLs with expiration
interface CacheEntry {
  url: string;
  placeholderUrl: string;
  expiresAt: number;
}

const urlCache = new Map<string, CacheEntry>();
const CACHE_DURATION_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Gets a cached signed URL or fetches a new one (with placeholder thumbnail)
 */
export async function getCachedSignedUrl(imagePath: string): Promise<{ url: string; placeholderUrl: string } | null> {
  const cached = urlCache.get(imagePath);
  
  // Return cached URL if still valid
  if (cached && cached.expiresAt > Date.now()) {
    return { url: cached.url, placeholderUrl: cached.placeholderUrl };
  }
  
  try {
    const [mainResult, thumbResult] = await Promise.all([
      supabase.storage
        .from('garments')
        .createSignedUrl(imagePath, 3600),
      supabase.storage
        .from('garments')
        .createSignedUrl(imagePath, 3600, {
          transform: { width: 50, quality: 20 },
        }),
    ]);
    
    if (mainResult.error) throw mainResult.error;
    
    const entry: CacheEntry = {
      url: mainResult.data.signedUrl,
      placeholderUrl: thumbResult.data?.signedUrl || mainResult.data.signedUrl,
      expiresAt: Date.now() + CACHE_DURATION_MS,
    };
    
    urlCache.set(imagePath, entry);
    
    return { url: entry.url, placeholderUrl: entry.placeholderUrl };
  } catch {
    return null;
  }
}

/**
 * Hook to get a signed URL with caching, lazy loading, and retry logic
 */
export function useCachedSignedUrl(imagePath: string | undefined) {
  const [signedUrl, setSignedUrl] = useState<string | null>(() => {
    if (imagePath) {
      const cached = urlCache.get(imagePath);
      if (cached && cached.expiresAt > Date.now()) {
        return cached.url;
      }
    }
    return null;
  });
  const [placeholderUrl, setPlaceholderUrl] = useState<string | null>(() => {
    if (imagePath) {
      const cached = urlCache.get(imagePath);
      if (cached && cached.expiresAt > Date.now()) {
        return cached.placeholderUrl;
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
    
    const result = await getCachedSignedUrl(imagePath);
    
    if (result) {
      setSignedUrl(result.url);
      setPlaceholderUrl(result.placeholderUrl);
      setHasError(false);
      retryCount.current = 0;
    } else if (retryCount.current < 1) {
      retryCount.current++;
      hasStartedFetch.current = false;
      const retryResult = await getCachedSignedUrl(imagePath);
      if (retryResult) {
        setSignedUrl(retryResult.url);
        setPlaceholderUrl(retryResult.placeholderUrl);
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
        setPlaceholderUrl(cached.placeholderUrl);
        hasStartedFetch.current = true;
      } else {
        hasStartedFetch.current = false;
        setSignedUrl(null);
        setPlaceholderUrl(null);
      }
    } else {
      setSignedUrl(null);
      setPlaceholderUrl(null);
      hasStartedFetch.current = false;
    }
  }, [imagePath]);

  // Lazy load with IntersectionObserver
  useEffect(() => {
    const node = elementRef.current;
    if (!imagePath || signedUrl || hasStartedFetch.current || !node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !hasStartedFetch.current) {
          fetchUrl();
          observer.disconnect();
        }
      },
      { rootMargin: '100px', threshold: 0 }
    );

    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, [imagePath, signedUrl, fetchUrl]);

  const setRef = useCallback((node: HTMLDivElement | null) => {
    elementRef.current = node;
    
    // Immediately check visibility when ref is attached - handles items already in viewport
    if (node && imagePath && !hasStartedFetch.current) {
      // Use requestAnimationFrame to ensure layout is complete
      requestAnimationFrame(() => {
        if (hasStartedFetch.current) return;
        const rect = node.getBoundingClientRect();
        const isInViewport = rect.top < window.innerHeight + 100 && rect.bottom > -100;
        if (isInViewport) {
          fetchUrl();
        }
      });
    }
  }, [imagePath, fetchUrl]);

  return { signedUrl, placeholderUrl, isLoading, hasError, setRef, refetch: fetchUrl };
}

/**
 * Batch fetch multiple signed URLs
 */
export async function batchGetSignedUrls(imagePaths: string[]): Promise<Map<string, string>> {
  const results = new Map<string, string>();
  
  await Promise.all(
    imagePaths.map(async (path) => {
      const result = await getCachedSignedUrl(path);
      if (result) {
        results.set(path, result.url);
      }
    })
  );
  
  return results;
}
