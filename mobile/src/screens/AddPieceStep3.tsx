// Add piece — Step 3 of 3 (review + save).
//
// Wiring (W5): receives { storagePath, photoUri, analysis } from Step 2 and lets the
// user review the AI-detected fields before saving.
//   • Hero shows the local photoUri (no signed-URL round-trip — the file is right there).
//   • Title is editable via TextInput; everything else is read-only display in W5
//     (category / color / material pickers land in Wave 9 with the bulk-edit UX).
//   • Confidence badge (green ≥0.7, amber otherwise) tells the user whether to scrutinise.
//   • Save → useAddGarment.mutateAsync → nav.reset to GarmentDetail. The reset uses
//     index: 1 so GarmentDetail is the active screen with MainTabs in the back stack —
//     swiping back from the new garment lands on the home tab, matching the web's
//     "you came from the FAB, here's your new piece" flow.
//
// Multi-photo (W9 follow-up): the piece-selector strip is gone in W5. When multi-photo
// lands, the strip returns and Save loops back to Step 2 with the next photo.

import React, { useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTokens } from '../theme/ThemeProvider';
import { fonts, radii } from '../theme/tokens';
import { Eyebrow } from '../components/Eyebrow';
import { PageTitle } from '../components/PageTitle';
import { Button } from '../components/Button';
import { Chip } from '../components/Chip';
import { IconBtn } from '../components/IconBtn';
import { BackIcon } from '../components/icons';
import { useAddGarment } from '../hooks/useAddGarment';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'AddPieceStep3'>;

const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
const SEASON_LABELS: Record<string, string> = {
  spring: 'Spring',
  summer: 'Summer',
  autumn: 'Autumn',
  winter: 'Winter',
};

