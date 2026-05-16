// Smoke render — both the paywall variant and the generic error variant
// of the OutfitGenerate error shell mount without throwing inside a
// ThemeProvider.

import React from 'react';
import { render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ThemeProvider } from '../../../theme/ThemeProvider';
import {
  OutfitGeneratePaywallShell,
  OutfitGenerateErrorShell,
} from '../OutfitGenerateErrorShell';

const safeAreaInitialMetrics = {
  frame: { x: 0, y: 0, width: 320, height: 640 },
  insets: { top: 0, bottom: 0, left: 0, right: 0 },
};

function wrap(children: React.ReactNode) {
  return (
    <SafeAreaProvider initialMetrics={safeAreaInitialMetrics}>
      <ThemeProvider initialMode="light">{children}</ThemeProvider>
    </SafeAreaProvider>
  );
}

describe('OutfitGeneratePaywallShell', () => {
  it('renders the paywall messaging', () => {
    const { getByText } = render(
      wrap(<OutfitGeneratePaywallShell onClose={() => {}} onBack={() => {}} />),
    );
    expect(getByText('Outfit generation is part of BURS Premium')).toBeTruthy();
  });
});

describe('OutfitGenerateErrorShell', () => {
  it('renders eyebrow + error body without the remove-anchor CTA', () => {
    const { getByText, queryByText } = render(
      wrap(
        <OutfitGenerateErrorShell
          onClose={() => {}}
          eyebrow="Generation failed"
          title="Couldn't build your outfit"
          body="The engine errored — try again."
          onRetry={() => {}}
          showRemoveAnchor={false}
          onRemoveAnchor={() => {}}
        />,
      ),
    );
    expect(getByText('Generation failed')).toBeTruthy();
    expect(getByText("Couldn't build your outfit")).toBeTruthy();
    expect(queryByText('Remove anchor')).toBeNull();
  });

  it('renders with the remove-anchor CTA when an anchor is active', () => {
    const { toJSON } = render(
      wrap(
        <OutfitGenerateErrorShell
          onClose={() => {}}
          eyebrow="Anchor missed"
          title="That piece didn't make it"
          body="Try without an anchor."
          onRetry={() => {}}
          showRemoveAnchor
          onRemoveAnchor={() => {}}
        />,
      ),
    );
    expect(toJSON()).toBeTruthy();
  });
});
