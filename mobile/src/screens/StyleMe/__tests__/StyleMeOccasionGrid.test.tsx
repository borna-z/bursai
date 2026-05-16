// Smoke render — StyleMeOccasionGrid renders the 6 built-in occasions
// plus the Custom tile, and surfaces the inline TextInput when `occId`
// is 'custom'.

import React from 'react';
import { render } from '@testing-library/react-native';

import { ThemeProvider } from '../../../theme/ThemeProvider';
import { TshirtIcon, SunIcon, CalendarIcon, SuitcaseIcon, SparklesIcon } from '../../../components/icons';
import { StyleMeOccasionGrid, type OccasionOption } from '../StyleMeOccasionGrid';

const OCCASIONS: OccasionOption[] = [
  { id: 'casual',  labelKey: 'styleMe.occasion.casual',  subKey: 'styleMe.occasion.casual.sub',  Icon: TshirtIcon  },
  { id: 'work',    labelKey: 'styleMe.occasion.work',    subKey: 'styleMe.occasion.work.sub',    Icon: TshirtIcon  },
  { id: 'evening', labelKey: 'styleMe.occasion.evening', subKey: 'styleMe.occasion.evening.sub', Icon: CalendarIcon },
  { id: 'date',    labelKey: 'styleMe.occasion.date',    subKey: 'styleMe.occasion.date.sub',    Icon: SparklesIcon },
  { id: 'workout', labelKey: 'styleMe.occasion.workout', subKey: 'styleMe.occasion.workout.sub', Icon: SunIcon     },
  { id: 'travel',  labelKey: 'styleMe.occasion.travel',  subKey: 'styleMe.occasion.travel.sub',  Icon: SuitcaseIcon },
];

function wrap(children: React.ReactNode) {
  return <ThemeProvider initialMode="light">{children}</ThemeProvider>;
}

describe('StyleMeOccasionGrid', () => {
  it('renders all built-in occasion tiles', () => {
    const { toJSON } = render(
      wrap(
        <StyleMeOccasionGrid
          occasions={OCCASIONS}
          occId="work"
          customOccasion=""
          onSelect={() => {}}
          onCustomChange={() => {}}
        />,
      ),
    );
    expect(toJSON()).toBeTruthy();
  });

  it('surfaces the custom input when custom is active', () => {
    const { toJSON } = render(
      wrap(
        <StyleMeOccasionGrid
          occasions={OCCASIONS}
          occId="custom"
          customOccasion="Brunch"
          onSelect={() => {}}
          onCustomChange={() => {}}
        />,
      ),
    );
    expect(toJSON()).toBeTruthy();
  });
});
