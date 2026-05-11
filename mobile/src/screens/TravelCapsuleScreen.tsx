// Travel Capsule — Step 1 of 3. Destination + dates + trip type + saved
// capsules list. Mirrors design_handoff_burs_rn/source/extra-screens.jsx
// TravelCapsuleScreen step 0.
//
// M28 wired the wizard to real data:
//   • saved capsules render from `useTravelCapsules()` and tap-to-open
//     into TravelPackingList with the row's `capsuleId`;
//   • New trip CTA collects destination + date range + trip-type; tapping
//     "Build my capsule" calls `useGenerateTravelCapsule()` which posts
//     to the `travel_capsule` edge function (~30s on first run) and
//     INSERTs the row server-side. On success the user lands on
//     TravelMustHaves with the new row's id.
//
// N13 split — pure helpers + sibling sub-components live in:
//   TravelCapsuleScreen.helpers.ts, .savedRow.tsx, .datePicker.tsx, .form.tsx
// This file is the orchestrator: wizard state + generation mutation +
// layout.

import React from 'react';
import { ActivityIndicator, Alert, FlatList, ScrollView, StyleSheet, Text, View, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTokens } from '../theme/ThemeProvider';
import { fonts, radii } from '../theme/tokens';
import { Eyebrow } from '../components/Eyebrow';
import { PageTitle } from '../components/PageTitle';
import { Caption } from '../components/Caption';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { IconBtn } from '../components/IconBtn';
import { BackIcon } from '../components/icons';
import { t as tr } from '../lib/i18n';
import {
  useTravelCapsules,
  useDeleteTravelCapsule,
  type TravelCapsuleRow,
} from '../hooks/useTravelCapsules';
import {
  useGenerateTravelCapsule,
  TRAVEL_CAPSULE_SUBSCRIPTION_SENTINEL,
} from '../hooks/useGenerateTravelCapsule';
import { useFlatGarments } from '../hooks/useGarments';
import { TravelGarmentPicker } from '../components/TravelGarmentPicker';
import type { RootStackParamList } from '../navigation/RootNavigator';

