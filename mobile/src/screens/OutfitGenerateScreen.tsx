// Outfit-generation flow — 2 phases (loading → result).
// W4: wired to the real `burs_style_engine` edge function via
// useGenerateOutfit. Generation kicks on mount (anchor garmentId pulled from
// route params if present); "Try again" calls reset() then re-runs generate().
//
// The loading shell keeps the existing cycling-message + progress-bar
// affordance, but progress is now driven by the request lifecycle (animated
// to 90% then held until isLoading flips false).

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTokens } from '../theme/ThemeProvider';
import { fonts, radii } from '../theme/tokens';
import { Eyebrow } from '../components/Eyebrow';
import { PageTitle } from '../components/PageTitle';
import { Button } from '../components/Button';
import { Caption } from '../components/Caption';
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
import { useGarmentsByIds, type GarmentBasic } from '../hooks/useGarmentsByIds';
import { useMarkOutfitWorn, usePersistGeneratedOutfit } from '../hooks/useOutfits';
import { GarmentImageTile } from '../components/GarmentImageTile';
import { SUBSCRIPTION_SENTINEL } from '../lib/edgeFunctionClient';
import { applyAnchor } from '../lib/outfitAnchoring';
import { t as tr } from '../lib/i18n';
import { showToast } from '../lib/toast';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { OutfitGenerateLoading } from './OutfitGenerate/OutfitGenerateLoading';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'OutfitGenerate'>;

// Q-B — preview grid slot labels (rendered as a small caption overlay
// on each tile). The hue ramp that previously backed each cell was
// dropped in Q-B; real garment thumbnails now sit behind the labels via
// `useGarmentsByIds` + `GarmentImageTile` (same image-resolution chain
// the rest of the app uses).
const SLOT_LABELS = ['OUTER', 'TOP', 'BOTTOM', 'SHOES'];

