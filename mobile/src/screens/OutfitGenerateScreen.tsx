// Outfit-generation flow — 2 phases (loading → result).
// W4: wired to the real `burs_style_engine` edge function via
// useGenerateOutfit. Generation kicks on mount (anchor garmentId pulled from
// route params if present); "Try again" calls reset() then re-runs generate().
//
// The loading shell keeps the existing cycling-message + progress-bar
// affordance, but progress is now driven by the request lifecycle (animated
// to 90% then held until isLoading flips false).

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, Easing, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTokens } from '../theme/ThemeProvider';
import { fonts, radii } from '../theme/tokens';
import { Eyebrow } from '../components/Eyebrow';
import { PageTitle } from '../components/PageTitle';
import { Button } from '../components/Button';
import { IconBtn } from '../components/IconBtn';
import { ErrorState } from '../components/ErrorState';
import { CloseIcon } from '../components/icons';
import { hapticLight, hapticSuccess } from '../lib/haptics';
import {
  useGenerateOutfit,
  ANCHOR_MISSED_ERROR,
  INVALID_OUTFIT_ERROR,
} from '../hooks/useGenerateOutfit';
import { useGarment } from '../hooks/useGarments';
import { applyAnchor } from '../lib/outfitAnchoring';
import { t as tr } from '../lib/i18n';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'OutfitGenerate'>;

const LOADING_MESSAGES = [
  'Reading your wardrobe…',
  'Checking the weather…',
  'Finding the right pieces…',
  'Almost there…',
] as const;

// Stable visual hue ramp for the 4-cell preview grid. Real garment images
// land in W9 — for now we render a neutral palette keyed off slot.
const PLACEHOLDER_HUES: [number, number, number, number] = [32, 18, 200, 45];
const SLOT_LABELS = ['OUTER', 'TOP', 'BOTTOM', 'SHOES'];

