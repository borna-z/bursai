import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

// In-memory cache for signed URLs with expiration
interface CacheEntry {
  url: string;
  expiresAt: number;
}

const urlCache = new Map<string, CacheEntry>();
const CACHE_DURATION_MS = 10 * 60 * 1000; // 10 minutes

// Batch queue: collects paths to sign in a single request
let batchQueue: { path: string; resolve: (url: string | null) => void }[] = [];
let batchTimer: ReturnType<typeof setTimeout> | null = null;
const BATCH_DELAY_MS = 50; // Collect requests for 50ms then fire one batch

function flushBatch() {
  batchTimer = null;
  const queue = batchQueue;
  batchQueue = [];

  if (queue.length === 0) return;

  // Deduplicate
  const uniquePaths = [...new Set(queue.map((q) => q.path))];

  supabase.storage
    .from('garments')
    .createSignedUrls(uniquePaths, 3600)
    .then(({ data, error }) => {
      if (error || !data) {
        queue.forEach((q) => q.resolve(null));
        return;
      }

      const urlMap = new Map<string, string>();
      for (const item of data) {
        if (item.signedUrl && item.path) {
          urlMap.set(item.path, item.signedUrl);
          urlCache.set(item.path, {
            url: item.signedUrl,
            expiresAt: Date.now() + CACHE_DURATION_MS,
          });
        }
      }

      queue.forEach((q) => q.resolve(urlMap.get(q.path) || null));
    })
    .catch(() => {
      queue.forEach((q) => q.resolve(null));
    });
}

/**
 * Gets a cached signed URL or queues it for batch fetching
 */
export async function getCachedSignedUrl(imagePath: string): Promise<{ url: string } | null> {
  const cached = urlCache.get(imagePath);
  if (cached && cached.expiresAt > Date.now()) {
    return { url: cached.url };
  }

  return new Promise((resolve) => {
    batchQueue.push({ path: imagePath, resolve: (url) => resolve(url ? { url } : null) });
    if (!batchTimer) {
      batchTimer = setTimeout(flushBatch, BATCH_DELAY_MS);
    }
  });
}

/**
 * Hook to get a signed URL with caching, lazy loading, and batch fetching
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
      setHasError(false);
      retryCount.current = 0;
    } else if (retryCount.current < 1) {
      retryCount.current++;
      hasStartedFetch.current = false;
      const retryResult = await getCachedSignedUrl(imagePath);
      if (retryResult) {
        setSignedUrl(retryResult.url);
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
    const node = elementRef.current;
    if (!imagePath || signedUrl || hasStartedFetch.current || !node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !hasStartedFetch.current) {
          fetchUrl();
          observer.disconnect();
        }
      },
      { rootMargin: '200px', threshold: 0 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [imagePath, signedUrl, fetchUrl]);

  const setRef = useCallback((node: HTMLDivElement | null) => {
    elementRef.current = node;

    if (node && imagePath && !hasStartedFetch.current) {
      requestAnimationFrame(() => {
        if (hasStartedFetch.current) return;
        const rect = node.getBoundingClientRect();
        const isInViewport = rect.top < window.innerHeight + 200 && rect.bottom > -200;
        if (isInViewport) {
          fetchUrl();
        }
      });
    }
  }, [imagePath, fetchUrl]);

  // Backwards compat: placeholderUrl is null (we use CSS shimmer now)
  return { signedUrl, placeholderUrl: null as string | null, isLoading, hasError, setRef, refetch: fetchUrl };
}

/**
 * Batch fetch multiple signed URLs (for pre-warming)
 */
export async function batchGetSignedUrls(imagePaths: string[]): Promise<Map<string, string>> {
  const results = new Map<string, string>();
  const uncached: string[] = [];

  for (const path of imagePaths) {
    const cached = urlCache.get(path);
    if (cached && cached.expiresAt > Date.now()) {
      results.set(path, cached.url);
    } else {
      uncached.push(path);
    }
  }

  if (uncached.length > 0) {
    const { data } = await supabase.storage.from('garments').createSignedUrls(uncached, 3600);
    if (data) {
      for (const item of data) {
        if (item.signedUrl && item.path) {
          results.set(item.path, item.signedUrl);
          urlCache.set(item.path, {
            url: item.signedUrl,
            expiresAt: Date.now() + CACHE_DURATION_MS,
          });
        }
      }
    }
  }

  return results;
}
