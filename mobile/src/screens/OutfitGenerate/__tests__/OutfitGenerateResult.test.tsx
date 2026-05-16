// Smoke render — OutfitGenerateResult mounts across the three branches
// it owns (anchor-miss empty / itemCount===0 empty / normal result).
// We mock `useSignedUrl` so the GarmentImageTile children don't reach the
// network for signed-URL resolution.

/* eslint-disable import/first */
import React from 'react';
import { render } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';

jest.mock('../../../hooks/useSignedUrl', () => ({
  useSignedUrl: () => ({ data: null, isError: false, fetchStatus: 'idle' }),
  useGarmentImage: () => ({ uri: null, onError: () => {}, isResolving: false }),
}));

import { ThemeProvider } from '../../../theme/ThemeProvider';
import { OutfitGenerateResult } from '../OutfitGenerateResult';
/* eslint-enable import/first */

const safeAreaInitialMetrics = {
  frame: { x: 0, y: 0, width: 320, height: 640 },
  insets: { top: 0, bottom: 0, left: 0, right: 0 },
};

function wrap(children: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return (
    <SafeAreaProvider initialMetrics={safeAreaInitialMetrics}>
      <QueryClientProvider client={client}>
        <ThemeProvider initialMode="light">{children}</ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

const baseProps = {
  anchorId: undefined,
  anchorMissed: false,
  anchorGarmentTitle: null,
  itemCount: 3,
  outfitName: 'Late summer ease',
  description: 'A breezy combo.',
  occasion: 'Casual',
  formality: 'Baseline',
  subLine: '3 PIECES · LATE SUMMER',
  items: [
    { garment_id: 'g-1', slot: 'TOP' },
    { garment_id: 'g-2', slot: 'BOTTOM' },
    { garment_id: 'g-3', slot: 'SHOES' },
  ],
  previewGarmentBySlot: new Map(),
  persistableItemsCount: 3,
  persistPending: false,
  wearPending: false,
  savedOutfitId: null,
  onTryAgain: () => {},
  onRemoveAnchor: () => {},
  onWear: () => {},
  onPlan: () => {},
  onSave: () => {},
  onGeneratePool: () => {},
};

describe('OutfitGenerateResult', () => {
  it('renders the normal result branch', () => {
    const { toJSON } = render(wrap(<OutfitGenerateResult {...baseProps} />));
    expect(toJSON()).toBeTruthy();
  });

  it('renders the anchor-miss empty branch', () => {
    const { toJSON } = render(
      wrap(
        <OutfitGenerateResult
          {...baseProps}
          anchorId="anchor-1"
          anchorMissed
          anchorGarmentTitle="Cream linen shirt"
          itemCount={0}
        />,
      ),
    );
    expect(toJSON()).toBeTruthy();
  });

  it('renders the no-items empty branch', () => {
    const { getByText } = render(
      wrap(<OutfitGenerateResult {...baseProps} itemCount={0} />),
    );
    expect(getByText('No matching pieces')).toBeTruthy();
  });
});
