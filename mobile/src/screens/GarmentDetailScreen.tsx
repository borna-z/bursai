// Garment detail — opened from any garment card or list row.
// Layout (top→bottom): header (back · eyebrow + italic title · edit + more) · hero image
// (aspect 0.78, radius 18) with Studio badge top-left + wear count badge top-right · 3-tab strip
// (Info / Outfits / Similar) · tab body · sticky "Wear today" CTA at the bottom safe area.
//
// W2 wires real Supabase data via useGarment + useSignedUrl + useMarkWorn / useMarkLaundry /
// useDeleteGarment mutations. The Outfits and Similar tabs intentionally render empty
// placeholders pending Wave 9 hooks — fixture data was removed per the "no mock garment data
// in wired screens" rule.
//
// Phase 3 modularization: the tab body + condition detail sheet live in
// `./GarmentDetail/GarmentDetailTabs`. The mark-worn / mark-laundry /
// delete / edit-navigate handlers + the More-options Alert prompt live
// in `./GarmentDetail/GarmentActionSheet` (as a `useGarmentActions`
// hook). The orchestrator keeps route handling, data fetch, the hero
// image header, the paywall latch effect, and the sticky-bar CTA.

import React from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Crypto from 'expo-crypto';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { log } from '../lib/log';
import { useTokens } from '../theme/ThemeProvider';
import { fonts } from '../theme/tokens';
import { Eyebrow } from '../components/Eyebrow';
import { Button } from '../components/Button';
import { IconBtn } from '../components/IconBtn';
import { Caption } from '../components/Caption';
import { ErrorState } from '../components/ErrorState';
import { BackIcon, EditIcon, MoreIcon } from '../components/icons';
import { useGarment } from '../hooks/useGarments';
import { useNow } from '../hooks/useNow';
import { useAssessCondition, type ConditionAssessment } from '../hooks/useAssessCondition';
import { useGenerateGarmentImage } from '../hooks/useGenerateGarmentImage';
import { useRetryGarmentRender } from '../hooks/useRetryGarmentRender';
import { isActiveGarmentRenderStatus, useRenderJobStatus } from '../hooks/useRenderJobStatus';
import { SUBSCRIPTION_SENTINEL } from '../lib/edgeFunctionClient';
import { localISODate } from '../lib/outfitDisplay';
import { hapticLight } from '../lib/haptics';
import { t as tr } from '../lib/i18n';
import type { Garment } from '../types/garment';
import type { RootStackParamList } from '../navigation/RootNavigator';
import {
  GarmentDetailTabs,
  type GarmentDetailTab,
  type InfoField,
} from './GarmentDetail/GarmentDetailTabs';
import { useGarmentActions } from './GarmentDetail/GarmentActionSheet';
import { GarmentDetailHero, type GarmentDetailHeroBadge } from './GarmentDetail/GarmentDetailHero';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'GarmentDetail'>;

// Calendar-day diff via `localISODate` rather than ms-subtraction. The old
// `(Date.now() - ms) / 86400000 | 0` shape mis-counts on DST transition days
// (a wear logged 23 calendar hours ago can read "0 days" or "2 days" depending
// on the spring-forward / fall-back direction). Codex P2 on PR #738.
function formatLastWorn(iso: string | null | undefined): string {
  if (!iso) return 'Never';
  const wornAt = new Date(iso);
  if (Number.isNaN(wornAt.getTime())) return '—';
  const wornIso = localISODate(wornAt);
  const today = new Date();
  const todayIso = localISODate(today);
  if (wornIso >= todayIso) return 'Today';
  // Walk back one local day at a time off `today` until we hit the worn iso.
  // Capped at 30 to bound the loop on extreme staleness — beyond a month we
  // bail out to the locale date format below anyway.
  for (let i = 1; i <= 30; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    if (localISODate(d) === wornIso) {
      if (i === 1) return 'Yesterday';
      return `${i} days ago`;
    }
  }
  // Beyond a month, show the date in the user's locale.
  return wornAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatPrice(value: number | null | undefined, currency: string | null | undefined): string | null {
  if (value == null) return null;
  const code = currency ?? 'EUR';
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: code }).format(value);
  } catch (err) {
    log.error(err, { context: 'GarmentDetailScreen.format_price_failed' });
    return `${value} ${code}`;
  }
}

