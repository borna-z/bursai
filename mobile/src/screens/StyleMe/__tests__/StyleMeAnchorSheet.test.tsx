// Smoke render — StyleMeAnchorSheet mounts in both open and closed
// states. `useNavigation` is stubbed (TravelGarmentPicker reaches for it
// internally) and signed-URL hydration is bypassed.

/* eslint-disable import/first */
import React from 'react';
import { render } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('@react-navigation/native', () => {
  const real = jest.requireActual('@react-navigation/native');
  return {
    ...real,
    useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() }),
  };
});
jest.mock('../../../hooks/useSignedUrl', () => ({
  useSignedUrl: () => ({ data: null, isError: false, fetchStatus: 'idle' }),
  useGarmentImage: () => ({ uri: null, onError: () => {}, isResolving: false }),
}));

import { ThemeProvider } from '../../../theme/ThemeProvider';
import { StyleMeAnchorSheet } from '../StyleMeAnchorSheet';
/* eslint-enable import/first */

function wrap(children: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={client}>
      <ThemeProvider initialMode="light">{children}</ThemeProvider>
    </QueryClientProvider>
  );
}

describe('StyleMeAnchorSheet', () => {
  it('renders closed without throwing', () => {
    const result = render(
      wrap(
        <StyleMeAnchorSheet
          isOpen={false}
          onClose={() => {}}
          garments={[]}
          loading={false}
          selectedIds={[]}
          onChange={() => {}}
        />,
      ),
    );
    // Modal renders null when hidden; the render call itself must not throw.
    expect(result).toBeTruthy();
  });

  it('renders open with an empty garment list', () => {
    const { toJSON } = render(
      wrap(
        <StyleMeAnchorSheet
          isOpen
          onClose={() => {}}
          garments={[]}
          loading={false}
          selectedIds={[]}
          onChange={() => {}}
        />,
      ),
    );
    expect(toJSON()).toBeTruthy();
  });
});
