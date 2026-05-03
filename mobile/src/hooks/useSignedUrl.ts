// Signed-URL hooks for the private `garments` bucket. Mirrors the web's
// pattern (src/hooks/useStorage.ts: 1-hour TTL via createSignedUrl).
//
// Storage bucket is `garments` — same bucket the web app uploads into and
// the same one the smoke tests assert against. Don't change the name without
// updating server-side RLS + bucket policies.
//
// staleTime is just under the URL TTL so React Query refreshes the URL one
// cache-cycle before it expires. The query key includes the path so two
// images with the same path share a cache entry; different paths get
// independent entries.

import { useQuery } from '@tanstack/react-query';

import { supabase } from '../lib/supabase';

const BUCKET = 'garments';
const EXPIRES_IN_SECONDS = 60 * 60; // 1 hour
const STALE_MS = 1000 * 60 * 50; // refresh 10 min before expiry

export function useSignedUrl(path: string | null | undefined) {
  return useQuery({
    queryKey: ['signed-url', path],
    queryFn: async () => {
      if (!path) return null;
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(path, EXPIRES_IN_SECONDS);
      // Treat a missing-object / expired-token error as a soft null rather
      // than throwing — the consumer renders a placeholder gradient when
      // the URL isn't available, no point bubbling a render error.
      if (error) return null;
      return data?.signedUrl ?? null;
    },
    enabled: !!path,
    staleTime: STALE_MS,
  });
}

/**
 * Bulk variant for screens that show many garment images at once. Uses the
 * batch endpoint (`createSignedUrls`) when paths are present — single
 * round-trip instead of N. Returns a `path → url|null` map.
 */
export function useSignedUrls(paths: (string | null | undefined)[]) {
  // Stable cache key so identical path lists hit the same query entry across
  // re-renders. Sorted to be order-insensitive.
  const validPaths = paths.filter((p): p is string => Boolean(p));
  const sorted = [...validPaths].sort();

  return useQuery({
    queryKey: ['signed-urls', sorted],
    queryFn: async () => {
      if (sorted.length === 0) return {} as Record<string, string | null>;
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .createSignedUrls(sorted, EXPIRES_IN_SECONDS);
      if (error || !data) {
        return Object.fromEntries(sorted.map((p) => [p, null])) as Record<string, string | null>;
      }
      const out: Record<string, string | null> = {};
      for (const entry of data) {
        out[entry.path ?? ''] = entry.signedUrl ?? null;
      }
      return out;
    },
    enabled: sorted.length > 0,
    staleTime: STALE_MS,
  });
}
