// Outfit-generation flow — 2 phases (loading → result).
// W4: wired to the real `burs_style_engine` edge function via
// useGenerateOutfit. Generation kicks on mount (anchor garmentId pulled from
// route params if present); "Try again" calls reset() then re-runs generate().
//
// The loading shell keeps the existing cycling-message + progress-bar
// affordance, but progress is now driven by the request lifecycle (animated
// to 90% then held until isLoading flips false).

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTokens } from '../theme/ThemeProvider';
import { Eyebrow } from '../components/Eyebrow';
import { PageTitle } from '../components/PageTitle';
import { IconBtn } from '../components/IconBtn';
import { CloseIcon } from '../components/icons';
import { hapticLight, hapticSuccess } from '../lib/haptics';
import {
  useGenerateOutfit,
  ANCHOR_MISSED_ERROR,
  INVALID_OUTFIT_ERROR,
} from '../hooks/useGenerateOutfit';
import { useGarment } from '../hooks/useGarments';
import { useGarmentsByIds, type GarmentBasic } from '../hooks/useGarmentsByIds';
import { SUBSCRIPTION_SENTINEL } from '../lib/edgeFunctionClient';
import { applyAnchor } from '../lib/outfitAnchoring';
import { t as tr } from '../lib/i18n';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { OutfitGenerateLoading } from './OutfitGenerate/OutfitGenerateLoading';
import { OutfitGenerateResult } from './OutfitGenerate/OutfitGenerateResult';
import {
  OutfitGenerateErrorShell,
  OutfitGeneratePaywallShell,
} from './OutfitGenerate/OutfitGenerateErrorShell';
import { useOutfitGenerateActions } from './OutfitGenerate/useOutfitGenerateActions';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'OutfitGenerate'>;

export function OutfitGenerateScreen() {
  const t = useTokens();
  const nav = useNavigation<Nav>();
  const route = useRoute<Route>();

  const { result, isLoading, error, anchorMissed, generate, reset } = useGenerateOutfit();
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

  const { persistPending, wearPending, handleSave, handlePlan, handleWear } =
    useOutfitGenerateActions({
      nav,
      result,
      persistableItems,
      savedOutfitId,
      setSavedOutfitId,
      preselectDate: route.params?.initialDate,
      markSucceeded: () => {
        succeededRef.current = true;
      },
    });

  if (error === SUBSCRIPTION_SENTINEL) {
    // Paywall path — without an explicit branch the screen would sit
    // forever on the spinner (isLoading=false, result=null). Codex audit
    // P0-1 (audit 3).
    return (
      <OutfitGeneratePaywallShell
        onClose={() => nav.goBack()}
        onBack={() => nav.goBack()}
      />
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
      <OutfitGenerateErrorShell
        onClose={() => nav.goBack()}
        eyebrow={eyebrow}
        title={title}
        body={body}
        onRetry={tryAgain}
        showRemoveAnchor={Boolean(anchorId)}
        onRemoveAnchor={removeAnchor}
      />
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

      <OutfitGenerateResult
        anchorId={anchorId}
        anchorMissed={anchorMissed}
        anchorGarmentTitle={anchorGarment?.title}
        itemCount={itemCount}
        outfitName={result.outfit_name}
        description={result.description}
        occasion={result.occasion}
        formality={result.formality}
        subLine={subLine}
        items={result.items}
        previewGarmentBySlot={previewGarmentBySlot}
        persistableItemsCount={persistableItems.length}
        persistPending={persistPending}
        wearPending={wearPending}
        savedOutfitId={savedOutfitId}
        onTryAgain={tryAgain}
        onRemoveAnchor={removeAnchor}
        onWear={handleWear}
        onPlan={handlePlan}
        onSave={handleSave}
        onGeneratePool={() => {
          hapticLight();
          nav.navigate('OutfitPool', {
            anchorGarmentId: anchorId,
            occasion: result.occasion,
          });
        }}
      />
    </SafeAreaView>
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
});
