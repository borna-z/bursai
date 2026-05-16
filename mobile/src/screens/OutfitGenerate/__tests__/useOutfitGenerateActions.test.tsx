// Smoke render — `useOutfitGenerateActions` is consumed by a tiny test
// component so the hook's mutation hooks register against a real
// QueryClient. The underlying mutations are stubbed via `useOutfits`
// so no network or auth surface is touched.

/* eslint-disable import/first */
import React from 'react';
import { render } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('../../../hooks/useOutfits', () => {
  const noopMutation = {
    mutate: jest.fn(),
    mutateAsync: jest.fn(),
    isPending: false,
    error: null,
  };
  return {
    usePersistGeneratedOutfit: () => noopMutation,
    useMarkOutfitWorn: () => noopMutation,
  };
});

import { Text } from 'react-native';
import { useOutfitGenerateActions } from '../useOutfitGenerateActions';
/* eslint-enable import/first */

function Probe() {
  const actions = useOutfitGenerateActions({
    nav: { navigate: jest.fn(), goBack: jest.fn() } as never,
    result: { outfit_name: 'Late summer ease' } as never,
    persistableItems: [{ garment_id: 'g-1', slot: 'TOP' }],
    savedOutfitId: null,
    setSavedOutfitId: () => {},
    preselectDate: undefined,
    markSucceeded: () => {},
  });
  const ready =
    typeof actions.handleSave === 'function' &&
    typeof actions.handlePlan === 'function' &&
    typeof actions.handleWear === 'function';
  return <Text>{ready ? 'ready' : 'missing'}</Text>;
}

describe('useOutfitGenerateActions', () => {
  it('mounts and exposes the handler set', () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { getByText } = render(
      <QueryClientProvider client={client}>
        <Probe />
      </QueryClientProvider>,
    );
    expect(getByText('ready')).toBeTruthy();
  });
});
