// OccasionPicker — horizontal occasion-pill row on HomeScreen (M35).
//
// Lets the user nudge `useSmartDayRecommendation`'s context manually when no
// calendar event is in scope (M36 lands calendar sync). Each pill emits a
// synthetic `DayEventInput` whose title contains a keyword from
// `dayIntelligence.OCCASION_RULES`, so the existing classifier picks the
// right occasion + formality without OccasionPicker needing to know the
// numeric formality grades. The "Casual" pill resets to no synthetic event,
// letting the engine fall back to its default casual baseline.

import React from 'react';
import { ScrollView, View } from 'react-native';

import { Chip } from './Chip';
import type { DayEventInput } from '../lib/dayIntelligence';
import { t } from '../lib/i18n';

/** Stable identifier for the active selection. `'casual'` means "no override". */
export type OccasionId = 'casual' | 'work' | 'party' | 'workout' | 'dinner';

interface OccasionOption {
  id: OccasionId;
  /** i18n key for the visible pill label. */
  labelKey: string;
  /** Synthetic event title — must contain a keyword from `OCCASION_RULES`
   *  so the day-intelligence classifier returns the matching occasion. */
  syntheticTitle: string | null;
}

const OPTIONS: OccasionOption[] = [
  { id: 'casual', labelKey: 'home.occasion.casual', syntheticTitle: null },
  { id: 'work', labelKey: 'home.occasion.work', syntheticTitle: 'Office meeting' },
  { id: 'party', labelKey: 'home.occasion.party', syntheticTitle: 'Party celebration' },
  { id: 'workout', labelKey: 'home.occasion.workout', syntheticTitle: 'Gym workout' },
  { id: 'dinner', labelKey: 'home.occasion.dinner', syntheticTitle: 'Dinner reservation' },
];

/** Convert a chosen `OccasionId` into the events array consumed by
 *  `useSmartDayRecommendation`. Exported so HomeScreen can build the
 *  override object without re-deriving the synthetic-event mapping. */
export function eventsForOccasion(id: OccasionId): DayEventInput[] {
  const opt = OPTIONS.find((o) => o.id === id);
  if (!opt?.syntheticTitle) return [];
  return [{ title: opt.syntheticTitle }];
}

export interface OccasionPickerProps {
  selected: OccasionId;
  onSelect: (id: OccasionId) => void;
}

export function OccasionPicker({ selected, onSelect }: OccasionPickerProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8, paddingRight: 4 }}>
      {OPTIONS.map((opt) => (
        <View key={opt.id}>
          <Chip
            label={t(opt.labelKey)}
            active={opt.id === selected}
            onPress={() => onSelect(opt.id)}
          />
        </View>
      ))}
    </ScrollView>
  );
}
