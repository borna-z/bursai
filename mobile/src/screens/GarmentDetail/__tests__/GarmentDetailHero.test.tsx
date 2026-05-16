// Smoke render — GarmentDetailHero mounts across the four badge states
// (rendering / rendered / failed / none). `useSignedUrl` is mocked so
// the inner GarmentImageTile doesn't reach the network.

/* eslint-disable import/first */
import React from 'react';
import { render } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('../../../hooks/useSignedUrl', () => ({
  useSignedUrl: () => ({ data: null, isError: false, fetchStatus: 'idle' }),
  useGarmentImage: () => ({ uri: null, onError: () => {}, isResolving: false }),
}));

import { ThemeProvider } from '../../../theme/ThemeProvider';
import { GarmentDetailHero } from '../GarmentDetailHero';
import type { Garment } from '../../../types/garment';
/* eslint-enable import/first */

function wrap(children: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={client}>
      <ThemeProvider initialMode="light">{children}</ThemeProvider>
    </QueryClientProvider>
  );
}

const baseGarment = {
  id: 'g-1',
  title: 'Cream linen shirt',
  wear_count: 7,
  category: 'Tops',
  rendered_image_path: null,
  original_image_path: null,
  image_path: null,
  render_status: 'none',
} as unknown as Garment;

describe('GarmentDetailHero', () => {
  it.each(['rendering', 'rendered', 'failed', 'none'] as const)(
    'renders the %s badge state without throwing',
    (badge) => {
      const { toJSON } = render(wrap(<GarmentDetailHero garment={baseGarment} badge={badge} />));
      expect(toJSON()).toBeTruthy();
    },
  );
});
