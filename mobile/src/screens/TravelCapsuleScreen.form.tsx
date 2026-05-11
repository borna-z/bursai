// TravelCapsuleScreen — form sub-step (destination + dates + trip-type +
// occasions + CTA). N13 split.
//
// State lives in the parent; this file is presentational + plumbs back
// the destination input change and chip taps via callbacks.

import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { useTokens } from '../theme/ThemeProvider';
import { fonts, radii } from '../theme/tokens';
import { Eyebrow } from '../components/Eyebrow';
import { Caption } from '../components/Caption';
import { Button } from '../components/Button';
import { Chip } from '../components/Chip';
import { CalendarIcon } from '../components/icons';
import { t as tr } from '../lib/i18n';
import {
  OCCASION_IDS,
  POPULAR_DESTINATIONS,
  TRIP_TYPES,
  shortDateLabel,
  type OccasionId,
  type TripType,
} from './TravelCapsuleScreen.helpers';

export type TravelCapsuleFormProps = {
  destination: string;
  onDestinationChange: (v: string) => void;
  fromDate: string;
  toDate: string;
  nights: number | null;
  onPickFromDate: () => void;
  onPickToDate: () => void;
  tripType: TripType;
  onSelectTripType: (type: TripType) => void;
  occasions: OccasionId[];
  onToggleOccasion: (id: OccasionId) => void;
  canContinue: boolean;
  isPending: boolean;
  onGenerate: () => void;
};

export function TravelCapsuleForm({
  destination,
  onDestinationChange,
  fromDate,
  toDate,
  nights,
  onPickFromDate,
  onPickToDate,
  tripType,
  onSelectTripType,
  occasions,
  onToggleOccasion,
  canContinue,
  isPending,
  onGenerate,
}: TravelCapsuleFormProps) {
  const t = useTokens();
  return (
    <>
      {/* ============ DESTINATION ============ */}
      <View style={{ gap: 10 }}>
        <Eyebrow>Destination</Eyebrow>
        <View style={[s.input, { backgroundColor: t.bg2, borderColor: t.border }]}>
          <TextInput
            value={destination}
            onChangeText={onDestinationChange}
            placeholder="Where are you going?"
            placeholderTextColor={t.fg3}
            style={{ flex: 1, color: t.fg, fontFamily: fonts.uiMed, fontSize: 14, padding: 0 }}
            returnKeyType="next"
            editable={!isPending}
          />
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 6, paddingVertical: 2 }}>
          {POPULAR_DESTINATIONS.map((city) => (
            <Chip
              key={city}
              label={city}
              active={destination === city}
              onPress={() => onDestinationChange(city)}
            />
          ))}
        </ScrollView>
      </View>

      {/* ============ DATE RANGE ============ */}
      <View style={{ gap: 10 }}>
        <Eyebrow>Dates</Eyebrow>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable
            onPress={onPickFromDate}
            accessibilityRole="button"
            accessibilityLabel="Pick start date"
            style={[s.dateInput, { backgroundColor: t.bg2, borderColor: t.border }]}>
            <Text
              numberOfLines={1}
              style={{
                flex: 1,
                color: fromDate ? t.fg : t.fg3,
                fontFamily: fonts.uiMed,
                fontSize: 13,
              }}>
              {fromDate ? shortDateLabel(fromDate) : 'From'}
            </Text>
            <CalendarIcon color={t.fg2} />
          </Pressable>
          <Pressable
            onPress={onPickToDate}
            accessibilityRole="button"
            accessibilityLabel="Pick end date"
            style={[s.dateInput, { backgroundColor: t.bg2, borderColor: t.border }]}>
            <Text
              numberOfLines={1}
              style={{
                flex: 1,
                color: toDate ? t.fg : t.fg3,
                fontFamily: fonts.uiMed,
                fontSize: 13,
              }}>
              {toDate ? shortDateLabel(toDate) : 'To'}
            </Text>
            <CalendarIcon color={t.fg2} />
          </Pressable>
        </View>
        {/* Day-trip (0 nights) gets distinct copy; otherwise show pluralised
            night count. Codex audit P1.2. */}
        {nights != null ? (
          <Eyebrow style={{ color: t.accent, opacity: 1 }}>
            {nights === 0 ? 'Day trip' : nights === 1 ? '1 night' : `${nights} nights`}
          </Eyebrow>
        ) : null}
      </View>

      {/* ============ TRIP TYPE ============ */}
      <View style={{ gap: 10 }}>
        <Eyebrow>Trip type</Eyebrow>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {TRIP_TYPES.map((type) => (
            <Chip
              key={type}
              label={type}
              active={tripType === type}
              onPress={() => onSelectTripType(type)}
            />
          ))}
        </View>
        <Caption>Pick one. Shapes what we recommend packing.</Caption>
      </View>

      {/* ============ OCCASIONS (multi-select) ============ */}
      {/* G3 sub-issue 3 — multi-select chip grid mirroring web's
          TravelStep2 occasions panel. Pipes into the edge function's
          `occasions: string[]` input so the AI distributes outfits
          across the actual trip flavours. */}
      <View style={{ gap: 10 }}>
        <Eyebrow>{tr('travel.occasions.title')}</Eyebrow>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {OCCASION_IDS.map((id) => (
            <Chip
              key={id}
              label={tr(`travel.occasions.${id}`)}
              active={occasions.includes(id)}
              onPress={() => onToggleOccasion(id)}
            />
          ))}
        </View>
      </View>

      {/* ============ CTA ============ */}
      <Button
        label="Build my capsule"
        variant="accent"
        block
        disabled={!canContinue}
        accessibilityState={{ disabled: !canContinue, busy: isPending }}
        onPress={onGenerate}
      />
    </>
  );
}

const s = StyleSheet.create({
  input: {
    height: 48,
    borderRadius: radii.lg,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateInput: {
    flex: 1,
    height: 44,
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
