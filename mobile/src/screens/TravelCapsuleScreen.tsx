// Travel Capsule — Step 1 of 4. Destination + dates + trip type + weather context.
// Mirrors design_handoff_burs_rn/source/extra-screens.jsx TravelCapsuleScreen step 0.
//
// Builds the trip brief that's threaded through Steps 2 (TravelMustHaves) and 3
// (TravelPackingList) via route params.

import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTokens } from '../theme/ThemeProvider';
import { fonts, radii } from '../theme/tokens';
import { Eyebrow } from '../components/Eyebrow';
import { PageTitle } from '../components/PageTitle';
import { Caption } from '../components/Caption';
import { Button } from '../components/Button';
import { Chip } from '../components/Chip';
import { IconBtn } from '../components/IconBtn';
import { Card } from '../components/Card';
import { BackIcon, CalendarIcon, SunIcon } from '../components/icons';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const RECENT_DESTINATIONS = ['Lisbon', 'Tokyo', 'New York', 'Copenhagen', 'Marrakesh'];
const TRIP_TYPES = ['Business', 'Leisure', 'Beach', 'City', 'Outdoor', 'Winter'] as const;

type TripType = (typeof TRIP_TYPES)[number];

// Strict YYYY-MM-DD parser. `Date.parse` interprets ISO date strings as UTC, but the user
// types local-calendar dates — and Hermes returns NaN inconsistently for non-ISO forms
// (e.g. "5/12/2026"). Parse via explicit components and treat both endpoints as the same
// timezone, returning the night-count.
//
// Returns null on missing or malformed input; returns 0 for same-day (day trip).
// Codex audit P1.1 + P1.2.
const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseISODate(value: string): Date | null {
  const match = ISO_DATE_RE.exec(value.trim());
  if (!match) return null;
  const [, y, m, d] = match;
  const year = Number(y);
  const month = Number(m);
  const day = Number(d);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return new Date(year, month - 1, day);
}

function nightsBetween(from: string, to: string): number | null {
  if (!from || !to) return null;
  const a = parseISODate(from);
  const b = parseISODate(to);
  if (!a || !b || b.getTime() < a.getTime()) return null;
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

export function TravelCapsuleScreen() {
  const t = useTokens();
  const nav = useNavigation<Nav>();

  const [destination, setDestination] = React.useState('');
  const [fromDate, setFromDate] = React.useState('');
  const [toDate, setToDate] = React.useState('');
  const [tripTypes, setTripTypes] = React.useState<TripType[]>(['City']);

  const nights = nightsBetween(fromDate, toDate);
  const canContinue = destination.trim().length > 0 && tripTypes.length > 0;

  const toggleTripType = (type: TripType) =>
    setTripTypes((prev) => (prev.includes(type) ? prev.filter((x) => x !== type) : [...prev, type]));

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 130, gap: 18 }}
          keyboardShouldPersistTaps="handled">
          {/* ============ HEADER ============ */}
          <View style={s.headerRow}>
            <IconBtn ariaLabel="Back" onPress={() => nav.goBack()} variant="ghost">
              <BackIcon color={t.fg} />
            </IconBtn>
            <View style={{ flex: 1 }}>
              <Eyebrow style={{ marginBottom: 4 }}>Pack smart</Eyebrow>
              <PageTitle>Travel Capsule</PageTitle>
            </View>
          </View>

          {/* ============ STEP INDICATOR ============ */}
          {/* Wizard has 3 stops (this + must-haves + packing list). Codex audit P2.7. */}
          <View style={[s.stepChip, { backgroundColor: t.accentSoft }]}>
            <Text style={{ fontFamily: fonts.uiSemi, fontSize: 10, letterSpacing: 1.6, textTransform: 'uppercase', color: t.accent }}>
              Step 1 of 3
            </Text>
          </View>

          {/* ============ DESTINATION ============ */}
          <View style={{ gap: 10 }}>
            <Eyebrow>Destination</Eyebrow>
            <View style={[s.input, { backgroundColor: t.bg2, borderColor: t.border }]}>
              <TextInput
                value={destination}
                onChangeText={setDestination}
                placeholder="Where are you going?"
                placeholderTextColor={t.fg3}
                style={{ flex: 1, color: t.fg, fontFamily: fonts.uiMed, fontSize: 14, padding: 0 }}
                returnKeyType="next"
              />
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 6, paddingVertical: 2 }}>
              {RECENT_DESTINATIONS.map((city) => (
                <Chip
                  key={city}
                  label={city}
                  active={destination === city}
                  onPress={() => setDestination(city)}
                />
              ))}
            </ScrollView>
          </View>

          {/* ============ DATE RANGE ============ */}
          <View style={{ gap: 10 }}>
            <Eyebrow>Dates</Eyebrow>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={[s.dateInput, { backgroundColor: t.bg2, borderColor: t.border }]}>
                <TextInput
                  value={fromDate}
                  onChangeText={setFromDate}
                  placeholder="From (YYYY-MM-DD)"
                  placeholderTextColor={t.fg3}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={{ flex: 1, color: t.fg, fontFamily: fonts.uiMed, fontSize: 13, padding: 0 }}
                />
                <CalendarIcon color={t.fg2} />
              </View>
              <View style={[s.dateInput, { backgroundColor: t.bg2, borderColor: t.border }]}>
                <TextInput
                  value={toDate}
                  onChangeText={setToDate}
                  placeholder="To (YYYY-MM-DD)"
                  placeholderTextColor={t.fg3}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={{ flex: 1, color: t.fg, fontFamily: fonts.uiMed, fontSize: 13, padding: 0 }}
                />
                <CalendarIcon color={t.fg2} />
              </View>
            </View>
            {/* Day-trip (0 nights) gets distinct copy; otherwise show pluralised night count.
                Codex audit P1.2. */}
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
                  active={tripTypes.includes(type)}
                  onPress={() => toggleTripType(type)}
                />
              ))}
            </View>
            <Caption>Multi-select. Shapes what we recommend packing.</Caption>
          </View>

          {/* ============ WEATHER CONTEXT ============ */}
          <Card padding={16}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
              <Eyebrow>Expected weather</Eyebrow>
              <SunIcon color={t.accent} />
            </View>
            <Text
              style={{
                fontFamily: fonts.displayMedium,
                fontStyle: 'italic',
                fontSize: 28,
                lineHeight: 30,
                fontWeight: '500',
                color: t.fg,
                letterSpacing: -0.28,
                marginTop: 2,
              }}>
              {destination.trim() ? '18–24°' : '—'}
            </Text>
            <Caption style={{ marginTop: 6 }}>
              {destination.trim()
                ? 'Mostly sunny · 1 day rain · light layers in the evening.'
                : 'Pick a destination to see the forecast.'}
            </Caption>
          </Card>

          {/* ============ CTA ============ */}
          <Button
            label="Build my capsule"
            variant="accent"
            block
            disabled={!canContinue}
            onPress={() => nav.navigate('TravelMustHaves')}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingTop: 4 },
  stepChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.pill,
  },
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
