// Smoke render — the three context-row sub-components mount cleanly
// inside a ThemeProvider with representative props.

import React from 'react';
import { render } from '@testing-library/react-native';

import { ThemeProvider } from '../../../theme/ThemeProvider';
import {
  StyleMeWeatherRow,
  StyleMeAnchorRow,
  StyleMeFormalityRow,
} from '../StyleMeContextRows';

function wrap(children: React.ReactNode) {
  return <ThemeProvider initialMode="light">{children}</ThemeProvider>;
}

describe('StyleMeContextRows', () => {
  it('renders the weather row', () => {
    const { getByText } = render(
      wrap(<StyleMeWeatherRow weatherLine="14° · Clear" onAdjustPress={() => {}} />),
    );
    expect(getByText('14° · Clear')).toBeTruthy();
  });

  it('renders the anchor row in empty + filled states', () => {
    const empty = render(
      wrap(
        <StyleMeAnchorRow
          anchorIds={[]}
          anchorTitle={null}
          onClear={() => {}}
          onOpen={() => {}}
        />,
      ),
    );
    expect(empty.toJSON()).toBeTruthy();

    const filled = render(
      wrap(
        <StyleMeAnchorRow
          anchorIds={['g-1']}
          anchorTitle="Cream linen shirt"
          onClear={() => {}}
          onOpen={() => {}}
        />,
      ),
    );
    expect(filled.getByText('Cream linen shirt')).toBeTruthy();
  });

  it('renders the formality row with active selection', () => {
    const { toJSON } = render(
      wrap(
        <StyleMeFormalityRow<'a' | 'b'>
          keys={['a', 'b']}
          active="a"
          onSelect={() => {}}
        />,
      ),
    );
    expect(toJSON()).toBeTruthy();
  });
});
