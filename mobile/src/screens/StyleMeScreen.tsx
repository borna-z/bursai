// Style Me — occasion-based outfit creator (G5).
//
// G5 expanded the screen end-to-end:
//   • Auto-weather via `expo-location` (deny → Stockholm fallback inside
//     `useWeather.fetchWeather`); manual `Adjust` opens a Modal sheet that
//     pipes through `useWeather.setManual`.
//   • 6 web-parity occasions + a `Custom…` chip with inline TextInput; the
//     typed string becomes the occasion sent to the engine.
//   • 4 engine-aligned formality submodes (`Formal Office`,
//     `Business Casual`, `Relaxed Office`, `Baseline`).
//   • Anchor garment picker (re-uses `TravelGarmentPicker` with `max=1`)
//     above the Generate CTA. Selected garment IDs flow into
//     `useGenerateOutfit({ preferGarmentIds })` — the M13 anchor lock channel.
//   • `Restyle` navigates to StyleChat with the result's garments seeded
//     as anchors (G1 contract).
//   • `Save` calls `usePersistGeneratedOutfit` to insert the outfit + items
//     and stamp `saved: true`; the result row swaps the "Preview" badge
//     for "Saved ✓" + an "Open detail" link to OutfitDetailScreen.
//   • Result tiles use G6's real-photo OutfitCard (`garments` prop) instead
//     of placeholder hue gradients.
//
// W4 wired the original engine call. Persistent saving + restyle handoff
// land in G5 — paywall routing for `subscription_required` is unchanged.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
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
import { OutfitCard } from '../components/OutfitCard';
import { Spinner } from '../components/Spinner';
import { ErrorState } from '../components/ErrorState';
import { TravelGarmentPicker } from '../components/TravelGarmentPicker';
import {
  BackIcon,
  SunIcon,
  TshirtIcon,
  SuitcaseIcon,
  CalendarIcon,
  SparklesIcon,
  type IconProps,
} from '../components/icons';
import { useGenerateOutfit, formatGenerateOutfitError } from '../hooks/useGenerateOutfit';
import { useWeather, type ManualWeatherInput } from '../hooks/useWeather';
import { useFlatGarments } from '../hooks/useGarments';
import { usePersistGeneratedOutfit } from '../hooks/useOutfits';
import { SUBSCRIPTION_SENTINEL } from '../lib/edgeFunctionClient';
import { hapticLight } from '../lib/haptics';
import { t as tr } from '../lib/i18n';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

type OccasionId = 'casual' | 'work' | 'evening' | 'date' | 'workout' | 'travel' | 'custom';

type Occasion = {
  id: OccasionId;
  labelKey: string;
  subKey: string;
  Icon: React.ComponentType<IconProps>;
};

// Web parity: `src/components/outfit/OutfitGeneratePicker.tsx` exports
// 6 canonical occasions. `'evening'` matches web's `'party'` key (label
// "Evening") — engine consumes the engine-side label, so we send the
// localised label string for built-ins and the user's typed text for `custom`.
const OCCASIONS: Occasion[] = [
  { id: 'casual',  labelKey: 'styleMe.occasion.casual',  subKey: 'styleMe.occasion.casual.sub',  Icon: TshirtIcon  },
  { id: 'work',    labelKey: 'styleMe.occasion.work',    subKey: 'styleMe.occasion.work.sub',    Icon: TshirtIcon  },
  { id: 'evening', labelKey: 'styleMe.occasion.evening', subKey: 'styleMe.occasion.evening.sub', Icon: CalendarIcon },
  { id: 'date',    labelKey: 'styleMe.occasion.date',    subKey: 'styleMe.occasion.date.sub',    Icon: SparklesIcon },
  { id: 'workout', labelKey: 'styleMe.occasion.workout', subKey: 'styleMe.occasion.workout.sub', Icon: SunIcon     },
  { id: 'travel',  labelKey: 'styleMe.occasion.travel',  subKey: 'styleMe.occasion.travel.sub',  Icon: SuitcaseIcon },
];