import {
  DATE_PRESETS,
  PICKER_MAX,
  TRIP_TYPE_TO_BACKEND,
  nightsBetween,
  offsetISO,
  type OccasionId,
  type TripType,
  type WizardSubStep,
} from './TravelCapsuleScreen.helpers';
import { SavedCapsuleRow } from './TravelCapsuleScreen.savedRow';
import { DatePickerSheet } from './TravelCapsuleScreen.datePicker';
import { TravelCapsuleForm } from './TravelCapsuleScreen.form';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function TravelCapsuleScreen() {
  const t = useTokens();
  const nav = useNavigation<Nav>();

  const [subStep, setSubStep] = React.useState<WizardSubStep>('picker');
  const [mustHaveItemIds, setMustHaveItemIds] = React.useState<string[]>([]);

  const [destination, setDestination] = React.useState('');
  const [fromDate, setFromDate] = React.useState('');
  const [toDate, setToDate] = React.useState('');
  // Single-select — the edge function only accepts one `trip_type` and
  // we used to send the first chip + spread the rest as occasions, which
  // hid the multi-select effect from the user. Match web's parity by
  // restricting to one chip at a time.
  const [tripType, setTripType] = React.useState<TripType>('City');
  // G3 sub-issue 3 — multi-select Occasions, separate from trip-type.
  // Trip type is the single-select shape descriptor the edge function
  // routes on; occasions are the per-day flavour the AI uses when
  // assigning outfit slots. Empty array is allowed — falls back to a
  // trip-type-derived default at submit time.
  const [occasions, setOccasions] = React.useState<OccasionId[]>([]);
  // Which date pill, if any, is showing the custom-date sheet. `null` = sheet closed.
  const [customPickerFor, setCustomPickerFor] = React.useState<'from' | 'to' | null>(null);

  const { data: savedCapsules = [], isLoading: capsulesLoading } = useTravelCapsules();
  const deleteCapsule = useDeleteTravelCapsule();
  const generate = useGenerateTravelCapsule();

  // Wardrobe — the picker reads from the same flat garments query the
  // wardrobe surface uses. `enabled` is the substep gate: only fetch on
  // entry to the picker, freeing the form sub-step from a cold-cache hit.
  // React Query dedupes if Wardrobe was visited earlier in the session.
  const garmentsQuery = useFlatGarments(undefined, subStep === 'picker');
  const allGarments = garmentsQuery.data;

  const nights = nightsBetween(fromDate, toDate);
  const canContinue =
    destination.trim().length > 0 &&
    !!tripType &&
    !!fromDate &&
    !!toDate &&
    nights !== null &&
    !generate.isPending;

  // Single-select — tapping a chip selects only it, deselecting the rest.
  const selectTripType = (type: TripType) => setTripType(type);

  // Multi-select Occasions — toggle behaviour matches web TravelStep2.
  const toggleOccasion = React.useCallback((id: OccasionId) => {
    setOccasions((prev) =>
      prev.includes(id) ? prev.filter((o) => o !== id) : [...prev, id],
    );
  }, []);

  // Preset-pill date chooser. The first 5 buttons are quick offsets; the 6th ("Custom")
  // opens an inline mini-calendar sheet so the user can pick any specific date directly.
  // Avoids dragging in @react-native-community/datetimepicker.
  const openDatePicker = React.useCallback((which: 'from' | 'to') => {
    const buttons: { text: string; onPress?: () => void; style?: 'cancel' }[] = DATE_PRESETS.map(
      ({ label, daysFromToday }) => ({
        text: label,
        onPress: () => {
          const iso = offsetISO(daysFromToday);
          if (which === 'from') setFromDate(iso);
          else setToDate(iso);
        },
      }),
    );
    buttons.push({
      text: 'Custom…',
      onPress: () => setCustomPickerFor(which),
    });
    buttons.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert(which === 'from' ? 'Start date' : 'End date', undefined, buttons);
  }, []);

  const onCustomConfirm = React.useCallback(
    (iso: string) => {
      if (customPickerFor === 'from') setFromDate(iso);
      else if (customPickerFor === 'to') setToDate(iso);
      setCustomPickerFor(null);
    },
    [customPickerFor],
  );

  // Tap a saved trip → land on packing list with its capsuleId. The
  // packing-list screen reads everything else off the row.
  const handleOpenSaved = React.useCallback(
    (row: TravelCapsuleRow) => {
      nav.navigate('TravelPackingList', { capsuleId: row.id });
    },
    [nav],
  );

  const handleDeleteSaved = React.useCallback(
    (row: TravelCapsuleRow) => {
      Alert.alert(
        tr('travelCapsule.delete.confirmTitle'),
        tr('travelCapsule.delete.confirmBody', { destination: row.destination }),
        [
          { text: tr('travelCapsule.delete.confirmCancel'), style: 'cancel' },
          {
            text: tr('travelCapsule.delete.confirmConfirm'),
            style: 'destructive',
            onPress: () => {
              deleteCapsule.mutate(row.id, {
                onError: () => {
                  Alert.alert(
                    tr('travelCapsule.savedTripDeletedTitle'),
                    tr('travelCapsule.savedTripDeleteFailed'),
                  );
                },
              });
            },
          },
        ],
      );
    },
    [deleteCapsule],
  );

  // "Build my capsule" — kick off generation, navigate on success.
  // Generation is slow (~30s) so the screen renders the full-bleed
  // loading state below instead of trapping the CTA in a spinner.
  const handleGenerate = React.useCallback(() => {
    if (!canContinue) return;
    const backendTripType = TRIP_TYPE_TO_BACKEND[tripType];
    // G3 sub-issue 3 — wire the multi-select Occasions chips through.
    // Empty selection falls back to the trip-type seed (legacy behaviour
    // pre-G3) so existing flows that never tap an occasion chip still
    // produce sensible per-day routing on the edge function.
    const submitOccasions: string[] =
      occasions.length > 0 ? [...occasions] : [backendTripType];

    // Build the picker-garment snapshot for the hook — just the fields
    // `seedMustHaves` needs to hydrate the must_haves rows. Filtered to
    // the actually-selected ids so we don't ship the entire wardrobe in
    // the mutation payload.
    const selectedSet = new Set(mustHaveItemIds);
    const mustHaveGarments = (allGarments ?? [])
      .filter((g) => selectedSet.has(g.id))
      .map((g) => ({
        id: g.id,
        title: g.title ?? null,
        category: g.category ?? null,
        // Prefer the rendered ghost-mannequin path (matches GarmentCard's
        // image fallback chain) so the must-have row eventually shows the
        // user-facing showpiece rather than the raw original.
        image_path: g.rendered_image_path ?? g.original_image_path ?? null,
      }));

    generate.mutate(
      {
        destination: destination.trim(),
        dates: { start: fromDate, end: toDate },
        occasions: submitOccasions,
        weather: null,
        tripType: backendTripType,
        mustHaveItemIds,
        mustHaveGarments,
      },
      {
        onSuccess: ({ capsule_id }) => {
          nav.navigate('TravelMustHaves', { capsuleId: capsule_id });
        },
        onError: (err) => {
          if (err.message === TRAVEL_CAPSULE_SUBSCRIPTION_SENTINEL) {
            Alert.alert(
              tr('travelCapsule.subscriptionRequired.title'),
              tr('travelCapsule.subscriptionRequired.body'),
            );
            return;
          }
          // Edge function throws "Need at least 5 garments to build a
          // capsule" when wardrobe is too sparse — surface that with a
          // friendlier copy.
          if (/at least 5 garments/i.test(err.message)) {
            Alert.alert(
              tr('travelCapsule.notEnoughGarmentsTitle'),
              tr('travelCapsule.notEnoughGarmentsBody'),
            );
            return;
          }
          Alert.alert(
            tr('travelCapsule.generateFailed.title'),
            tr('travelCapsule.generateFailed.body'),
          );
        },
      },
    );
  }, [
    canContinue,
    destination,
    fromDate,
    toDate,
    tripType,
    occasions,
    generate,
    nav,
    mustHaveItemIds,
    allGarments,
  ]);

  // Picker-step CTA. Empty selection allowed — mirrors web's "skip" path
  // where the user lets the AI pick everything. The label changes based
  // on whether the user has tapped any tile.
  const handlePickerContinue = React.useCallback(() => {
    setSubStep('form');
  }, []);

  // Tapping the back affordance from the form step rewinds to the picker.
  // System back button is handled separately by the navigator (goBack
  // pops the screen) — the in-screen back arrow only rewinds within the
  // wizard.
  const handleFormBack = React.useCallback(() => {
    setSubStep('picker');
  }, []);

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 130, gap: 18 }}
          keyboardShouldPersistTaps="handled">
          {/* ============ HEADER ============ */}
          {/* The in-screen back arrow rewinds within the wizard when on
              the form sub-step; on the picker sub-step it pops the
              navigator (the picker is the wizard's entry point). */}
          <View style={s.headerRow}>
            <IconBtn
              ariaLabel="Back"
              onPress={subStep === 'form' ? handleFormBack : () => nav.goBack()}
              variant="ghost">
              <BackIcon color={t.fg} />
            </IconBtn>
            <View style={{ flex: 1 }}>
              <Eyebrow style={{ marginBottom: 4 }}>Pack smart</Eyebrow>
              <PageTitle>Travel Capsule</PageTitle>
            </View>
          </View>

          {/* ============ STEP INDICATOR ============ */}
          <View style={[s.stepChip, { backgroundColor: t.accentSoft }]}>
            <Text style={{ fontFamily: fonts.uiSemi, fontSize: 10, letterSpacing: 1.6, textTransform: 'uppercase', color: t.accent }}>
              {tr('travelCapsule.pickerStep.eyebrow')}
            </Text>
          </View>

          {/* ============ GENERATING OVERLAY ============ */}
          {generate.isPending ? (
            <Card padding={20}>
              <View style={{ alignItems: 'center', gap: 14 }}>
                <ActivityIndicator color={t.accent} />
                <Eyebrow>{tr('travelCapsule.generating')}</Eyebrow>
                <Caption style={{ textAlign: 'center', maxWidth: 280 }}>
                  {tr('travelCapsule.generatingBody')}
                </Caption>
              </View>
            </Card>
          ) : null}

          {/* ============ PICKER SUB-STEP ============ */}
          {subStep === 'picker' ? (
            <View style={{ gap: 14 }}>
              <View style={{ gap: 6 }}>
                <PageTitle>{tr('travelCapsule.pickerStep.title')}</PageTitle>
                <Caption>{tr('travelCapsule.pickerStep.intro')}</Caption>
              </View>
              <TravelGarmentPicker
                garments={allGarments ?? []}
                selectedIds={mustHaveItemIds}
                onChange={setMustHaveItemIds}
                max={PICKER_MAX}
                loading={garmentsQuery.isLoading}
              />
              <Button
                label={
                  mustHaveItemIds.length === 0
                    ? tr('travelCapsule.pickerStep.continueWithoutPicks')
                    : tr('travelCapsule.pickerStep.continueWithPicks')
                }
                variant="accent"
                block
                onPress={handlePickerContinue}
              />
            </View>
          ) : null}

          {/* ============ FORM SUB-STEP ============ */}
          {subStep === 'form' ? (
            <TravelCapsuleForm
              destination={destination}
              onDestinationChange={setDestination}
              fromDate={fromDate}
              toDate={toDate}
              nights={nights}
              onPickFromDate={() => openDatePicker('from')}
              onPickToDate={() => openDatePicker('to')}
              tripType={tripType}
              onSelectTripType={selectTripType}
              occasions={occasions}
              onToggleOccasion={toggleOccasion}
              canContinue={canContinue}
              isPending={generate.isPending}
              onGenerate={handleGenerate}
            />
          ) : null}

          {/* ============ SAVED CAPSULES (always visible) ============ */}
          {/* G3 sub-issue 2 — lifted out of the picker sub-step
              conditional so a returning user always sees their saved
              trips, not only on the wardrobe-picker step. */}
          <View style={{ gap: 10, marginTop: 6 }}>
            <Eyebrow>{tr('travelCapsule.savedHeading')}</Eyebrow>
            {capsulesLoading ? (
              <ActivityIndicator color={t.accent} />
            ) : savedCapsules.length === 0 ? (
              <Card padding={16}>
                <View style={{ gap: 6 }}>
                  <Eyebrow>{tr('travelCapsule.savedEmpty')}</Eyebrow>
                  <Caption>{tr('travel.savedCapsules.empty')}</Caption>
                </View>
              </Card>
            ) : (
              <FlatList
                data={savedCapsules}
                keyExtractor={(row) => row.id}
                scrollEnabled={false}
                ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
                renderItem={({ item }) => (
                  <SavedCapsuleRow
                    row={item}
                    onOpen={() => handleOpenSaved(item)}
                    onDelete={() => handleDeleteSaved(item)}
                  />
                )}
              />
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ============ CUSTOM DATE SHEET ============ */}
      <DatePickerSheet
        visible={customPickerFor !== null}
        title={customPickerFor === 'from' ? 'Start date' : 'End date'}
        // For the end-date picker, prevent picking before the start date
        // so the user can't build an inverted range. From-date has no
        // minimum.
        minISO={customPickerFor === 'to' ? fromDate || undefined : undefined}
        initialISO={customPickerFor === 'from' ? fromDate || undefined : toDate || undefined}
        onClose={() => setCustomPickerFor(null)}
        onConfirm={onCustomConfirm}
      />
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
});
