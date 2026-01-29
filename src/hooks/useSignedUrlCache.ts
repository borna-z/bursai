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
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const retryCount = useRef(0);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const elementRef = useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  // Check cache immediately
  useEffect(() => {
    if (imagePath) {
      const cached = urlCache.get(imagePath);
      if (cached && cached.expiresAt > Date.now()) {
        setSignedUrl(cached.url);
      }
    }
  }, [imagePath]);

  const fetchUrl = useCallback(async () => {
    if (!imagePath) return;
    
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

  // Lazy load with IntersectionObserver
  useEffect(() => {
    if (!imagePath || signedUrl) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setIsVisible(true);
          observerRef.current?.disconnect();
        }
      },
      { rootMargin: '100px' }
    );

    return () => {
      observerRef.current?.disconnect();
    };
  }, [imagePath, signedUrl]);

  // Fetch when visible
  useEffect(() => {
    if (isVisible && imagePath && !signedUrl) {
      fetchUrl();
    }
  }, [isVisible, imagePath, signedUrl, fetchUrl]);

  const setRef = useCallback((node: HTMLDivElement | null) => {
    if (elementRef.current) {
      observerRef.current?.unobserve(elementRef.current);
    }
    
    elementRef.current = node;
    
    if (node && observerRef.current) {
      observerRef.current.observe(node);
    }
  }, []);

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
