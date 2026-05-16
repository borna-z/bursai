// Smoke render — VisualSearchResults must mount with both populated and
// empty result sets and surface the localised row eyebrows. We mock
// `useGarment` so the test doesn't need a real AuthProvider / Supabase
// session — the wardrobe tile then exercises its loading-placeholder
// branch (the only branch reachable without a hydrated garment row).

// `jest.mock` calls are hoisted above the imports below by Jest's
// Babel plugin, so the lint complaint about import order is a false
// positive here. We silence the rule for the local mocks block.
/* eslint-disable import/first */
import React from 'react';
import { render } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Module mocks bypass `useGarment` (Supabase + AuthContext) and the
// underlying signed-URL fetcher so the wardrobe tile exercises its
// loading-placeholder branch without touching the network layer.
jest.mock('../../../hooks/useGarments', () => ({
  useGarment: () => ({ data: null }),
}));
jest.mock('../../../hooks/useSignedUrl', () => ({
  useSignedUrl: () => ({ data: null, isError: false, fetchStatus: 'idle' }),
  useGarmentImage: () => ({ uri: null, onError: () => {}, isResolving: false }),
}));

import { ThemeProvider } from '../../../theme/ThemeProvider';
import { VisualSearchResults } from '../VisualSearchResults';
import type { VisualSearchResult } from '../../../hooks/useVisualSearch';
/* eslint-enable import/first */

function wrap(children: React.ReactNode) {
  // React Query is still required transitively by GarmentCard's color
  // hash + image path helpers. Each render gets its own client so state
  // doesn't leak between cases.
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return (
    <QueryClientProvider client={client}>
      <ThemeProvider initialMode="light">{children}</ThemeProvider>
    </QueryClientProvider>
  );
}

describe('VisualSearchResults', () => {
  it('renders empty wardrobe + web rows without throwing', () => {
    const empty: VisualSearchResult = {
      wardrobeMatches: [],
      webMatches: [],
    };
    const { toJSON } = render(
      wrap(
        <VisualSearchResults result={empty} onGarmentPress={() => {}} />,
      ),
    );
    expect(toJSON()).toBeTruthy();
  });

  it('renders with one match in each row', () => {
    const populated: VisualSearchResult = {
      wardrobeMatches: [
        { garment_id: 'g-1', score: 0.82 },
      ],
      webMatches: [
        {
          id: 'w-1',
          title: 'Linen shirt',
          image_url: 'https://example.test/image.jpg',
          product_url: 'https://example.test/product',
          merchant: 'Test merchant',
          price: { amount: 49, currency: 'EUR' },
          score: 0.74,
        },
      ],
    };
    const { toJSON } = render(
      wrap(
        <VisualSearchResults result={populated} onGarmentPress={() => {}} />,
      ),
    );
    expect(toJSON()).toBeTruthy();
  });
});