// Engine submodes: see `supabase/functions/_shared/outfit-scoring.ts`
// (cited in the wave plan — lines 1123–1127). Sending these strings as
// the `formality` parameter lets the engine route the correct scoring
// preset; the prior list (`Casual`, `Smart casual`, `Business`, `Formal`)
// did not match any submode and silently fell back to `Baseline`.
type FormalityKey = 'formalOffice' | 'businessCasual' | 'relaxedOffice' | 'baseline';
const FORMALITY_KEYS: FormalityKey[] = ['formalOffice', 'businessCasual', 'relaxedOffice', 'baseline'];
const FORMALITY_ENGINE: Record<FormalityKey, string> = {
  formalOffice: 'Formal Office',
  businessCasual: 'Business Casual',
  relaxedOffice: 'Relaxed Office',
  baseline: 'Baseline',
};

type WeatherCondition = ManualWeatherInput['condition'];
const CONDITIONS: WeatherCondition[] = ['clear', 'cloudy', 'rain', 'snow'];

export function StyleMeScreen() {
  const t = useTokens();
  const nav = useNavigation<Nav>();

  const [occId, setOccId] = useState<OccasionId>('work');
  const [customOccasion, setCustomOccasion] = useState<string>('');
  const [formality, setFormality] = useState<FormalityKey>('businessCasual');

  // Anchor picker state — single-select garment id flows into
  // `preferGarmentIds` for the engine call. Reuses the closet-aware grid
  // from `TravelGarmentPicker` (max=1).
  const [anchorIds, setAnchorIds] = useState<string[]>([]);
  const [anchorSheetOpen, setAnchorSheetOpen] = useState(false);
  const garmentsQ = useFlatGarments();

  // Weather + manual override — `useWeather()` mounts the live query (auto
  // location + Open-Meteo); `setManual` writes a synthetic row into the
  // same React Query entry so `awaitFreshWeather` (inside useGenerateOutfit)
  // picks up the override on the next generate without a network refetch.
  const { weather, setManual } = useWeather();
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [manualOverride, setManualOverride] = useState<ManualWeatherInput | null>(null);

  const { result, isLoading, error, generate, reset } = useGenerateOutfit();
  const persistOutfit = usePersistGeneratedOutfit();
  const [savedOutfitId, setSavedOutfitId] = useState<string | null>(null);
  const paywallShownRef = useRef(false);

  const occ = OCCASIONS.find((o) => o.id === occId) ?? OCCASIONS[0];

  // Reset hook state when leaving the screen so we don't ship a stale result
  // back into the cache when the user re-mounts. `reset` is stable per the
  // hook's useCallback so the effect runs once on unmount.
  useEffect(() => {
    return () => {
      reset();
    };
  }, [reset]);

  useEffect(() => {
    // Route to the real PaywallScreen instead of popping an Alert each time
    // the engine returns `subscription_required`. The previous version
    // re-popped the alert every time the user tapped Generate after a
    // dismiss + reset() — App Store reviewers flag this as harassing UX
    // (and screen-reviewer P1 caught it). The ref stays sticky for the
    // screen's lifetime so we don't re-route on every retry attempt; the
    // user navigates back to StyleMe explicitly when they want to retry.
    if (error === SUBSCRIPTION_SENTINEL && !paywallShownRef.current) {
      paywallShownRef.current = true;
      nav.navigate('Paywall');
    }
  }, [error, nav]);

  // Resolve the engine-facing occasion: built-ins use the localised label
  // (so the engine's heuristics see the same string web sends); `custom`
  // uses the trimmed TextInput value when non-empty, otherwise falls back
  // to "Casual" so we never ship an empty string.
  const occasionForEngine = useMemo(() => {
    if (occId === 'custom') {
      const trimmed = customOccasion.trim();
      return trimmed.length > 0 ? trimmed : tr('styleMe.occasion.casual');
    }
    return tr(occ.labelKey);
  }, [occId, occ.labelKey, customOccasion]);

  const onGenerate = () => {
    setSavedOutfitId(null);
    void generate({
      occasion: occasionForEngine,
      formality: FORMALITY_ENGINE[formality],
      preferGarmentIds: anchorIds,
    });
  };

  const onRestyle = () => {
    // G1 contract: hand the conversation a starting mode + the result's
    // garments as anchors so the chat opens with the lock applied. The
    // `sourceOutfitId` lets G1 deep-link back to the originating outfit;
    // pass `savedOutfitId` when the user has already saved, undefined when
    // we're still in preview state.
    if (!result) return;
    const garmentIds = result.items
      .map((it) => it.garment_id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0);
    nav.navigate('StyleChat', {
      mode: 'style',
      anchorGarmentIds: garmentIds,
      sourceOutfitId: savedOutfitId ?? undefined,
    });
  };

  const onSavePress = async () => {
    if (!result || persistOutfit.isPending || savedOutfitId) return;
    const items = result.items
      .filter((it) => typeof it.garment_id === 'string' && it.garment_id.length > 0)
      .map((it) => ({ garment_id: it.garment_id as string, slot: it.slot }));
    if (items.length === 0) return;
    try {
      const { outfitId } = await persistOutfit.mutateAsync({
        occasion: occasionForEngine,
        explanation: result.description ?? '',
        familyLabel: null,
        items,
      });
      setSavedOutfitId(outfitId);
    } catch (err) {
      Alert.alert(
        tr('styleMe.saved.error.title'),
        err instanceof Error ? err.message : tr('common.alerts.tryAgain'),
      );
    }
  };

  const onOpenSavedDetail = () => {
    if (savedOutfitId) {
      nav.navigate('OutfitDetail', { id: savedOutfitId });
    }
  };

  const onAdjustWeatherPress = () => {
    setAdjustOpen(true);
  };

  const onApplyManualWeather = (next: ManualWeatherInput) => {
    setManualOverride(next);
    setManual(next);
  };

  const onResetWeather = () => {
    setManualOverride(null);
    setManual(null);
  };

  // Result row content. `result.items` shape comes from `useGenerateOutfit`;
  // map to the `OutfitCard.garments` prop so G6's real-photo tiles render.
  // We don't have full garment rows in hand (the engine only returns ids
  // and slot strings), so we hand-craft the minimum shape OutfitCard needs
  // and let `useGarmentImage` (inside each tile) hydrate the photo via the
  // signed-URL cache.
  const resultGarments = useMemo(() => {
    if (!result) return undefined;
    const all = garmentsQ.data ?? [];
    const lookup = new Map(all.map((g) => [g.id, g]));
    return result.items
      .filter((it) => typeof it.garment_id === 'string' && it.garment_id.length > 0)
      .map((it) => {
        const garment = lookup.get(it.garment_id as string);
        return {
          id: it.garment_id as string,
          rendered_image_path: garment?.rendered_image_path ?? null,
          original_image_path: garment?.original_image_path ?? null,
        };
      });
  }, [result, garmentsQ.data]);

  const itemCount = result?.items.length ?? 0;
  const subLine = result
    ? `${tr(occ.subKey).toUpperCase()} · ${itemCount} PIECE${itemCount === 1 ? '' : 'S'}`
    : '';

  const weatherLine = (() => {
    const data = manualOverride
      ? {
          temperature: Math.round(manualOverride.tempC),
          condition: `weather.condition.${manualOverride.condition === 'clear' ? 'clear' : manualOverride.condition}`,
        }
      : weather
        ? { temperature: weather.temperature, condition: weather.condition }
        : null;
    if (!data) return tr('styleMe.weather.fallbackLine');
    return `${data.temperature}° · ${tr(data.condition)}`;
  })();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={['top']}>
      {/* ============ HEADER ============ */}
      <View style={[s.header, { borderBottomColor: t.border }]}>
        <IconBtn variant="ghost" onPress={() => nav.goBack()} ariaLabel="Back">
          <BackIcon color={t.fg} />
        </IconBtn>
        <View style={{ flex: 1 }}>
          <Eyebrow style={{ marginBottom: 2 }}>Occasion</Eyebrow>
          <PageTitle size={26}>Style Me</PageTitle>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 24, gap: 18 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">

        {/* ============ OCCASION GRID 2-col ============ */}
        <View>
          <Eyebrow style={{ marginBottom: 10 }}>Pick an occasion</Eyebrow>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {OCCASIONS.map((o) => {
              const Icon = o.Icon;
              const isActive = o.id === occId;
              return (
                <Pressable
                  key={o.id}
                  onPress={() => {
                    hapticLight();
                    setOccId(o.id);
                  }}
                  style={({ pressed }) => [
                    s.occTile,
                    {
                      borderColor: isActive ? t.accent : t.border,
                      borderWidth: isActive ? 2 : 1,
                      backgroundColor: isActive ? t.accentSoft : t.card,
                      transform: pressed ? [{ scale: 0.98 }] : [],
                    },
                  ]}>
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: radii.md,
                      backgroundColor: t.accentSoft,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                    <Icon color={t.accent} />
                  </View>
                  <View style={{ gap: 1 }}>
                    <Text style={{ fontFamily: fonts.uiSemi, fontSize: 14, fontWeight: '600', color: t.fg, letterSpacing: -0.14 }}>
                      {tr(o.labelKey)}
                    </Text>
                    <Text style={{ fontFamily: fonts.ui, fontSize: 11, color: t.fg2 }} numberOfLines={1}>
                      {tr(o.subKey)}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
            {/* Custom… chip — taps a 7th tile to open inline TextInput. */}
            <Pressable
              onPress={() => {
                hapticLight();
                setOccId('custom');
              }}
              style={({ pressed }) => [
                s.occTile,
                {
                  borderColor: occId === 'custom' ? t.accent : t.border,
                  borderWidth: occId === 'custom' ? 2 : 1,
                  backgroundColor: occId === 'custom' ? t.accentSoft : t.card,
                  transform: pressed ? [{ scale: 0.98 }] : [],
                },
              ]}>
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: radii.md,
                  backgroundColor: t.accentSoft,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <SparklesIcon color={t.accent} />
              </View>
              <View style={{ gap: 1 }}>
                <Text style={{ fontFamily: fonts.uiSemi, fontSize: 14, fontWeight: '600', color: t.fg, letterSpacing: -0.14 }}>
                  {tr('styleMe.occasion.custom')}
                </Text>
                <Text style={{ fontFamily: fonts.ui, fontSize: 11, color: t.fg2 }} numberOfLines={1}>
                  {customOccasion.trim().length > 0 ? customOccasion : tr('styleMe.occasion.customPlaceholder')}
                </Text>
              </View>
            </Pressable>
          </View>
          {occId === 'custom' ? (
            <View style={[s.customInputRow, { borderColor: t.border, backgroundColor: t.card }]}>
              <TextInput
                value={customOccasion}
                onChangeText={setCustomOccasion}
                placeholder={tr('styleMe.occasion.customPlaceholder')}
                placeholderTextColor={t.fg3}
                style={{
                  flex: 1,
                  color: t.fg,
                  fontFamily: fonts.uiMed,
                  fontSize: 14,
                  padding: 0,
                }}
                autoFocus
                autoCapitalize="sentences"
                returnKeyType="done"
              />
            </View>
          ) : null}
        </View>

        {/* ============ WEATHER CONTEXT ============ */}
        <View
          style={[
            s.weatherRow,
            { borderColor: t.border, backgroundColor: t.card },
          ]}>
          <View style={{ width: 36, height: 36, borderRadius: radii.md, backgroundColor: t.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
            <SunIcon color={t.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Eyebrow style={{ marginBottom: 1 }}>Weather</Eyebrow>
            <Text style={{ fontFamily: fonts.uiSemi, fontSize: 13, color: t.fg, fontWeight: '600', letterSpacing: -0.13 }}>
              {weatherLine}
            </Text>
          </View>
          <Pressable
            onPress={onAdjustWeatherPress}
            accessibilityRole="button"
            accessibilityLabel={tr('styleMe.weather.adjust.cta')}
            style={{ paddingHorizontal: 6, paddingVertical: 6 }}>
            <Text style={{ fontFamily: fonts.uiMed, fontSize: 12, color: t.accent }}>
              {tr('styleMe.weather.adjust.cta')}
            </Text>
          </Pressable>
        </View>

        {/* ============ ANCHOR PICKER ============ */}
        <View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
            <Eyebrow>{tr('styleMe.anchor.title')}</Eyebrow>
            {anchorIds.length > 0 ? (
              <Pressable onPress={() => setAnchorIds([])} accessibilityRole="button">
                <Text style={{ fontFamily: fonts.uiMed, fontSize: 12, color: t.accent }}>
                  {tr('styleMe.anchor.clear')}
                </Text>
              </Pressable>
            ) : null}
          </View>
          <Pressable
            onPress={() => {
              hapticLight();
              setAnchorSheetOpen(true);
            }}
            style={({ pressed }) => [
              s.anchorRow,
              {
                borderColor: anchorIds.length > 0 ? t.accent : t.border,
                backgroundColor: anchorIds.length > 0 ? t.accentSoft : t.card,
                transform: pressed ? [{ scale: 0.99 }] : [],
              },
            ]}
            accessibilityRole="button">
            <Text style={{ fontFamily: fonts.uiMed, fontSize: 13, color: t.fg }}>
              {anchorIds.length > 0
                ? (() => {
                    const g = (garmentsQ.data ?? []).find((row) => row.id === anchorIds[0]);
                    return g?.title || anchorIds[0];
                  })()
                : tr('styleMe.anchor.empty')}
            </Text>
            <Text style={{ fontFamily: fonts.uiMed, fontSize: 12, color: t.accent }}>
              {tr('styleMe.anchor.cta')}
            </Text>
          </Pressable>
        </View>

        {/* ============ FORMALITY ============ */}
        <View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
            <Eyebrow>Formality</Eyebrow>
            <Caption style={{ color: t.accent }}>{tr(`styleMe.formality.${formality}`)}</Caption>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {FORMALITY_KEYS.map((key) => (
              <Chip
                key={key}
                label={tr(`styleMe.formality.${key}`)}
                active={key === formality}
                onPress={() => setFormality(key)}
              />
            ))}
          </View>
        </View>

        {/* ============ GENERATE / RESULT ============ */}
        {error && error !== SUBSCRIPTION_SENTINEL ? (
          <ErrorState
            title="Couldn't generate"
            body={formatGenerateOutfitError(error) ?? error}
            onRetry={onGenerate}
          />
        ) : isLoading ? (
          <View style={s.loadingWrap}>
            <Spinner size={36} />
            <Caption style={{ marginTop: 14, textAlign: 'center' }}>
              Building your look…
            </Caption>
          </View>
        ) : !result ? (
          <Button label="Generate outfit" onPress={onGenerate} block />
        ) : itemCount === 0 ? (
          // Engine returned a non-error response with no garments — wardrobe
          // doesn't cover this occasion+formality combo. Surface a soft empty
          // state instead of rendering a "0 PIECES" OutfitCard. Codex audit
          // P2-1 (audit 3).
          <View style={{ gap: 14 }}>
            <View style={s.emptyResult}>
              <Eyebrow>No matching pieces</Eyebrow>
              <Caption style={{ marginTop: 6, textAlign: 'center', maxWidth: 260 }}>
                {result.description || 'Try a different occasion or formality — your wardrobe doesn’t yet cover this combo.'}
              </Caption>
            </View>
            <Button label="Restyle" variant="outline" onPress={onRestyle} block />
          </View>
        ) : (
          <View style={{ gap: 14 }}>
            <View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                <Eyebrow>Styled for you</Eyebrow>
                <Text
                  style={{
                    fontFamily: fonts.uiSemi,
                    fontSize: 10,
                    letterSpacing: 1.4,
                    color: savedOutfitId ? t.accent : t.fg2,
                    textTransform: 'uppercase',
                  }}>
                  {savedOutfitId ? tr('styleMe.saved.badge') : tr('styleMe.preview.badge')}
                </Text>
              </View>
              <OutfitCard
                name={result.outfit_name}
                sub={subLine}
                garments={resultGarments}
                onUse={savedOutfitId ? onOpenSavedDetail : onSavePress}
                onSave={savedOutfitId ? undefined : onSavePress}
              />
              {savedOutfitId ? (
                <Pressable
                  onPress={onOpenSavedDetail}
                  accessibilityRole="link"
                  style={{ marginTop: 8, alignSelf: 'flex-start' }}>
                  <Text style={{ fontFamily: fonts.uiMed, fontSize: 13, color: t.accent }}>
                    {tr('styleMe.saved.openDetail')}
                  </Text>
                </Pressable>
              ) : null}
              {result.description ? (
                <Caption style={{ marginTop: 8, lineHeight: 18 }}>{result.description}</Caption>
              ) : null}
            </View>
            <Button label="Restyle" variant="outline" onPress={onRestyle} block />
          </View>
        )}
      </ScrollView>

      {/* ============ ADJUST WEATHER MODAL ============ */}
      <Modal
        visible={adjustOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setAdjustOpen(false)}>
        <View style={s.modalBackdrop}>
          <View style={[s.modalSheet, { backgroundColor: t.bg, borderColor: t.border }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <PageTitle size={20}>{tr('styleMe.weather.adjustTitle')}</PageTitle>
              <Pressable onPress={() => setAdjustOpen(false)} accessibilityRole="button">
                <Text style={{ fontFamily: fonts.uiMed, fontSize: 14, color: t.accent }}>
                  {tr('styleMe.weather.adjust.done')}
                </Text>
              </Pressable>
            </View>

            <Eyebrow>{tr('styleMe.weather.tempLabel')}</Eyebrow>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8, marginBottom: 18 }}>
              <Pressable
                onPress={() => {
                  hapticLight();
                  const next: ManualWeatherInput = {
                    tempC: (manualOverride?.tempC ?? weather?.temperature ?? 14) - 1,
                    condition: manualOverride?.condition ?? 'clear',
                  };
                  onApplyManualWeather(next);
                }}
                style={[s.stepperBtn, { borderColor: t.border, backgroundColor: t.card }]}
                accessibilityRole="button"
                accessibilityLabel="Decrease temperature">
                <Text style={{ fontFamily: fonts.uiSemi, fontSize: 18, color: t.fg }}>−</Text>
              </Pressable>
              <Text style={{ fontFamily: fonts.uiSemi, fontSize: 22, color: t.fg, minWidth: 60, textAlign: 'center' }}>
                {(manualOverride?.tempC ?? weather?.temperature ?? 14)}°
              </Text>
              <Pressable
                onPress={() => {
                  hapticLight();
                  const next: ManualWeatherInput = {
                    tempC: (manualOverride?.tempC ?? weather?.temperature ?? 14) + 1,
                    condition: manualOverride?.condition ?? 'clear',
                  };
                  onApplyManualWeather(next);
                }}
                style={[s.stepperBtn, { borderColor: t.border, backgroundColor: t.card }]}
                accessibilityRole="button"
                accessibilityLabel="Increase temperature">
                <Text style={{ fontFamily: fonts.uiSemi, fontSize: 18, color: t.fg }}>+</Text>
              </Pressable>
            </View>

            <Eyebrow>{tr('styleMe.weather.conditionLabel')}</Eyebrow>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              {CONDITIONS.map((cond) => {
                const active = (manualOverride?.condition ?? 'clear') === cond;
                return (
                  <Chip
                    key={cond}
                    label={tr(`styleMe.weather.condition.${cond}`)}
                    active={active}
                    onPress={() => {
                      hapticLight();
                      const next: ManualWeatherInput = {
                        tempC: manualOverride?.tempC ?? weather?.temperature ?? 14,
                        condition: cond,
                      };
                      onApplyManualWeather(next);
                    }}
                  />
                );
              })}
            </View>

            {manualOverride ? (
              <Pressable
                onPress={() => {
                  hapticLight();
                  onResetWeather();
                }}
                accessibilityRole="button"
                style={{ marginTop: 18, alignSelf: 'flex-start' }}>
                <Text style={{ fontFamily: fonts.uiMed, fontSize: 13, color: t.accent }}>
                  {tr('styleMe.weather.adjust.reset')}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </Modal>

      {/* ============ ANCHOR PICKER MODAL ============ */}
      <Modal
        visible={anchorSheetOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setAnchorSheetOpen(false)}>
        <View style={s.modalBackdrop}>
          <View style={[s.modalSheetTall, { backgroundColor: t.bg, borderColor: t.border }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <PageTitle size={20}>{tr('styleMe.anchor.sheetTitle')}</PageTitle>
              <Pressable onPress={() => setAnchorSheetOpen(false)} accessibilityRole="button">
                <Text style={{ fontFamily: fonts.uiMed, fontSize: 14, color: t.accent }}>
                  {tr('styleMe.anchor.sheetClose')}
                </Text>
              </Pressable>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <TravelGarmentPicker
                garments={garmentsQ.data ?? []}
                selectedIds={anchorIds}
                onChange={setAnchorIds}
                max={1}
                loading={garmentsQ.isLoading}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  occTile: {
    width: '48%',
    flexGrow: 1,
    flexBasis: '48%',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: radii.xl,
    gap: 10,
  },
  customInputRow: {
    marginTop: 10,
    height: 44,
    borderRadius: radii.lg,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  weatherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  anchorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  loadingWrap: {
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyResult: {
    paddingVertical: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    paddingHorizontal: 20,
    paddingVertical: 22,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
  },
  modalSheetTall: {
    paddingHorizontal: 20,
    paddingVertical: 22,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    maxHeight: '85%',
  },
  stepperBtn: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
