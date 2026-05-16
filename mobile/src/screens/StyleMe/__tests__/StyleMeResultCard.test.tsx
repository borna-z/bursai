// Smoke render — StyleMeResultCard mounts in all three branches:
//   • itemCount === 0 → empty state.
//   • Preview (savedOutfitId === null).
//   • Saved (savedOutfitId set).
//
// We mock the OutfitCard's image hook so the tile doesn't reach into the
// network / Auth layer for signed-URL resolution.

/* eslint-disable import/first */
import React from 'react';
import { render } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('../../../hooks/useSignedUrl', () => ({
  useSignedUrl: () => ({ data: null, isError: false, fetchStatus: 'idle' }),
  useGarmentImage: () => ({ uri: null, onError: () => {}, isResolving: false }),
}));

import { ThemeProvider } from '../../../theme/ThemeProvider';
import { StyleMeResultCard } from '../StyleMeResultCard';
/* eslint-enable import/first */

function wrap(children: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return (
    <QueryClientProvider client={client}>
      <ThemeProvider initialMode="light">{children}</ThemeProvider>
    </QueryClientProvider>
  );
}

describe('StyleMeResultCard', () => {
  it('renders the empty branch when itemCount === 0', () => {
    const { getByText } = render(
      wrap(
        <StyleMeResultCard
          name="Late summer ease"
          description={null}
          subLine=""
          garments={[]}
          itemCount={0}
          savedOutfitId={null}
          onSave={() => {}}
          onOpenSavedDetail={() => {}}
          onRestyle={() => {}}
        />,
      ),
    );
    expect(getByText('No matching pieces')).toBeTruthy();
  });

  it('renders the preview branch with a non-empty roster', () => {
    const { toJSON } = render(
      wrap(
        <StyleMeResultCard
          name="Late summer ease"
          description="A breezy linen + denim combo for the warm afternoon."
          subLine="CASUAL · 3 PIECES"
          garments={[
            { id: 'g-1', rendered_image_path: null, original_image_path: null },
            { id: 'g-2', rendered_image_path: null, original_image_path: null },
            { id: 'g-3', rendered_image_path: null, original_image_path: null },
          ]}
          itemCount={3}
          savedOutfitId={null}
          onSave={() => {}}
          onOpenSavedDetail={() => {}}
          onRestyle={() => {}}
        />,
      ),
    );
    expect(toJSON()).toBeTruthy();
  });

  it('renders the saved branch when savedOutfitId is set', () => {
    const { toJSON } = render(
      wrap(
        <StyleMeResultCard
          name="Late summer ease"
          description={null}
          subLine="CASUAL · 3 PIECES"
          garments={[
            { id: 'g-1', rendered_image_path: null, original_image_path: null },
          ]}
          itemCount={1}
          savedOutfitId="outfit-123"
          onSave={() => {}}
          onOpenSavedDetail={() => {}}
          onRestyle={() => {}}
        />,
      ),
    );
    expect(toJSON()).toBeTruthy();
  });
});
