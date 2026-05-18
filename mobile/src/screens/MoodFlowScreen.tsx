// MoodFlow — standalone "find my mood outfit" loading + result screen.
// W4: wired to the real `mood_outfit` edge function via useMoodOutfit (SSE).
// The screen kicks generation on mount when moodId+time are passed via
// navigation; tapping "Restyle" calls reset() then re-runs generate().
//
// Layout: top header (back · "Mood" + "Mood Flow") → loading state (centered
// Spinner + italic Playfair "Finding your look…" + mood label) OR result
// state (eyebrow + Playfair outfit name + 4-piece thumb row in OutfitCard +
// mood/context chips + editorial copy + "Wear this" / "Restyle" / "Save"
// actions) OR error state (subscription paywall or retryable banner).

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTokens } from '../theme/ThemeProvider';
import { fonts } from '../theme/tokens';
import { Eyebrow } from '../components/Eyebrow';
import { PageTitle } from '../components/PageTitle';
import { Button } from '../components/Button';
import { Chip } from '../components/Chip';
import { IconBtn } from '../components/IconBtn';
import { Spinner } from '../components/Spinner';
import { OutfitCard } from '../components/OutfitCard';
import { ErrorState } from '../components/ErrorState';
import { BackIcon } from '../components/icons';
import { useMoodOutfit } from '../hooks/useMoodOutfit';
import { useGarmentsByIds } from '../hooks/useGarmentsByIds';
import { useMarkOutfitWorn, usePersistGeneratedOutfit } from '../hooks/useOutfits';
import { hapticLight, hapticSuccess } from '../lib/haptics';
import { SUBSCRIPTION_SENTINEL } from '../lib/edgeFunctionClient';
import { showToast } from '../lib/toast';
import { t as tr } from '../lib/i18n';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'MoodFlow'>;

const DEFAULT_MOOD = 'Confident';
const DEFAULT_TIME = 'Day';

