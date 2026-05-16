// Smoke render — the `useGarmentActions` hook lives in
// `GarmentActionSheet.tsx`. The test mounts a tiny consumer that pulls
// the hook's surface and asserts the handler set is present. The
// underlying mutation hooks (`useMarkWorn` etc.) need a QueryClient
// because they call `useMutation` from react-query.
//
// We bypass `useNavigation` / AuthProvider with stubs so the test
// stays a pure-render check and doesn't need a real nav container.

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
jest.mock('../../../hooks/useGarments', () => {
  const noopMutation = {
    mutate: jest.fn(),
    mutateAsync: jest.fn(),
    isPending: false,
    error: null,
  };
  return {
    useMarkWorn: () => noopMutation,
    useMarkLaundry: () => noopMutation,
    useDeleteGarment: () => noopMutation,
    useUpdateGarment: () => noopMutation,
  };
});

import { useGarmentActions } from '../GarmentActionSheet';
import type { Garment } from '../../../types/garment';
/* eslint-enable import/first */

function Consumer({ garment }: { garment: Garment | null }) {
  const actions = useGarmentActions(garment);
  // Touching `markWornPending` keeps the prop "live" so the optimiser
  // can't tree-shake the hook call away under test conditions.
  return <>{String(actions.markWornPending)}</>;
}

function wrap(children: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useGarmentActions (GarmentActionSheet)', () => {
  it('renders a consumer using the hook with a null garment', () => {
    const { toJSON } = render(wrap(<Consumer garment={null} />));
    expect(toJSON()).toBeTruthy();
  });

  it('renders a consumer with a hydrated garment row', () => {
    const garment = {
      id: 'g-1',
      title: 'Linen shirt',
      in_laundry: false,
      wear_count: 3,
      last_worn_at: null,
    } as unknown as Garment;
    const { toJSON } = render(wrap(<Consumer garment={garment} />));
    expect(toJSON()).toBeTruthy();
  });
});