// Capitalise first character. The analyzer emits lowercase tokens for category /
// color / material; the display rows want title-case so they read like editorial
// copy rather than raw enum values.
function titleCase(value: string | null | undefined): string {
  if (!value) return '—';
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function AddPieceStep3() {
  const t = useTokens();
  const nav = useNavigation<Nav>();
  const route = useRoute<Route>();
  const params = route.params;
  const addGarment = useAddGarment();
  const [titleOverride, setTitleOverride] = useState<string>(params?.analysis.title ?? '');

  // Defensive guard — without route params the screen has nothing to render. Bounce
  // the user back to Step 1 instead of crashing on `params.analysis.title`.
  if (!params) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={['top']}>
        <View style={s.fallback}>
          <Text style={{ fontFamily: fonts.ui, color: t.fg }}>Missing analysis data.</Text>
          <Button label="Start over" onPress={() => nav.navigate('AddPieceStep1')} />
        </View>
      </SafeAreaView>
    );
  }

  const { storagePath, photoUri, analysis, source } = params;
  const confidenceHigh = analysis.confidence >= 0.7;
  const seasonsLower = analysis.season_tags.map((s) => s.toLowerCase());

  const handleSave = async () => {
    try {
      const garment = await addGarment.mutateAsync({
        storagePath,
        analysis,
        source,
        title: titleOverride.trim() || analysis.title,
        category: analysis.category,
      });
      // index: 1 makes GarmentDetail the active screen, with MainTabs in the back stack
      // so the swipe-back gesture lands on the home tab. (index: 0 with two routes would
      // surface MainTabs and stash GarmentDetail under it — wrong UX.)
      nav.reset({
        index: 1,
        routes: [
          { name: 'MainTabs' },
          { name: 'GarmentDetail', params: { id: garment.id } },
        ],
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Save failed';
      Alert.alert('Save failed', msg);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={['top']}>
      {/* ============ HEADER ============ */}
      <View style={[s.header, { borderBottomColor: t.border }]}>
        <IconBtn variant="ghost" onPress={() => nav.goBack()} ariaLabel="Back">
          <BackIcon color={t.fg} />
        </IconBtn>
        <View style={{ flex: 1 }}>
          <Eyebrow style={{ marginBottom: 2 }}>Step 3 of 3</Eyebrow>
          <PageTitle size={26}>Confirm</PageTitle>
        </View>
        <Pressable
          onPress={() => nav.goBack()}
          style={{ paddingHorizontal: 6, paddingVertical: 8 }}>
          <Text style={{ fontFamily: fonts.uiMed, fontSize: 13, color: t.accent, fontWeight: '500' }}>
            Re-scan
          </Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 24, gap: 14 }}
        showsVerticalScrollIndicator={false}>
        {/* ============ HERO ============ */}
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
          <View
            style={[
              s.heroImage,
              { borderColor: t.border, backgroundColor: t.bg2 },
            ]}>
            <Image
              source={{ uri: photoUri }}
              style={StyleSheet.absoluteFillObject}
              resizeMode="cover"
            />
          </View>
          <View style={{ flex: 1, paddingTop: 4 }}>
            <Eyebrow style={{ marginBottom: 4 }}>Detected</Eyebrow>
            <Text
              style={{
                fontFamily: fonts.displayMedium,
                fontStyle: 'italic',
                fontWeight: '500',
                fontSize: 22,
                lineHeight: 26,
                letterSpacing: -0.22,
                color: t.fg,
              }}>
              {analysis.title || 'Untitled'}
            </Text>
            {/* Confidence badge — green for high-trust auto-fill, amber for "review carefully" */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 10 }}>
              <View
                style={[
                  s.confidenceBadge,
                  {
                    backgroundColor: confidenceHigh
                      ? 'rgba(60, 130, 80, 0.12)'
                      : 'rgba(180, 110, 40, 0.14)',
                    borderColor: confidenceHigh
                      ? 'rgba(60, 130, 80, 0.45)'
                      : 'rgba(180, 110, 40, 0.5)',
                  },
                ]}>
                <Text
                  style={{
                    fontFamily: fonts.uiSemi,
                    fontSize: 10,
                    letterSpacing: 1.2,
                    textTransform: 'uppercase',
                    color: confidenceHigh ? 'rgb(50, 110, 70)' : 'rgb(160, 95, 30)',
                  }}>
                  {confidenceHigh ? 'Looks good' : 'Review carefully'}
                </Text>
              </View>
              <Chip label={titleCase(analysis.category)} />
              {analysis.color_primary ? <Chip label={titleCase(analysis.color_primary)} /> : null}
            </View>
          </View>
        </View>

        {/* ============ TITLE INPUT ============ */}
        <View style={{ gap: 6 }}>
          <Text
            style={{
              fontFamily: fonts.uiSemi,
              fontSize: 10,
              letterSpacing: 1.4,
              color: t.fg2,
              textTransform: 'uppercase',
            }}>
            Title
          </Text>
          <TextInput
            value={titleOverride}
            onChangeText={setTitleOverride}
            placeholder={analysis.title || 'Name this piece'}
            placeholderTextColor={t.fg3}
            style={[
              s.titleInput,
              { borderColor: t.border, backgroundColor: t.card, color: t.fg },
            ]}
            maxLength={60}
            returnKeyType="done"
          />
        </View>

        {/* ============ READ-ONLY DETAIL ROWS ============ */}
        <View style={{ gap: 8 }}>
          {/* Display-only in W5; editing each field needs picker UIs that land in Wave 9. */}
          {(
            [
              ['Category', titleCase(analysis.category)],
              ['Subcategory', titleCase(analysis.subcategory)],
              ['Primary color', titleCase(analysis.color_primary)],
              ['Material', titleCase(analysis.material)],
              ['Pattern', titleCase(analysis.pattern)],
              ['Fit', titleCase(analysis.fit)],
            ] as Array<[string, string]>
          ).map(([label, value]) => (
            <View
              key={label}
              style={[s.fieldRow, { borderColor: t.border, backgroundColor: t.card }]}>
              <Text
                style={{
                  fontFamily: fonts.uiSemi,
                  fontSize: 10,
                  letterSpacing: 1.4,
                  color: t.fg2,
                  textTransform: 'uppercase',
                }}>
                {label}
              </Text>
              <Text
                style={{
                  fontFamily: fonts.uiMed,
                  fontSize: 13,
                  color: t.fg,
                  fontWeight: '500',
                  flexShrink: 1,
                  textAlign: 'right',
                }}
                numberOfLines={1}>
                {value}
              </Text>
            </View>
          ))}
        </View>

        {/* ============ SEASONS ============ */}
        <View>
          <Eyebrow style={{ marginBottom: 8 }}>Seasons</Eyebrow>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {SEASONS.map((season) => (
              <Chip
                key={season}
                label={SEASON_LABELS[season]}
                active={seasonsLower.includes(season)}
              />
            ))}
          </View>
        </View>
      </ScrollView>

      {/* ============ STICKY SAVE BAR ============ */}
      <View style={[s.stickyBar, { borderTopColor: t.border, backgroundColor: t.bg }]}>
        <View style={{ flex: 1 }}>
          <Eyebrow style={{ marginBottom: 2 }}>Almost there</Eyebrow>
          <Text style={{ fontFamily: fonts.ui, fontSize: 11, color: t.fg2, letterSpacing: -0.11 }}>
            We&rsquo;ll keep refining in the background
          </Text>
        </View>
        <Button
          label={addGarment.isPending ? 'Saving…' : 'Save'}
          onPress={handleSave}
          disabled={addGarment.isPending}
        />
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  heroImage: {
    width: 100,
    height: 130,
    borderRadius: radii.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  confidenceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  titleInput: {
    height: 44,
    borderRadius: radii.lg,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontFamily: fonts.uiMed,
    fontSize: 14,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: 12,
  },
  stickyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14,
    borderTopWidth: 1,
  },
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 24,
  },
});