function buildInfoFields(garment: Garment): InfoField[] {
  const fields: InfoField[] = [];
  const cat = [garment.category, garment.subcategory].filter(Boolean).join(' · ');
  if (cat) fields.push({ label: 'Category', value: cat });
  if (garment.color_primary) fields.push({ label: 'Color', value: garment.color_primary });
  if (garment.material) fields.push({ label: 'Material', value: garment.material });
  if (garment.fit) fields.push({ label: 'Fit', value: garment.fit });
  if (garment.pattern) fields.push({ label: 'Pattern', value: garment.pattern });
  const seasons = (garment.season_tags ?? []).filter(Boolean);
  if (seasons.length) fields.push({ label: 'Season', value: seasons.join(' · ') });
  fields.push({ label: 'Wear count', value: String(garment.wear_count ?? 0) });
  fields.push({ label: 'Last worn', value: formatLastWorn(garment.last_worn_at) });
  const price = formatPrice(garment.purchase_price, garment.purchase_currency);
  if (price) fields.push({ label: 'Price', value: price });
  if (garment.purchase_price && (garment.wear_count ?? 0) > 0) {
    const cpw = garment.purchase_price / (garment.wear_count ?? 1);
    const cpwFmt = formatPrice(cpw, garment.purchase_currency);
    if (cpwFmt) fields.push({ label: 'Cost per wear', value: cpwFmt });
  }
  return fields;
}

