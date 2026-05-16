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

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTokens } from '../theme/ThemeProvider';
import { Eyebrow } from '../components/Eyebrow';
import { PageTitle } from '../components/PageTitle';
import { Caption } from '../components/Caption';
import { Button } from '../components/Button';
import { IconBtn } from '../components/IconBtn';
import { Spinner } from '../components/Spinner';
import { ErrorState } from '../components/ErrorState';
import {
  BackIcon,
  TshirtIcon,
  SuitcaseIcon,
  CalendarIcon,
  SparklesIcon,
  SunIcon,
} from '../components/icons';
import { useGenerateOutfit, formatGenerateOutfitError } from '../hooks/useGenerateOutfit';
import { useWeather, type ManualWeatherInput } from '../hooks/useWeather';
import { useFlatGarments } from '../hooks/useGarments';
import { usePersistGeneratedOutfit } from '../hooks/useOutfits';
import { SUBSCRIPTION_SENTINEL } from '../lib/edgeFunctionClient';
import { hapticLight } from '../lib/haptics';
import { t as tr } from '../lib/i18n';
import { Sentry } from '../lib/sentry';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { StyleMeWeatherSheet } from './StyleMe/StyleMeWeatherSheet';
import { StyleMeResultCard } from './StyleMe/StyleMeResultCard';
import {
  StyleMeOccasionGrid,
  type OccasionId,
  type OccasionOption,
} from './StyleMe/StyleMeOccasionGrid';
import { StyleMeAnchorSheet } from './StyleMe/StyleMeAnchorSheet';
import {
  StyleMeWeatherRow,
  StyleMeAnchorRow,
  StyleMeFormalityRow,
} from './StyleMe/StyleMeContextRows';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// Web parity: `src/components/outfit/OutfitGeneratePicker.tsx` exports
// 6 canonical occasions. `'evening'` matches web's `'party'` key (label
// "Evening") — engine consumes the engine-side label, so we send the
// localised label string for built-ins and the user's typed text for `custom`.
const OCCASIONS: OccasionOption[] = [
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

  // N3.7: clear all generation-related state when the user pivots to a new
  // occasion or formality. Without this, the prior `result`, anchor garment
  // ids, manual weather override, and any in-flight generate request would
  // bleed into the next "Generate" — e.g. a snowy override picked while
  // styling a Travel outfit would silently shape a follow-up Business Casual
  // suggestion. Anchors and the saved-outfit pointer are cleared too so the
  // next generation is unambiguously about the new mode the user picked.
  // Per-occasion stickiness for re-renders / anchor swaps is preserved —
  // the reset only fires on the mode-pivot transitions below.
  const resetForModeChange = useCallback(() => {
    reset();
    setAnchorIds([]);
    setSavedOutfitId(null);
    paywallShownRef.current = false;
    if (manualOverride !== null) {
      setManualOverride(null);
      setManual(null);
      Sentry.addBreadcrumb({
        category: 'weather',
        message: 'manual override cleared on mode change',
      });
    }
  }, [reset, manualOverride, setManual]);

  const onSelectOccasion = useCallback(
    (next: OccasionId) => {
      hapticLight();
      if (next === occId) return;
      resetForModeChange();
      setOccId(next);
    },
    [occId, resetForModeChange],
  );

  const onSelectFormality = useCallback(
    (next: FormalityKey) => {
      if (next === formality) return;
      resetForModeChange();
      setFormality(next);
    },
    [formality, resetForModeChange],
  );

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

  const anchorTitle = useMemo(() => {
    if (anchorIds.length === 0) return null;
    const g = (garmentsQ.data ?? []).find((row) => row.id === anchorIds[0]);
    return g?.title ?? null;
  }, [anchorIds, garmentsQ.data]);

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
        <StyleMeOccasionGrid
          occasions={OCCASIONS}
          occId={occId}
          customOccasion={customOccasion}
          onSelect={onSelectOccasion}
          onCustomChange={setCustomOccasion}
        />

        {/* ============ WEATHER CONTEXT ============ */}
        <StyleMeWeatherRow weatherLine={weatherLine} onAdjustPress={onAdjustWeatherPress} />

        {/* ============ ANCHOR PICKER ============ */}
        <StyleMeAnchorRow
          anchorIds={anchorIds}
          anchorTitle={anchorTitle}
          onClear={() => setAnchorIds([])}
          onOpen={() => setAnchorSheetOpen(true)}
        />

        {/* ============ FORMALITY ============ */}
        <StyleMeFormalityRow keys={FORMALITY_KEYS} active={formality} onSelect={onSelectFormality} />

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
        ) : (
          <StyleMeResultCard
            name={result.outfit_name}
            description={result.description}
            subLine={subLine}
            garments={resultGarments}
            itemCount={itemCount}
            savedOutfitId={savedOutfitId}
            onSave={onSavePress}
            onOpenSavedDetail={onOpenSavedDetail}
            onRestyle={onRestyle}
          />
        )}
      </ScrollView>

      {/* ============ ADJUST WEATHER MODAL ============ */}
      <StyleMeWeatherSheet
        isOpen={adjustOpen}
        onClose={() => setAdjustOpen(false)}
        baseTemperature={weather?.temperature}
        manualOverride={manualOverride}
        onApplyManualWeather={onApplyManualWeather}
        onResetWeather={onResetWeather}
      />

      {/* ============ ANCHOR PICKER MODAL ============ */}
      <StyleMeAnchorSheet
        isOpen={anchorSheetOpen}
        onClose={() => setAnchorSheetOpen(false)}
        garments={garmentsQ.data ?? []}
        loading={garmentsQ.isLoading}
        selectedIds={anchorIds}
        onChange={setAnchorIds}
      />
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
  loadingWrap: {
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
