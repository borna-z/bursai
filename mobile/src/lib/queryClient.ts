// Single React Query client for the mobile app. Mirrors the web's defaults
// loosely — staleTime 2 min keeps the wardrobe responsive to mutations
// without re-hitting Supabase on every screen focus, and exponential
// backoff on retry covers the common flaky-network case where the app is
// resumed from background mid-fetch.
//
// The client is a module-level singleton so QueryClientProvider re-mounts
// (e.g. on theme change) reuse the same cache. App.tsx wires it up.

import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,
      retry: 2,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30000),
    },
  },
});
