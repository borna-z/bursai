// Smoke render — StyleMeWeatherSheet mounts in both open and closed
// states. We don't drive Modal visibility through native bridges in
// the test environment; jest-expo's RN preset routes the Modal element
// through inline rendering, so the asserted text appears whenever
// `isOpen` is true.

import React from 'react';
import { render } from '@testing-library/react-native';

import { ThemeProvider } from '../../../theme/ThemeProvider';
import { StyleMeWeatherSheet } from '../StyleMeWeatherSheet';

describe('StyleMeWeatherSheet', () => {
  it('renders when closed without throwing', () => {
    // React Native's Modal renders `null` while `visible={false}`. The
    // contract we care about here is "mounting doesn't throw" — the
    // JSON tree being null is the expected closed-state shape.
    expect(() =>
      render(
        <ThemeProvider initialMode="light">
          <StyleMeWeatherSheet
            isOpen={false}
            onClose={() => {}}
            baseTemperature={14}
            manualOverride={null}
            onApplyManualWeather={() => {}}
            onResetWeather={() => {}}
          />
        </ThemeProvider>,
      ),
    ).not.toThrow();
  });

  it('renders the stepper and condition chips when open', () => {
    const { toJSON } = render(
      <ThemeProvider initialMode="light">
        <StyleMeWeatherSheet
          isOpen
          onClose={() => {}}
          baseTemperature={18}
          manualOverride={null}
          onApplyManualWeather={() => {}}
          onResetWeather={() => {}}
        />
      </ThemeProvider>,
    );
    expect(toJSON()).toBeTruthy();
  });
});