export function OutfitGenerateScreen() {
  const t = useTokens();
  const insets = useSafeAreaInsets();
  const nav = useNavigation<Nav>();
  const route = useRoute<Route>();

  const { result, isLoading, error, anchorMissed, generate, reset } = useGenerateOutfit();
  const [messageIdx, setMessageIdx] = useState(0);
  const paywallShownRef = useRef(false);
  // Tracks whether the screen produced a usable result before unmount. The
  // cleanup `reset()` only fires when this is false — i.e. on real abandon
  // paths (close button, back swipe before result, anchor change). When
  // the user navigates forward to OutfitDetail (success path) and later
  // returns, we want to preserve the generated result so the screen
  // doesn't sit on a cleared state and burn a re-generation. Codex P2
  // on PR #738.
  const succeededRef = useRef(false);

  // M13: anchor metadata for the lock pill + status row. The route param
  // carries the anchor id; the garment record gives us the title/category
  // for the human-readable affordance and the lockedSlots constraint.
  const anchorId = route.params?.garmentId?.trim() || undefined;
  const anchorGarmentQ = useGarment(anchorId);
  const anchorGarment = anchorGarmentQ.data ?? null;
  const lockedSlots = useMemo(
    () => (anchorGarment ? applyAnchor([anchorGarment], anchorId) : {}),
    [anchorGarment, anchorId],
  );

  const spinAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Loading-phase predicate — drives both whether to render the spinner
  // and whether to keep its rotation animation running. Without this gate,
  // the loop animation kept ticking after the screen flipped to error or
  // result state. Codex audit P1-2 (audit 2).
  const isInLoadingPhase = (isLoading || !result) && !error;

  // Spinner rotation — only runs during the loading phase.
  useEffect(() => {
    if (!isInLoadingPhase) return;
    const loop = Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 1100,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [isInLoadingPhase, spinAnim]);

  // Kick generation on mount + when the anchor garment changes. M13: pass
  // the anchor as `anchorGarmentId` (the legacy `garmentId` field is still
  // accepted by the hook but the new one carries the lock-intent semantics)
  // alongside the slot constraints derived from the anchor itself.
  //
  // `lockedSlots` is intentionally excluded from the dep list — the hook
  // doesn't currently ship it through to `burs_style_engine` (the engine
  // only consumes `prefer_garment_ids`), and `lockedSlots` mutates from
  // `{}` to the real map once `useGarment(anchorId)` resolves, which
  // would otherwise abort the in-flight generation and re-fire a second
  // identical request — duplicate spend + a momentary loading flash for
  // the user. Codex P2 round 1 on PR #737. When the engine grows a
  // `locked_slots` field this effect's deps + the hook body need to stay
  // in sync; the current value is read from the latest closure on the
  // `tryAgain` path so manual retries still see the fresh map.
  useEffect(() => {
    succeededRef.current = false;
    void generate({ anchorGarmentId: anchorId, lockedSlots });
    return () => {
      // Skip the reset on success-nav unmounts (e.g. nav.navigate to
      // OutfitDetail) so a swipe-back lands on the still-populated result.
      // The generate-on-anchor-change path explicitly clears succeededRef
      // above so a true re-run still tears down stale state. Codex P2 on
      // PR #738.
      if (!succeededRef.current) reset();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchorId]);

  // Drive the loading affordance off the request lifecycle. Progress climbs
  // to 90% over 2s then holds; we snap to 100% on completion.
  useEffect(() => {
    if (!isLoading) {
      Animated.timing(progressAnim, {
        toValue: 1,
        duration: 240,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false,
      }).start(() => {
        if (result) hapticSuccess();
      });
      return;
    }
    progressAnim.setValue(0);
    setMessageIdx(0);
    Animated.timing(progressAnim, {
      toValue: 0.9,
      duration: 2000,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
    const interval = setInterval(() => {
      setMessageIdx((i) => (i + 1) % LOADING_MESSAGES.length);
    }, 600);
    return () => clearInterval(interval);
  }, [isLoading, result, progressAnim]);

  useEffect(() => {
    // Route to the real PaywallScreen instead of popping an Alert each time
    // the engine returns `subscription_required`. The previous version
    // re-popped the alert every time the user tapped Restyle / Try again
    // after a dismiss — App Store reviewers flag this as harassing UX.
    // The ref stays sticky for the screen's lifetime.
    if (error === 'subscription_required' && !paywallShownRef.current) {
      paywallShownRef.current = true;
      nav.navigate('Paywall');
    }
  }, [error, nav]);

  const spin = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const progressWidth = progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  const itemCount = result?.items.length ?? 0;
  const subLine = useMemo(() => {
    if (!result) return '';
    return `${itemCount} PIECE${itemCount === 1 ? '' : 'S'} · ${result.outfit_name.toUpperCase()}`;
  }, [result, itemCount]);

  const tryAgain = () => {
    hapticLight();
    reset();
    void generate({ anchorGarmentId: anchorId, lockedSlots });
  };

  // M13: clear the anchor and regenerate without it. Resetting the route
  // param is the cleanest signal — the [anchorId]-keyed effect re-fires
  // with `anchorGarmentId: undefined`, the screen's anchor pill disappears,
  // and any subsequent "Try again" stays unanchored too. Codex P2 round 6
  // on PR #737 — without this control the wave's "tap remove anchor"
  // acceptance gate isn't reachable.
  const removeAnchor = () => {
    hapticLight();
    reset();
    nav.setParams({ garmentId: undefined });
  };

  if (error === 'subscription_required') {
    // Paywall path — without an explicit branch the screen would sit
    // forever on the spinner (isLoading=false, result=null). Codex audit
    // P0-1 (audit 3).
    return (
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
        <View style={s.header}>
          <IconBtn ariaLabel="Close" onPress={() => { hapticLight(); nav.goBack(); }}>
            <CloseIcon color={t.fg} />
          </IconBtn>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Eyebrow>Premium feature</Eyebrow>
            <PageTitle style={{ marginTop: 4 }}>New look</PageTitle>
          </View>
          <View style={{ width: 36 }} />
        </View>
        <View style={s.loadingShell}>
          <Text
            style={{
              fontFamily: fonts.displayMedium,
              fontStyle: 'italic',
              fontSize: 18,
              color: t.fg,
              textAlign: 'center',
              letterSpacing: -0.18,
            }}>
            Outfit generation is part of BURS Premium
          </Text>
          <Text
            style={{
              marginTop: 8,
              fontFamily: fonts.uiMed,
              fontSize: 12,
              color: t.fg2,
              letterSpacing: -0.1,
              textAlign: 'center',
            }}>
            Upgrade to keep generating looks.
          </Text>
          <View style={{ marginTop: 18 }}>
            <Button label="Back" variant="outline" onPress={() => nav.goBack()} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    const isAnchorMiss = error === ANCHOR_MISSED_ERROR;
    const isInvalidOutfit = error === INVALID_OUTFIT_ERROR;
    const eyebrow = isAnchorMiss
      ? tr('anchor.missed.eyebrow')
      : isInvalidOutfit
        ? tr('outfit.invalid.eyebrow')
        : 'Generation failed';
    const title = isAnchorMiss
      ? tr('anchor.missed.errorTitle')
      : isInvalidOutfit
        ? tr('outfit.invalid.errorTitle')
        : "Couldn't build your outfit";
    const body = isAnchorMiss
      ? anchorGarment?.title
        ? tr('anchor.missed.errorBody', { title: anchorGarment.title })
        : tr('anchor.missed.errorBodyFallback')
      : isInvalidOutfit
        ? tr('outfit.invalid.errorBody')
        : error;
    return (
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
        <View style={s.header}>
          <IconBtn ariaLabel="Close" onPress={() => { hapticLight(); nav.goBack(); }}>
            <CloseIcon color={t.fg} />
          </IconBtn>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Eyebrow>{eyebrow}</Eyebrow>
            <PageTitle style={{ marginTop: 4 }}>New look</PageTitle>
          </View>
          <View style={{ width: 36 }} />
        </View>
        <ErrorState title={title} body={body} onRetry={tryAgain} />
        {anchorId ? (
          <View style={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 16 }}>
            <Button label={tr('anchor.removeAnchor')} variant="quiet" onPress={removeAnchor} block />
          </View>
        ) : null}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={s.header}>
        <IconBtn ariaLabel="Close" onPress={() => { hapticLight(); nav.goBack(); }}>
          <CloseIcon color={t.fg} />
        </IconBtn>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Eyebrow>{isLoading || !result ? 'Generating' : 'Your new look'}</Eyebrow>
          <PageTitle style={{ marginTop: 4 }}>New look</PageTitle>
        </View>
        <View style={{ width: 36 }} />
      </View>

      {isLoading || !result ? (
        <View style={s.loadingShell}>
          <Animated.View
            style={[
              s.spinner,
              {
                borderColor: t.border,
                borderTopColor: t.accent,
                transform: [{ rotate: spin }],
              },
            ]}
          />
          <Text
            style={{
              marginTop: 28,
              fontFamily: fonts.displayMedium,
              fontStyle: 'italic',
              fontSize: 18,
              color: t.fg,
              textAlign: 'center',
              letterSpacing: -0.18,
            }}>
            {LOADING_MESSAGES[messageIdx]}
          </Text>
          <View style={[s.progressTrack, { backgroundColor: t.border, marginTop: 24 }]}>
            <Animated.View
              style={[s.progressFill, { backgroundColor: t.accent, width: progressWidth }]}
            />
          </View>
        </View>
      ) : anchorId && (anchorMissed || itemCount === 0) ? (
        // Anchor-missed UX takes precedence over the generic empty state.
        // Two cases land here:
        //   • `anchorMissed` flipped true after the hook validated the
        //     returned items and the anchor wasn't among them.
        //   • `itemCount === 0` with an anchor set — the engine couldn't
        //     compose a viable outfit honouring the anchor and returned no
        //     items. Without this branch the screen would land on the
        //     generic empty-state and "Try again" would loop with the same
        //     anchor indefinitely. The "Remove anchor" CTA below lets the
        //     user clear the lock and retry unanchored. Codex P2 on PR #738.
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: 8,
            paddingBottom: insets.bottom + 32,
            gap: 14,
          }}
          showsVerticalScrollIndicator={false}>
          <View style={{ alignItems: 'center', paddingVertical: 32, gap: 6 }}>
            <Eyebrow>{tr('anchor.missed.eyebrow')}</Eyebrow>
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
              {anchorGarment?.title
                ? tr('anchor.missed.errorBody', { title: anchorGarment.title })
                : tr('anchor.missed.errorBodyFallback')}
            </Text>
          </View>
          <Button label="Try again" variant="outline" onPress={tryAgain} block />
          <Button label={tr('anchor.removeAnchor')} variant="quiet" onPress={removeAnchor} block />
        </ScrollView>
      ) : itemCount === 0 ? (
        // Engine returned a non-error response with no garments. Surface a
        // soft empty state instead of rendering 4 empty placeholder tiles.
        // Codex audit P2-1 (audit 3).
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: 8,
            paddingBottom: insets.bottom + 32,
            gap: 14,
          }}
          showsVerticalScrollIndicator={false}>
          <View style={{ alignItems: 'center', paddingVertical: 32, gap: 6 }}>
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
                || 'Your wardrobe doesn’t yet cover this look. Add more garments or try a different anchor.'}
            </Text>
          </View>
          <Button label="Try again" variant="outline" onPress={tryAgain} block />
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: 8,
            paddingBottom: insets.bottom + 32,
            gap: 14,
          }}
          showsVerticalScrollIndicator={false}>
          <PageTitle style={{ textAlign: 'center', fontSize: 24 }}>{result.outfit_name}</PageTitle>

          {/* M13 — anchor lock status. Renders only when an anchor was
              requested. The "missed" branch surfaces when the engine
              dropped the anchor despite prefer_garment_ids; CTA below
              becomes "Try again" (the existing button at the bottom),
              which preserves the anchor on retry. */}
          {anchorId ? (
            <View
              style={[
                s.anchorRow,
                {
                  backgroundColor: anchorMissed ? t.bg2 : t.card,
                  borderColor: anchorMissed ? t.destructive : t.accent,
                },
              ]}>
              <Text style={[s.anchorEyebrow, { color: anchorMissed ? t.destructive : t.accent }]}>
                {tr(anchorMissed ? 'anchor.missed.eyebrow' : 'anchor.locked.eyebrow')}
              </Text>
              <Text style={[s.anchorTitle, { color: t.fg }]} numberOfLines={1}>
                {anchorGarment?.title ?? tr('anchor.locked.fallback')}
              </Text>
            </View>
          ) : null}

          {/* 2x2 grid — placeholder hues until real garment images land. */}
          <View style={s.grid}>
            {[0, 1, 2, 3].map((i) => (
              <View
                key={i}
                style={[
                  s.gridCell,
                  {
                    backgroundColor: `hsl(${PLACEHOLDER_HUES[i]}, 22%, 78%)`,
                    borderColor: t.border,
                  },
                ]}>
                <Text
                  style={{
                    fontFamily: fonts.uiSemi,
                    fontSize: 9,
                    letterSpacing: 1.2,
                    color: t.fg,
                    opacity: 0.55,
                    position: 'absolute',
                    bottom: 10,
                    left: 10,
                  }}>
                  {result.items[i]?.slot?.toUpperCase() ?? SLOT_LABELS[i]}
                </Text>
              </View>
            ))}
          </View>

          <View style={s.chipRow}>
            {result.occasion ? <ChipPill label={result.occasion} /> : null}
            {result.formality ? <ChipPill label={result.formality} /> : null}
            <ChipPill label={subLine} />
          </View>

          {result.description ? (
            <Text
              style={{
                fontFamily: fonts.display,
                fontStyle: 'italic',
                fontSize: 14.5,
                lineHeight: 22,
                color: t.fg2,
                marginTop: 4,
              }}>
              {result.description}
            </Text>
          ) : null}

          <Button
            label="Wear today"
            onPress={() => {
              hapticLight();
              if (result.outfit_id) {
                // Mark success BEFORE nav so the cleanup effect (fired on
                // unmount when the new screen mounts) keeps the result
                // intact for the back-swipe return path. Codex P2 on PR #738.
                succeededRef.current = true;
                nav.navigate('OutfitDetail', { id: result.outfit_id });
              } else {
                Alert.alert(
                  'Saved as preview',
                  'Persistent saving lands in a future update. For now this is a preview.',
                );
              }
            }}
            block
            style={{ marginTop: 8 }}
          />
          <Button
            label="Save outfit"
            variant="outline"
            onPress={() =>
              Alert.alert(
                'Saved as preview',
                'Persistent saving lands in a future update. For now this is a preview.',
              )
            }
            block
          />
          <Button label="Try again" variant="quiet" onPress={tryAgain} block />
          {/* M13 — clear the lock and regenerate without it. Hidden when
              there's no anchor in the first place. Codex P2 round 6. */}
          {anchorId ? (
            <Button label={tr('anchor.removeAnchor')} variant="outline" onPress={removeAnchor} block />
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function ChipPill({ label }: { label: string }) {
  const t = useTokens();
  return (
    <View
      style={{
        height: 26,
        paddingHorizontal: 12,
        borderRadius: radii.pill,
        borderWidth: 1,
        borderColor: t.border,
        backgroundColor: t.card,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Text
        style={{
          fontFamily: fonts.uiSemi,
          fontSize: 10.5,
          letterSpacing: 1.4,
          textTransform: 'uppercase',
          color: t.fg,
        }}>
        {label}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 10,
  },
  loadingShell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  spinner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
  },
  progressTrack: {
    width: '70%',
    height: 3,
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  gridCell: {
    width: '48.5%',
    aspectRatio: 0.85,
    borderRadius: radii.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  anchorRow: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: 2,
  },
  anchorEyebrow: {
    fontFamily: fonts.uiSemi,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  anchorTitle: {
    fontFamily: fonts.uiMed,
    fontSize: 13,
    letterSpacing: -0.13,
  },
});