export function MoodFlowScreen() {
  const t = useTokens();
  const nav = useNavigation<Nav>();
  const route = useRoute<Route>();
  const MOOD_LABEL = route.params?.moodId ?? DEFAULT_MOOD;
  const TIME_LABEL = route.params?.time ?? DEFAULT_TIME;

  const { result, isLoading, error, generate, reset } = useMoodOutfit();
  const persistOutfit = usePersistGeneratedOutfit();
  const markWorn = useMarkOutfitWorn();
  const [savedOutfitId, setSavedOutfitId] = useState<string | null>(null);
  const paywallShownRef = useRef(false);

  // Reset the saved-state ref whenever a fresh result lands — Restyle should
  // un-stamp "Saved ✓" so the user can save the new outfit too.
  useEffect(() => {
    if (result?.outfit_name) setSavedOutfitId(null);
  }, [result?.outfit_name]);

  // Items shape the persistence hook accepts. Drops any item missing a
  // garment_id (the mood engine occasionally returns a partial slot) — saving
  // an empty/invalid outfit would just error inside the hook.
  const persistableItems = useMemo(
    () =>
      (result?.items ?? [])
        .filter((it): it is { garment_id: string; slot: string; title: string; color?: string } =>
          typeof it.garment_id === 'string' && it.garment_id.length > 0,
        )
        .map((it) => ({ garment_id: it.garment_id, slot: it.slot ?? '' })),
    [result?.items],
  );

  const canSaveOrWear = result !== null && persistableItems.length > 0 && !savedOutfitId;
  const persistPending = persistOutfit.isPending;
  const wearPending = markWorn.isPending;

  // Hydrate the result's garment ids so the OutfitCard preview tiles
  // surface real signed-URL photos instead of neutral placeholders.
  // Mirrors `OutfitGenerateScreen` (`OutfitGenerateScreen.tsx:203-215`)
  // and `OutfitSuggestionCard` — pass the raw ids to `useGarmentsByIds`,
  // then feed the resolved rows into `OutfitCard.garments`. Before
  // hydration resolves, `previewGarments` is undefined → empty array →
  // OutfitCard falls back to its default 4 neutral tiles, so the
  // loading-to-result transition stays visually stable.
  const previewIds = useMemo(
    () => persistableItems.map((it) => it.garment_id),
    [persistableItems],
  );
  const { data: previewGarments } = useGarmentsByIds(previewIds);

  const persistArgs = result
    ? {
        occasion: TIME_LABEL,
        explanation: result.description ?? '',
        familyLabel: result.outfit_name,
        items: persistableItems,
      }
    : null;

  const handleSave = () => {
    if (!result || !persistArgs || persistPending || savedOutfitId) return;
    if (persistableItems.length === 0) {
      showToast('error', tr('moodFlow.save.empty.title'), tr('moodFlow.save.empty.body'));
      return;
    }
    hapticLight();
    persistOutfit.mutate(persistArgs, {
      onSuccess: ({ outfitId }) => {
        hapticSuccess();
        setSavedOutfitId(outfitId);
        showToast('success', tr('moodFlow.save.success.title'), tr('moodFlow.save.success.body'));
      },
      onError: (err) => {
        showToast(
          'error',
          tr('moodFlow.save.failed.title'),
          err instanceof Error ? err.message : String(err),
        );
      },
    });
  };

  const navigateToWornOutfit = (outfitId: string) => {
    const garmentIds = persistableItems.map((it) => it.garment_id);
    markWorn.mutate(
      { outfitId, garmentIds },
      {
        onSuccess: () => {
          hapticSuccess();
          nav.navigate('OutfitDetail', { id: outfitId });
        },
        onError: (err) => {
          showToast(
            'error',
            tr('moodFlow.wear.failed.title'),
            err instanceof Error ? err.message : String(err),
          );
        },
      },
    );
  };

  const handleWear = () => {
    if (!result || persistPending || wearPending) return;
    const existing = savedOutfitId ?? result.outfit_id ?? null;
    if (existing) {
      hapticLight();
      navigateToWornOutfit(existing);
      return;
    }
    if (!persistArgs || persistableItems.length === 0) {
      showToast('error', tr('moodFlow.save.empty.title'), tr('moodFlow.save.empty.body'));
      return;
    }
    hapticLight();
    persistOutfit.mutate(persistArgs, {
      onSuccess: ({ outfitId }) => {
        setSavedOutfitId(outfitId);
        navigateToWornOutfit(outfitId);
      },
      onError: (err) => {
        showToast(
          'error',
          tr('moodFlow.wear.failed.title'),
          err instanceof Error ? err.message : String(err),
        );
      },
    });
  };

  // Reset + regenerate atomically when MOOD_LABEL / TIME_LABEL changes.
  // Splitting these into two effects (one for [mood,time] → generate, one
  // for unmount → reset) left a window where the previous result was still
  // visible after the mood changed but before generate's first delta landed
  // — a brief flash of stale outfit. The cleanup function aborts whatever
  // mood Flow had in flight (reset() cancels the SSE stream in the hook)
  // before the next generate runs, AND on unmount the same cleanup tears
  // down any open stream. Codex P2 on PR #738.
  useEffect(() => {
    reset();
    void generate(MOOD_LABEL, TIME_LABEL);
    return () => {
      reset();
    };
    // generate / reset identities are stable per session; we only want to
    // re-fire on mood / time pair changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [MOOD_LABEL, TIME_LABEL]);

  useEffect(() => {
    // Route to the real PaywallScreen instead of popping an Alert each time
    // the engine returns `subscription_required`. The previous version
    // re-popped the alert every time the user tapped Restyle after a
    // dismiss + reset() — App Store reviewers flag this as harassing UX.
    // The ref stays sticky for the screen's lifetime so we don't re-route
    // on every retry attempt.
    if (error === SUBSCRIPTION_SENTINEL && !paywallShownRef.current) {
      paywallShownRef.current = true;
      nav.navigate('Paywall');
    }
  }, [error, nav]);

  const restyle = () => {
    reset();
    void generate(MOOD_LABEL, TIME_LABEL);
  };

  const itemCount = result?.items.length ?? 0;
  const subLine =
    itemCount > 0
      ? `${itemCount} PIECE${itemCount === 1 ? '' : 'S'} · ${MOOD_LABEL.toUpperCase()}`
      : `${MOOD_LABEL.toUpperCase()} · ${TIME_LABEL.toUpperCase()}`;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={['top']}>
      {/* ============ HEADER ============ */}
      <View style={[s.header, { borderBottomColor: t.border }]}>
        <IconBtn variant="ghost" onPress={() => nav.goBack()} ariaLabel="Back">
          <BackIcon color={t.fg} />
        </IconBtn>
        <View style={{ flex: 1 }}>
          <Eyebrow style={{ marginBottom: 2 }}>{MOOD_LABEL.toUpperCase()}</Eyebrow>
          <PageTitle size={26}>Mood Flow</PageTitle>
        </View>
      </View>

      {error === SUBSCRIPTION_SENTINEL ? (
        // Paywall path — without an explicit branch the screen would sit
        // forever on the spinner (isLoading=false, result=null). Codex
        // audit P0-1 (audit 3).
        <View style={s.loadingWrap}>
          <Eyebrow>Premium feature</Eyebrow>
          <Text
            style={{
              fontFamily: fonts.displayMedium,
              fontStyle: 'italic',
              fontWeight: '500',
              fontSize: 22,
              color: t.fg,
              letterSpacing: -0.22,
              textAlign: 'center',
            }}>
            Mood Outfit is part of BURS Premium
          </Text>
          <Text
            style={{
              fontFamily: fonts.uiMed,
              fontSize: 12,
              color: t.fg2,
              letterSpacing: -0.1,
              textAlign: 'center',
            }}>
            Upgrade to keep generating mood looks.
          </Text>
          <Button label="Back" variant="outline" onPress={() => nav.goBack()} />
        </View>
      ) : error ? (
        <ErrorState
          title="Couldn't build your mood outfit"
          body={error}
          onRetry={restyle}
          style={{ flex: 1 }}
        />
      ) : isLoading || !result ? (
        // ============ LOADING STATE ============
        <View style={s.loadingWrap}>
          <Spinner size={48} />
          <Text
            style={{
              fontFamily: fonts.displayMedium,
              fontStyle: 'italic',
              fontWeight: '500',
              fontSize: 22,
              color: t.fg,
              letterSpacing: -0.22,
              textAlign: 'center',
            }}>
            Finding your look…
          </Text>
          <Text
            style={{
              fontFamily: fonts.uiMed,
              fontSize: 12,
              color: t.fg2,
              letterSpacing: -0.1,
              textAlign: 'center',
            }}>
            Pulling pieces that hold "{MOOD_LABEL.toLowerCase()}"
          </Text>
        </View>
      ) : itemCount === 0 ? (
        // Engine returned a non-error response with no garments. Surface a
        // soft empty state instead of an OutfitCard with no pieces. Codex
        // audit P2-1 (audit 3).
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 24, gap: 18 }}
          showsVerticalScrollIndicator={false}>
          <View style={{ alignItems: 'center', paddingVertical: 28, gap: 6 }}>
            <Eyebrow>No matching pieces</Eyebrow>
            <Text
              style={{
                fontFamily: fonts.ui,
                fontSize: 13.5,
                lineHeight: 20,
                color: t.fg2,
                textAlign: 'center',
                letterSpacing: -0.13,
                maxWidth: 260,
              }}>
              {result.description
                || `Your wardrobe doesn’t yet hold pieces that read “${MOOD_LABEL.toLowerCase()}”. Try another mood or add more garments.`}
            </Text>
          </View>
          <Button label="Restyle" variant="outline" onPress={restyle} block />
        </ScrollView>
      ) : (
        // ============ RESULT STATE ============
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 24, gap: 18 }}
          showsVerticalScrollIndicator={false}>
          <View>
            <Eyebrow style={{ marginBottom: 4 }}>Your mood outfit</Eyebrow>
            <PageTitle size={28}>{result.outfit_name}</PageTitle>
            {result.description ? (
              <Text
                style={{
                  fontFamily: fonts.ui,
                  fontSize: 13.5,
                  lineHeight: 20,
                  color: t.fg2,
                  marginTop: 8,
                  letterSpacing: -0.13,
                }}>
                {result.description}
              </Text>
            ) : null}
          </View>

          <OutfitCard
            name={result.outfit_name}
            sub={subLine}
            garments={(previewGarments ?? []).map((g) => ({
              id: g.id,
              rendered_image_path: g.rendered_image_path,
              original_image_path: g.original_image_path,
              image_path: g.image_path,
            }))}
          />

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            <Chip label={MOOD_LABEL} active />
            <Chip label={TIME_LABEL} />
            <Chip label={`${itemCount} pieces`} />
          </View>

          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button
              label={wearPending ? tr('moodFlow.wear.busy') : tr('moodFlow.wear.action')}
              onPress={handleWear}
              disabled={persistPending || wearPending || persistableItems.length === 0}
              block
              style={{ flex: 1 }}
            />
            <Button
              label={tr('moodFlow.restyle.action')}
              variant="outline"
              onPress={restyle}
              disabled={persistPending || wearPending}
            />
          </View>
          <Button
            label={
              savedOutfitId
                ? tr('moodFlow.save.saved')
                : persistPending
                  ? tr('moodFlow.save.busy')
                  : tr('moodFlow.save.action')
            }
            variant={savedOutfitId ? 'accent' : 'outline'}
            onPress={handleSave}
            disabled={!canSaveOrWear || persistPending}
            block
          />
        </ScrollView>
      )}
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
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
    paddingHorizontal: 32,
  },
});
