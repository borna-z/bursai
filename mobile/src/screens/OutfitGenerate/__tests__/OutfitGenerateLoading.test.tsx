// Smoke render — verifies OutfitGenerateLoading mounts inside a
// ThemeProvider with both loading and post-loading prop states. We don't
// drive Animated values directly; the Animated APIs run under jest-expo
// without throwing, and the assertion is that the rendered tree contains
// the cycling-message text and the close affordance label.

import React from 'react';
import { render } from '@testing-library/react-native';

import { ThemeProvider } from '../../../theme/ThemeProvider';
import { OutfitGenerateLoading } from '../OutfitGenerateLoading';

describe('OutfitGenerateLoading', () => {
  it('renders the loading shell with the first cycling message', () => {
    const { getByText, getByLabelText } = render(
      <ThemeProvider initialMode="light">
        <OutfitGenerateLoading isLoading onClose={() => {}} />
      </ThemeProvider>,
    );
    // Initial LOADING_MESSAGES[0] is "Reading your wardrobe…".
    expect(getByText('Reading your wardrobe…')).toBeTruthy();
    // Close button exposes its label via accessibilityLabel.
    expect(getByLabelText('Close')).toBeTruthy();
  });

  it('renders the same shell when loading flips false', () => {
    // Post-loading shell stays mounted only briefly while progress snaps
    // to 100% — the parent unmounts it the same tick. The render is
    // still legal and must not throw.
    const { toJSON } = render(
      <ThemeProvider initialMode="light">
        <OutfitGenerateLoading isLoading={false} onClose={() => {}} />
      </ThemeProvider>,
    );
    expect(toJSON()).toBeTruthy();
  });
});