export function GarmentDetailScreen() {
  const t = useTokens();
  const nav = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const route = useRoute<Route>();
  const id = route.params?.id;

  const { data: garment, isLoading, isError, refetch } = useGarment(id);

  // Tab selection — owned at the orchestrator per the Phase 3 audit so all
  // screen-level state (data fetch, paywall latch, condition assessment,
  // tab) sits in one place. The sub-component renders the active tab and
  // calls `onTabChange` on the strip's segment presses.
  const [tab, setTab] = React.useState<GarmentDetailTab>('info');

  // Studio-render polling. The hook only ticks while `render_status` is active
  // (`pending` = enqueued, `rendering` = worker claimed). Once the worker
  // writes the rendered image and flips render_status to 'ready', the hook's
  // terminal-state branch invalidates the garment cache, useGarment refetches,
  // and this gate disables. Same flow for 'failed' / the 90 s ceiling, except
  // no invalidation fires because the original image stays as the hero.
  //
  // Both 'pending' and 'rendering' must be in scope — the row transitions
  // pending → rendering when the worker claims the job, and a user opening
  // GarmentDetail after the claim would otherwise see no pill and no image
  // swap until manual refresh. (Codex P2 on PR #728.)
  const isStudioRendering = isActiveGarmentRenderStatus(garment?.render_status);
  const renderJobGarmentId = isStudioRendering ? (garment?.id ?? null) : null;
  // N14/F7 — surface a failure badge when the worker terminally fails so
  // the original "Studio render…" pill doesn't silently disappear, leaving
  // the user staring at the original photo with no explanation.
  useRenderJobStatus(renderJobGarmentId);
  const hasRenderedImage = !!garment?.rendered_image_path;
  const isStudioFailed = garment?.render_status === 'failed';

  const {
    assessment: liveAssessment,
    isAssessing,
    error: assessError,
    assess: assessCondition,
    reset: resetAssessCondition,
  } = useAssessCondition();

  // N12 — surfaces an in-place "Generate image" action for garments added
  // without a photo (manual entry path).
  const generateImage = useGenerateGarmentImage();
  // Codex P2 round 4 on PR #816 — synchronous in-flight guard. A rapid
  // double-tap can fire two `mutate()` calls before React re-renders
  // with `isPending=true` and the Button disables; image generation is
  // expensive and the second call would overwrite the first upload at
  // the same `<userId>/<garmentId>.png` path. Cleared on settle.
  const generateImageInFlightRef = React.useRef(false);
  const handleGenerateImage = React.useCallback(() => {
    if (generateImageInFlightRef.current || !garment) return;
    generateImageInFlightRef.current = true;
    generateImage.mutate(garment.id, {
      onSettled: () => {
        generateImageInFlightRef.current = false;
      },
    });
  }, [garment, generateImage]);

  // Manual studio-render retry — surfaces under the hero for failed,
  // already-rendered, or never-rendered garments. Server-side pipeline is
  // unchanged; the existing useRenderJobStatus poller picks up the new
  // render_jobs row and invalidates the garment cache on completion.
  const retryRender = useRetryGarmentRender();
  const retryRenderInFlightRef = React.useRef(false);
  // Nonce ownership lives on the screen, not the hook. The hook used to
  // mint a fresh UUID inside its mutationFn — but after a transient
  // network failure where the server-side reservation was already minted,
  // a user re-tap would mint nonce B → new reserve_key → second
  // reservation. The reserve-key idempotency on enqueue_render_job
  // (supabase/functions/enqueue_render_job/index.ts:444-446) hits the
  // replay path when the same nonce repeats, so we keep ONE nonce per
  // logical attempt and rotate it only after the worker has claimed
  // the job. (Codex P1 round 3 on PR #900.)
  const retryRenderNonceRef = React.useRef<string | null>(null);
  // Release the synchronous in-flight lock + the nonce only when either:
  //   - the worker has claimed the job (render_status becomes active —
  //     the visibility check below hides the button anyway, and a fresh
  //     logical attempt next time gets a new nonce), OR
  //   - the mutation errored (button stays visible — user may re-tap and
  //     the SAME nonce must be reused to dedupe at the server). Lock
  //     clears so the re-tap is allowed; nonce stays.
  // The prior shape cleared the ref inside mutate's onSettled, which
  // raced the cache-invalidation refetch (Codex P1 round 2 on PR #900).
  React.useEffect(() => {
    if (isStudioRendering) {
      // Worker has claimed the job — fresh logical attempt next time.
      retryRenderInFlightRef.current = false;
      retryRenderNonceRef.current = null;
    } else if (retryRender.isSuccess) {
      // Success path: rotate BOTH lock and nonce. If the success was a
      // terminal-replay (server returned an existing terminal job row
      // because the same nonce already produced a completed render),
      // isStudioRendering will never tick true — keeping the nonce
      // cached here would re-hit the same replay on every subsequent
      // tap and the user could never actually trigger a fresh render.
      // (Codex P2 round 5 on PR #900.) Tiny race window: between
      // mutate succeeding and useRenderJobStatus / useGarment refetch
      // landing render_status='pending', a perfectly-timed user
      // double-tap would mint a second reservation. The synchronous
      // retryRenderInFlightRef catches same-render double-taps; only
      // a tap that lands AFTER React commits with isPending=false but
      // BEFORE the refetch lands would slip through. Acceptable for a
      // manual feature — getting stuck on a replay forever is strictly
      // worse than the rare double-mint.
      retryRenderInFlightRef.current = false;
      retryRenderNonceRef.current = null;
    } else if (retryRender.isError) {
      // Error path: release the lock so the user can re-tap. KEEP the
      // nonce — server-side reserve_key idempotency dedupes a real
      // retry of the same attempt.
      retryRenderInFlightRef.current = false;
    }
  }, [isStudioRendering, retryRender.isError, retryRender.isSuccess]);
  const handleRetryRender = React.useCallback(() => {
    if (retryRenderInFlightRef.current || !garment) return;
    retryRenderInFlightRef.current = true;
    hapticLight();
    if (!retryRenderNonceRef.current) {
      retryRenderNonceRef.current = Crypto.randomUUID();
    }
    retryRender.mutate({
      garmentId: garment.id,
      clientNonce: retryRenderNonceRef.current,
    });
  }, [garment, retryRender]);

  // M21 — paywall sticky-ref. Routes to PaywallScreen once per screen
  // lifetime when either the condition-assess or the generate-image
  // hook surfaces SUBSCRIPTION_SENTINEL. Released on focus regain or
  // when both hooks move off the sentinel. See PR #816 / PR #747.
  const generateImageError =
    generateImage.error instanceof Error ? generateImage.error.message : null;
  const retryRenderErrorMessage =
    retryRender.error instanceof Error ? retryRender.error.message : null;
  const paywallSentinelHit =
    assessError === SUBSCRIPTION_SENTINEL ||
    generateImageError === SUBSCRIPTION_SENTINEL ||
    retryRenderErrorMessage === SUBSCRIPTION_SENTINEL;
  const paywallShownRef = React.useRef(false);
  React.useEffect(() => {
    if (paywallSentinelHit && !paywallShownRef.current) {
      paywallShownRef.current = true;
      nav.navigate('Paywall');
    }
    if (!paywallSentinelHit && paywallShownRef.current) {
      paywallShownRef.current = false;
    }
  }, [paywallSentinelHit, nav]);
  useFocusEffect(
    React.useCallback(() => {
      paywallShownRef.current = false;
      return undefined;
    }, []),
  );

  // Persisted assessment derived from `garment.condition_score` /
  // `condition_notes`. The function persists those scalars server-side, so
  // a re-open of GarmentDetail (or the post-assess invalidate-and-refetch)
  // hydrates this without a fresh AI call.
  const persistedAssessment: ConditionAssessment | null = React.useMemo(() => {
    const raw = garment?.condition_score;
    if (typeof raw !== 'number' || !Number.isFinite(raw)) return null;
    const scaled = Math.max(0, Math.min(100, Math.round(raw * 10)));
    const notes = garment?.condition_notes?.trim();
    return {
      condition_score: scaled,
      wear_signals: [],
      repair_recommendations: [],
      summary: notes && notes.length > 0 ? notes : null,
      assessed_at: null,
    };
  }, [garment?.condition_score, garment?.condition_notes]);

  // Merge live (in-memory hook result) and persisted (server scalars on
  // the garment row) into a single render-time view. See PR #747 for the
  // strategy rationale.
  const activeAssessment = React.useMemo<ConditionAssessment | null>(() => {
    if (!liveAssessment && !persistedAssessment) return null;
    if (!persistedAssessment) return liveAssessment;
    if (!liveAssessment) return persistedAssessment;
    return {
      ...persistedAssessment,
      wear_signals: liveAssessment.wear_signals.length > 0
        ? liveAssessment.wear_signals
        : persistedAssessment.wear_signals,
      repair_recommendations: liveAssessment.repair_recommendations.length > 0
        ? liveAssessment.repair_recommendations
        : persistedAssessment.repair_recommendations,
      summary: liveAssessment.summary ?? persistedAssessment.summary ?? null,
      assessed_at: liveAssessment.assessed_at ?? persistedAssessment.assessed_at ?? null,
    };
  }, [liveAssessment, persistedAssessment]);

  const handleCheckCondition = React.useCallback(() => {
    if (!id) return;
    hapticLight();
    // Symmetric with `handleReassess`: release the paywall latch before
    // re-firing so an explicit user-initiated check on the free tier can
    // re-route to the paywall even if the hook's previous error is still
    // the `'subscription_required'` sentinel.
    paywallShownRef.current = false;
    void assessCondition(id);
  }, [id, assessCondition]);

  const handleReassess = React.useCallback(() => {
    if (!id) return;
    hapticLight();
    paywallShownRef.current = false;
    void assessCondition(id);
  }, [id, assessCondition]);

  // Reset the hook on unmount so a torn-down screen doesn't leave a
  // residual `error` / `isAssessing` state that the next mount would
  // observe through the same hook instance.
  React.useEffect(() => {
    return () => {
      resetAssessCondition();
    };
  }, [resetAssessCondition]);

  // Day-level idempotency gate for the "Wear today" CTA. The mutation
  // itself is read-modify-write on `wear_count`, so a tap that lands while
  // `markWorn.isPending` is still false-from-the-previous-render would
  // double-bump the counter.
  const now = useNow();
  const wornToday = React.useMemo(() => {
    if (!garment?.last_worn_at) return false;
    const lastWorn = new Date(garment.last_worn_at);
    if (Number.isNaN(lastWorn.getTime())) return false;
    return localISODate(lastWorn) === localISODate(now);
  }, [garment?.last_worn_at, now]);

  // Q-C2 — personal-flag toggle state. Cast bridges until
  // `supabase/types.gen.ts` is regenerated post-migration.
  const garmentFlagsView = garment as unknown as {
    is_wishlist?: boolean | null;
    is_lingerie?: boolean | null;
  } | null;
  const isWishlist = garmentFlagsView?.is_wishlist === true;
  const isLingerie = garmentFlagsView?.is_lingerie === true;

  const {
    markWornPending,
    openMoreOptionsSheet,
    handleWearToday,
    handleToggleWishlist,
    handleToggleLingerie,
  } = useGarmentActions(garment);

  // Loading: show a quiet header skeleton + spinner block. Detail-screen
  // skeletons aren't part of the existing skeleton kit, so use the spinner
  // for now — adding a dedicated skeleton is scope creep for W2.
  if (isLoading) {
    return (
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
        <View style={[s.headerRow, { borderBottomColor: t.border }]}>
          <IconBtn ariaLabel="Back" onPress={() => nav.goBack()} variant="ghost">
            <BackIcon color={t.fg} />
          </IconBtn>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Eyebrow>Loading…</Eyebrow>
          </View>
          <View style={{ width: 36 }} />
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="small" color={t.accent} />
        </View>
      </SafeAreaView>
    );
  }

  if (isError || !garment) {
    return (
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
        <View style={[s.headerRow, { borderBottomColor: t.border }]}>
          <IconBtn ariaLabel="Back" onPress={() => nav.goBack()} variant="ghost">
            <BackIcon color={t.fg} />
          </IconBtn>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Eyebrow>Not found</Eyebrow>
          </View>
          <View style={{ width: 36 }} />
        </View>
        <ErrorState
          title={garment === null ? 'Garment not found' : undefined}
          body={garment === null ? "We couldn't find this piece in your wardrobe." : undefined}
          onRetry={() => void refetch()}
        />
      </SafeAreaView>
    );
  }

  const fields = buildInfoFields(garment);
  // Used only to gate the "Generate image" CTA below — true when the garment
  // has no photo at all. Image rendering itself lives in `GarmentImageTile`.
  const heroPath =
    garment.rendered_image_path || garment.original_image_path || garment.image_path || null;
  const showGenerateImageCta = !heroPath && !isStudioRendering;

  // Manual retry button: shows under the hero in three states. Hidden
  // while a render is in flight (existing pill takes over) or when the
  // garment has no image at all (Generate-image CTA covers that path).
  const retryRenderState: 'failed' | 'ready' | 'never' | null = (() => {
    if (!heroPath || isStudioRendering) return null;
    if (isStudioFailed) return 'failed';
    if (hasRenderedImage) return 'ready';
    return 'never';
  })();
  const retryRenderLabel = (() => {
    switch (retryRenderState) {
      case 'failed':
        return tr('garmentDetail.retryRender.labelFailed');
      case 'ready':
        return tr('garmentDetail.retryRender.labelReady');
      case 'never':
        return tr('garmentDetail.retryRender.labelNever');
      default:
        return null;
    }
  })();
  const retryRenderInlineError = (() => {
    if (!retryRender.error) return null;
    const message = retryRenderErrorMessage ?? '';
    if (message === SUBSCRIPTION_SENTINEL) return null;
    const errAny = retryRender.error as { retryAfter?: number; name?: string };
    if (errAny?.name === 'EdgeFunctionRateLimitError' && typeof errAny.retryAfter === 'number') {
      return tr('garmentDetail.retryRender.errorRateLimit', {
        seconds: String(errAny.retryAfter),
      });
    }
    return tr('garmentDetail.retryRender.errorGeneric');
  })();

  const heroBadge: GarmentDetailHeroBadge = isStudioRendering
    ? 'rendering'
    : hasRenderedImage
      ? 'rendered'
      : isStudioFailed
        ? 'failed'
        : 'none';

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={[s.headerRow, { borderBottomColor: t.border }]}>
        <IconBtn ariaLabel="Back" onPress={() => nav.goBack()} variant="ghost">
          <BackIcon color={t.fg} />
        </IconBtn>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Eyebrow>{garment.category ?? 'Wardrobe'}</Eyebrow>
          <Text
            numberOfLines={1}
            style={{
              fontFamily: fonts.displayMedium,
              fontStyle: 'italic',
              fontSize: 18,
              lineHeight: 22,
              fontWeight: '500',
              color: t.fg,
              letterSpacing: -0.18,
            }}>
            {garment.title}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <IconBtn
            ariaLabel="Edit piece"
            variant="ghost"
            onPress={() => nav.navigate('EditGarment', { id: garment.id })}>
            <EditIcon color={t.fg} />
          </IconBtn>
          <IconBtn ariaLabel="More options" variant="ghost" onPress={openMoreOptionsSheet}>
            <MoreIcon color={t.fg} />
          </IconBtn>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 16,
          paddingBottom: insets.bottom + 96,
          gap: 16,
        }}
        showsVerticalScrollIndicator={false}>
        <GarmentDetailHero garment={garment} badge={heroBadge} />

        {retryRenderLabel ? (
          <View style={{ gap: 6 }}>
            <Button
              label={retryRender.isPending ? tr('garmentDetail.retryRender.labelPending') : retryRenderLabel}
              disabled={retryRender.isPending}
              onPress={handleRetryRender}
            />
            {retryRenderInlineError ? (
              <Caption style={{ paddingHorizontal: 4 }}>
                {retryRenderInlineError}
              </Caption>
            ) : null}
          </View>
        ) : null}

        <GarmentDetailTabs
          fields={fields}
          tab={tab}
          onTabChange={setTab}
          showGenerateImageCta={showGenerateImageCta}
          generateImagePending={generateImage.isPending}
          generateImageError={generateImageError}
          onGenerateImage={handleGenerateImage}
          activeAssessment={activeAssessment}
          assessError={assessError}
          isAssessing={isAssessing}
          onCheckCondition={handleCheckCondition}
          onReassess={handleReassess}
          isWishlist={isWishlist}
          isLingerie={isLingerie}
          onToggleWishlist={handleToggleWishlist}
          onToggleLingerie={handleToggleLingerie}
          occasionTags={garment.occasion_tags}
        />
      </ScrollView>

      <View
        style={[
          s.stickyBar,
          {
            backgroundColor: t.bg,
            borderTopColor: t.border,
            paddingBottom: insets.bottom + 12,
          },
        ]}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {/* Both children flex 1 — `block` hard-codes width:100% on the
              first button and pushes the Style-in-chat sibling off-screen. */}
          <Button
            label={wornToday ? 'Worn today' : markWornPending ? 'Logging…' : 'Wear today'}
            style={{ flex: 1 }}
            disabled={wornToday || markWornPending}
            onPress={() => handleWearToday({ wornToday })}
          />
          <Button
            label={tr('garmentDetail.styleInChat.action')}
            variant="outline"
            style={{ flex: 1 }}
            onPress={() =>
              nav.navigate('StyleChat', {
                mode: 'style',
                anchorGarmentIds: [garment.id],
              })
            }
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  stickyBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
  },
});
