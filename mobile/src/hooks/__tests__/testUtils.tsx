// Test wrapper helpers — N4.
//
// Every hook test that touches React Query needs a fresh QueryClient
// (otherwise stale cache entries leak between cases). The default
// `retry: false` means a queryFn that throws fails the test loudly
// instead of silently retrying with backoff. `gcTime: 0` ensures
// inactive queries are GCed immediately so a renderHook teardown
// doesn't keep a Promise alive into the next case.

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

export function makeWrapper(): React.FC<{ children: React.ReactNode }> {
  const qc = makeQueryClient();
  // eslint-disable-next-line react/display-name
  return ({ children }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}