export function OutfitGenerateScreen() {
  const t = useTokens();
  const insets = useSafeAreaInsets();
  const nav = useNavigation<Nav>();
  const route = useRoute<Route>();

  const { result, isLoading, error, anchorMissed, generate, reset } = useGenerateOutfit();
  const persistOutfit = usePersistGeneratedOutfit();
  const markWorn = useMarkOutfitWorn();
  const [savedOutfitId, setSavedOutfitId] = useState<string | null>(null);
  const paywallShownRef = useRef(false);

  // Re-arm Save when a fresh result lands (Try again replaces the in-memory
  // outfit, so the previous savedOutfitId no longer maps).
  useEffect(() => {
    if (result?.outfit_name) setSavedOutfitId(null);
  }, [result?.outfit_name]);

  // Behavior-preserving: in main, the success haptic fired from the parent's
  // `progressAnim` snap-to-100% effect once `isLoading` flipped false with a
  // non-null `result`. The loading shell is now an extracted sub-component
  // that unmounts the same render the orchestrator flips off the loading
  // branch, so its own snap-effect cleanup never reaches the "if (hasResult)
  // hapticSuccess()" branch. Mirror the haptic here so result-land still
  // produces the original tactile confirmation.
  const successHapticFiredRef = useRef(false);
  useEffect(() => {
    if (!isLoading && result && !successHapticFiredRef.current) {
      successHapticFiredRef.current = true;
      hapticSuccess();
    }
    if (isLoading) successHapticFiredRef.current = false;
  }, [isLoading, result]);
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
  // M17 Codex P1.4 — variation/clone entry points pass the FULL source
  // garment roster so the engine builds an outfit that honours every
  // piece, not just an anchor. The list is normalized (trimmed, empty
  // strings dropped) before being fed to the hook.
  const seedGarmentIds = useMemo(() => {
    const raw = route.params?.seedGarmentIds;
    if (!Array.isArray(raw)) return [] as string[];
    return raw
      .map((id) => (typeof id === 'string' ? id.trim() : ''))
      .filter((id) => id.length > 0);
  }, [route.params?.seedGarmentIds]);
  // Stable key for the deps list — referencing the array reference
  // directly would re-fire the effect on every render because route
  // params re-create the array.
  const seedGarmentIdsKey = seedGarmentIds.join(',');
  const anchorGarmentQ = useGarment(anchorId);
  const anchorGarment = anchorGarmentQ.data ?? null;
  const lockedSlots = useMemo(
    () => (anchorGarment ? applyAnchor([anchorGarment], anchorId) : {}),
    [anchorGarment, anchorId],
  );

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
    void generate({
      anchorGarmentId: anchorId,
      lockedSlots,
      preferGarmentIds: seedGarmentIds,
    });
    return () => {
      // Skip the reset on success-nav unmounts (e.g. nav.navigate to
      // OutfitDetail) so a swipe-back lands on the still-populated result.
      // The generate-on-anchor-change path explicitly clears succeededRef
      // above so a true re-run still tears down stale state. Codex P2 on
      // PR #738.
      if (!succeededRef.current) reset();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchorId, seedGarmentIdsKey]);

  useEffect(() => {
    // Route to the real PaywallScreen instead of popping an Alert each time
    // the engine returns `subscription_required`. The previous version
    // re-popped the alert every time the user tapped Restyle / Try again
    // after a dismiss — App Store reviewers flag this as harassing UX.
    // The ref stays sticky for the screen's lifetime.
    if (error === SUBSCRIPTION_SENTINEL && !paywallShownRef.current) {
      paywallShownRef.current = true;
      nav.navigate('Paywall');
    }
  }, [error, nav]);

  const itemCount = result?.items.length ?? 0;
  const subLine = useMemo(() => {
    if (!result) return '';
    return `${itemCount} PIECE${itemCount === 1 ? '' : 'S'} · ${result.outfit_name.toUpperCase()}`;
  }, [result, itemCount]);

  const tryAgain = () => {
    hapticLight();
    reset();
    void generate({
      anchorGarmentId: anchorId,
      lockedSlots,
      preferGarmentIds: seedGarmentIds,
    });
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

  // Items shape persistence accepts. Drops anything missing garment_id (the
  // engine occasionally returns a partial slot); saving an empty outfit
  // would just error inside the hook.
  const persistableItems = useMemo(
    () =>
      (result?.items ?? [])
        .filter((it): it is { garment_id: string; slot: string; title: string; image_path?: string; color?: string } =>
          typeof it.garment_id === 'string' && it.garment_id.length > 0,
        )
        .map((it) => ({ garment_id: it.garment_id, slot: it.slot ?? '' })),
    [result?.items],
  );

  // Q-B — hydrate the result's garment ids so the 2×2 preview tiles can
  // surface real signed-URL photos instead of the deprecated hue swatch.
  // Mirrors `OutfitSuggestionCard`'s pattern: pass the raw ids to
  // `useGarmentsByIds` and read the resolved rows back in render order.
  // The result-tile garment is found by index against `persistableItems`,
  // so a deleted-out-from-under-us piece falls back to the neutral
  // tile (GarmentImageTile renders an empty-bg Tshirt-icon when
  // `garment` is null).
  const previewIds = useMemo(
    () => persistableItems.map((it) => it.garment_id),
    [persistableItems],
  );
  const { data: previewGarments } = useGarmentsByIds(previewIds);
  const previewGarmentBySlot = useMemo(() => {
    const map = new Map<string, GarmentBasic>();
    if (!previewGarments) return map;
    for (const g of previewGarments) {
      map.set(g.id, g);
    }
    return map;
  }, [previewGarments]);

  const persistPending = persistOutfit.isPending;
  const wearPending = markWorn.isPending;

  const persistArgs = result
    ? {
        occasion: result.occasion ?? null,
        explanation: result.description ?? '',
        familyLabel: result.outfit_name ?? null,
        items: persistableItems,
      }
    : null;

  const handleSave = () => {
    if (!result || !persistArgs || persistPending || savedOutfitId) return;
    if (persistableItems.length === 0) {
      showToast(
        'error',
        tr('outfitGenerate.save.empty.title'),
        tr('outfitGenerate.save.empty.body'),
      );
      return;
    }
    hapticLight();
    // Mark success BEFORE firing the mutation so a back-swipe during the
    // in-flight window doesn't let the cleanup `reset()` wipe `result`.
    // Same contract as `navigateToWornOutfit` and the M17 precedent that
    // guarded against unmount-mid-save losing the user's work. If the
    // mutation fails the toast surfaces the error and the user can retry —
    // leaving succeededRef true is benign because the screen still holds
    // the (un-persisted) result.
    succeededRef.current = true;
    persistOutfit.mutate(persistArgs, {
      onSuccess: ({ outfitId }) => {
        hapticSuccess();
        setSavedOutfitId(outfitId);
        showToast(
          'success',
          tr('outfitGenerate.save.success.title'),
          tr('outfitGenerate.save.success.body'),
        );
      },
      onError: (err) => {
        showToast(
          'error',
          tr('outfitGenerate.save.failed.title'),
          err instanceof Error ? err.message : String(err),
        );
      },
    });
  };

  const navigateToWornOutfit = (outfitId: string) => {
    succeededRef.current = true;
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
            tr('outfitGenerate.wear.failed.title'),
            err instanceof Error ? err.message : String(err),
          );
        },
      },
    );
  };

  // Q-B — "Plan for a date" handler. Persists the outfit if it isn't
  // already saved, then navigates to OutfitDetail with `openPlanner: true`
  // so the date-picker sheet auto-mounts. `preselectDate` carries the
  // route-level `initialDate` through so the sheet opens on the date the
  // user picked back on PlanScreen (when entering via the empty-state
  // CTA). When `initialDate` is undefined, the sheet defaults to today
  // inside `DatePickerSheet`.
  const handlePlan = () => {
    if (!result || persistPending) return;
    const existing = savedOutfitId ?? result.outfit_id ?? null;
    const preselectDate = route.params?.initialDate;
    if (existing) {
      hapticLight();
      succeededRef.current = true;
      nav.navigate('OutfitDetail', {
        id: existing,
        openPlanner: true,
        preselectDate,
      });
      return;
    }
    if (!persistArgs || persistableItems.length === 0) {
      showToast(
        'error',
        tr('outfitGenerate.save.empty.title'),
        tr('outfitGenerate.save.empty.body'),
      );
      return;
    }
    hapticLight();
    persistOutfit.mutate(persistArgs, {
      onSuccess: ({ outfitId }) => {
        setSavedOutfitId(outfitId);
        succeededRef.current = true;
        nav.navigate('OutfitDetail', {
          id: outfitId,
          openPlanner: true,
          preselectDate,
        });
      },
      onError: (err) => {
        showToast(
          'error',
          tr('outfitGenerate.plan.failed.title'),
          err instanceof Error ? err.message : String(err),
        );
      },
    });
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
      showToast(
        'error',
        tr('outfitGenerate.save.empty.title'),
        tr('outfitGenerate.save.empty.body'),
      );
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
          tr('outfitGenerate.wear.failed.title'),
          err instanceof Error ? err.message : String(err),
        );
      },
    });
  };

  if (error === SUBSCRIPTION_SENTINEL) {
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

  // N3.10 F-008 — explicit null-result guard. The existing nested ternary
  // below technically narrows correctly (`isLoading || !result` is the
  // first branch), but a future edit could reorder the conditions and
  // surface the success branch with `result === null` — the
  // `result.outfit_name` access would crash. This early return makes the
  // contract obvious: nothing past here renders without a non-null result.
  if (!result || isLoading) {
    return (
      <OutfitGenerateLoading
        isLoading={isLoading}
        onClose={() => nav.goBack()}
      />
    );
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={s.header}>
        <IconBtn ariaLabel="Close" onPress={() => { hapticLight(); nav.goBack(); }}>
          <CloseIcon color={t.fg} />
        </IconBtn>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Eyebrow>Your new look</Eyebrow>
          <PageTitle style={{ marginTop: 4 }}>New look</PageTitle>
        </View>
        <View style={{ width: 36 }} />
      </View>

      {anchorId && (anchorMissed || itemCount === 0) ? (
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

          {/* Q-B — 2×2 preview grid with real garment thumbnails.
              `GarmentImageTile` resolves the canonical image chain
              (rendered_image_path → original_image_path → image_path)
              and falls back to the neutral Tshirt-icon tile when a
              piece is unhydrated or deleted, so the visual rhythm
              holds while data is in flight. Slot caption stays as a
              small bottom-left label so the user knows which slot is
              which without hovering. */}
          <View style={s.grid}>
            {[0, 1, 2, 3].map((i) => {
              const item = result.items[i];
              const garmentId = item?.garment_id;
              const garment = garmentId ? previewGarmentBySlot.get(garmentId) ?? null : null;
              return (
                <View
                  key={i}
                  style={[
                    s.gridCell,
                    {
                      borderColor: t.border,
                    },
                  ]}>
                  <GarmentImageTile garment={garment} iconSize={26} />
                  <Text
                    style={{
                      fontFamily: fonts.uiSemi,
                      fontSize: 9,
                      letterSpacing: 1.2,
                      color: t.fg,
                      opacity: 0.7,
                      position: 'absolute',
                      bottom: 10,
                      left: 10,
                      backgroundColor: t.card,
                      paddingHorizontal: 6,
                      paddingVertical: 2,
                      borderRadius: radii.pill,
                    }}>
                    {item?.slot?.toUpperCase() ?? SLOT_LABELS[i]}
                  </Text>
                </View>
              );
            })}
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
            label={wearPending ? tr('outfitGenerate.wear.busy') : tr('outfitGenerate.wear.action')}
            onPress={handleWear}
            disabled={persistPending || wearPending || persistableItems.length === 0}
            block
            style={{ marginTop: 8 }}
          />
          {/* Q-B — Plan for a date. Persists the outfit if needed then
              navigates to OutfitDetail with the planner sheet auto-open,
              pre-selected on `initialDate` (carried forward from
              PlanScreen's empty-state CTA when applicable). */}
          <Button
            label={tr('outfitGenerate.plan.action')}
            variant="outline"
            onPress={handlePlan}
            disabled={persistPending || wearPending || persistableItems.length === 0}
            block
          />
          <Button
            label={
              savedOutfitId
                ? tr('outfitGenerate.save.saved')
                : persistPending
                  ? tr('outfitGenerate.save.busy')
                  : tr('outfitGenerate.save.action')
            }
            variant={savedOutfitId ? 'accent' : 'outline'}
            onPress={handleSave}
            disabled={persistPending || Boolean(savedOutfitId) || persistableItems.length === 0}
            block
          />
          <Button label="Try again" variant="quiet" onPress={tryAgain} block />
          {/* M16 — pool entry. Reuses the same anchor / occasion as the
              single-outfit call so a Restyle-from-piece flow can pivot to
              a 5-shot pool without re-collecting context. The caption
              clarifies the visual hierarchy — this CTA is a secondary
              "want more options?" path, not a peer of the preview-only
              Wear/Save/Try again actions above. */}
          <Caption style={{ marginTop: 8, textAlign: 'center' }}>
            Want more options? Generate a pool of looks.
          </Caption>
          <Button
            label="Generate pool"
            variant="outline"
            onPress={() => {
              hapticLight();
              nav.navigate('OutfitPool', {
                anchorGarmentId: anchorId,
                occasion: result.occasion,
              });
            }}
            block
          />
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
