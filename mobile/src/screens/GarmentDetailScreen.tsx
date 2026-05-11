// Garment detail — opened from any garment card or list row.
// Layout (top→bottom): header (back · eyebrow + italic title · edit + more) · hero image
// (aspect 0.78, radius 18) with Studio badge top-left + wear count badge top-right · 3-tab strip
// (Info / Outfits / Similar) · tab body · sticky "Wear today" CTA at the bottom safe area.
//
// W2 wires real Supabase data via useGarment + useSignedUrl + useMarkWorn / useMarkLaundry /
// useDeleteGarment mutations. The Outfits and Similar tabs intentionally render empty
// placeholders pending Wave 9 hooks — fixture data was removed per the "no mock garment data
// in wired screens" rule.

import React from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTokens } from '../theme/ThemeProvider';
import { fonts, radii } from '../theme/tokens';
import { Eyebrow } from '../components/Eyebrow';
import { PageTitle } from '../components/PageTitle';
import { Caption } from '../components/Caption';
import { Button } from '../components/Button';
import { IconBtn } from '../components/IconBtn';
import { ListRow } from '../components/ListRow';
import { GarmentImageTile } from '../components/GarmentImageTile';
import { ErrorState } from '../components/ErrorState';
import { ConditionBadge, tierForScore } from '../components/ConditionBadge';
import { BackIcon, CloseIcon, EditIcon, MoreIcon } from '../components/icons';
import { useGarment, useMarkLaundry, useMarkWorn, useDeleteGarment } from '../hooks/useGarments';
import { useNow } from '../hooks/useNow';
import { useAssessCondition, type ConditionAssessment } from '../hooks/useAssessCondition';
import { useGenerateGarmentImage } from '../hooks/useGenerateGarmentImage';
import { isActiveGarmentRenderStatus, useRenderJobStatus } from '../hooks/useRenderJobStatus';
import { SUBSCRIPTION_SENTINEL } from '../lib/edgeFunctionClient';
import { localISODate } from '../lib/outfitDisplay';
import { hapticLight, hapticSuccess } from '../lib/haptics';
import { t as tr } from '../lib/i18n';
import type { Garment } from '../types/garment';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'GarmentDetail'>;
type Tab = 'info' | 'outfits' | 'similar';

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
  } catch {
    return `${value} ${code}`;
  }
}

function buildInfoFields(garment: Garment): { label: string; value: string }[] {
  const fields: { label: string; value: string }[] = [];
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
  // Codex P1 round 1 on PR #816 — N12's `generate_garment_images` writes
  // the new asset to `garments.image_path` (see edge function line ~110),
  // distinct from the studio render's `rendered_image_path` and the
  // original-photo `original_image_path`. Without `image_path` in the
  // resolution chain happens inside `lib/garmentImage.ts` (mirrors web) — the
  // shared `GarmentImageTile` consumes the garment row and renders the right
  // photo automatically. The detail screen no longer needs its own path
  // selection logic.

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
  // swap until manual refresh. (Codex P2 on PR #728. Web treats both as
  // active in `useGarments`, `GarmentCardSystem`, `RenderPendingOverlay`,
  // etc. — `isActiveGarmentRenderStatus` is the shared predicate.)
  const isStudioRendering = isActiveGarmentRenderStatus(garment?.render_status);
  const renderJobGarmentId = isStudioRendering ? (garment?.id ?? null) : null;
  // N14/F7 — surface a failure badge when the worker terminally fails so
  // the original "Studio render…" pill doesn't silently disappear, leaving
  // the user staring at the original photo with no explanation. The hook
  // remains side-effecting (its terminal-state effect invalidates the
  // garment cache); we read `garment.render_status === 'failed'` straight
  // off the (now-fresh) garment row to drive the badge variant.
  useRenderJobStatus(renderJobGarmentId);
  const hasRenderedImage = !!garment?.rendered_image_path;
  const isStudioFailed = garment?.render_status === 'failed';

  const markWorn = useMarkWorn();
  const markLaundry = useMarkLaundry();
  const deleteGarment = useDeleteGarment();

  const {
    assessment: liveAssessment,
    isAssessing,
    error: assessError,
    assess: assessCondition,
    reset: resetAssessCondition,
  } = useAssessCondition();

  // N12 — surfaces an in-place "Generate image" action for garments added
  // without a photo (manual entry path). Only relevant when the garment row
  // has neither an `original_image_path` nor a `rendered_image_path` AND
  // the studio render pipeline isn't already mid-flight. Subscription-locked
  // and rate-limit error surfacing piggybacks on the existing PaywallScreen
  // route used by `useAssessCondition`.
  const generateImage = useGenerateGarmentImage();
  // Codex P2 round 4 on PR #816 — synchronous in-flight guard. A rapid
  // double-tap can fire two `mutate()` calls before React re-renders
  // with `isPending=true` and the Button disables; image generation is
  // expensive and the second call would overwrite the first upload at
  // the same `<userId>/<garmentId>.png` path. Mirrors
  // `useGenerateFlatlay`'s `lastOutfitIdRef` guard. Cleared on settle.
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

  // M21 — paywall sticky-ref. The hook surfaces the
  // `'subscription_required'` sentinel via `error` when the user is on the
  // free tier; route to PaywallScreen once per screen lifetime so a
  // dismiss + retap doesn't re-pop the modal in a loop. Same pattern as
  // M17 / M18 / M19. Released on focus regain (returning from Paywall).
  //
  // The latch is reset from TWO sources by design and the duplication is
  // deliberate (Codex P2 on PR #747):
  //   1. The effect's "error transitioned away from sentinel" branch
  //      releases when the hook itself moves to a non-paywall state — e.g.
  //      a successful re-assess after the user upgrades, or a network
  //      error replacing the sentinel. The user is still on this screen.
  //   2. The `useFocusEffect` releases on focus regain — covers the
  //      Paywall → back-to-detail navigation case where the error string
  //      may not have changed (the user dismissed without subscribing) but
  //      the screen lifecycle has crossed a boundary that should re-arm
  //      the modal for an explicit retap.
  // Both are needed: lifecycle-only would miss in-place transitions;
  // effect-only would miss the dismiss-without-change path.
  // Codex P2 round 1 on PR #816 — the latch tracks the paywall sentinel
  // from BOTH AI surfaces on this screen: condition assessment AND the
  // N12 generate-image rescue. Either hook hitting a 402 surfaces
  // SUBSCRIPTION_SENTINEL, and the latch routes to PaywallScreen once
  // per screen lifetime (released on focus regain or when both hooks
  // move off the sentinel). Without the second source, locked-tier users
  // tapping "Generate image" got a silent mutation failure.
  const generateImageError =
    generateImage.error instanceof Error ? generateImage.error.message : null;
  const paywallSentinelHit =
    assessError === SUBSCRIPTION_SENTINEL ||
    generateImageError === SUBSCRIPTION_SENTINEL;
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

  const [tab, setTab] = React.useState<Tab>('info');
  const [sheetOpen, setSheetOpen] = React.useState(false);

  // Persisted assessment derived from `garment.condition_score` /
  // `condition_notes`. The function persists those scalars server-side, so
  // a re-open of GarmentDetail (or the post-assess invalidate-and-refetch)
  // hydrates this without a fresh AI call. `wear_signals` and
  // `repair_recommendations` are the hook's reserved forward-compat
  // arrays — empty until the server returns structured tags. Score is
  // promoted from the schema's 1-10 range to 0-100 to match the badge's
  // tier breakpoints.
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
  // the garment row) into a single render-time view.
  //
  // Mobile is intentionally tolerant of forward-compat arrays: today the
  // server only persists `condition_score` + `condition_notes`, but the
  // hook reserves `wear_signals` / `repair_recommendations` so a future
  // server enrichment lights up the sheet without a hook bump. Until
  // those columns exist server-side, the freshly-returned `liveAssessment`
  // is the only place those arrays can ever be non-empty for a given
  // garment, even after the garment query refetches.
  //
  // Strategy: prefer `persistedAssessment` for the canonical score (it
  // survives unmount and matches what the AI just persisted), but fold in
  // the live arrays when both sides describe the same garment. If only
  // one side exists, use it as-is. Codex P2 on PR #747.
  const activeAssessment = React.useMemo<ConditionAssessment | null>(() => {
    if (!liveAssessment && !persistedAssessment) return null;
    if (!persistedAssessment) return liveAssessment;
    if (!liveAssessment) return persistedAssessment;
    return {
      ...persistedAssessment,
      // Preserve forward-compat tags from the live response — the
      // persisted shape never carries them today.
      wear_signals: liveAssessment.wear_signals.length > 0
        ? liveAssessment.wear_signals
        : persistedAssessment.wear_signals,
      repair_recommendations: liveAssessment.repair_recommendations.length > 0
        ? liveAssessment.repair_recommendations
        : persistedAssessment.repair_recommendations,
      // Prefer the live summary while it's around (most recent run); fall
      // back to the persisted note otherwise.
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
    // the `'subscription_required'` sentinel (the focus-regain reset is
    // the safety net for the back-from-Paywall path). Codex P2 on PR #747.
    paywallShownRef.current = false;
    void assessCondition(id);
  }, [id, assessCondition]);

  const handleOpenSheet = React.useCallback(() => {
    hapticLight();
    setSheetOpen(true);
  }, []);

  const handleCloseSheet = React.useCallback(() => {
    setSheetOpen(false);
  }, []);

  const handleReassess = React.useCallback(() => {
    if (!id) return;
    hapticLight();
    // Release the paywall latch so an explicit re-assess on the free tier
    // re-routes to the paywall instead of being suppressed by the
    // sentinel guard.
    paywallShownRef.current = false;
    void assessCondition(id);
  }, [id, assessCondition]);

  // Reset the hook on unmount so a torn-down screen doesn't leave a
  // residual `error` / `isAssessing` state that the next mount would
  // observe through the same hook instance. (Hook instances per-screen
  // already reset, but this also closes any in-flight controller cleanly.)
  React.useEffect(() => {
    return () => {
      resetAssessCondition();
    };
  }, [resetAssessCondition]);

  // Day-level idempotency gate for the "Wear today" CTA. The mutation
  // itself is read-modify-write on `wear_count`, so a tap that lands while
  // `markWorn.isPending` is still false-from-the-previous-render would
  // double-bump the counter. Derive `wornToday` from the cached
  // `last_worn_at` and disable the button when it matches today's local
  // date — same pattern useMarkOutfitWorn's screen consumers (Home,
  // OutfitDetail, Plan) follow. Codex P1 round-N from internal review.
  const now = useNow();
  const wornToday = React.useMemo(() => {
    if (!garment?.last_worn_at) return false;
    const lastWorn = new Date(garment.last_worn_at);
    if (Number.isNaN(lastWorn.getTime())) return false;
    return localISODate(lastWorn) === localISODate(now);
  }, [garment?.last_worn_at, now]);

  const handleWearToday = () => {
    if (!id) return;
    if (wornToday) return;
    hapticSuccess();
    markWorn.mutate(id, {
      onError: (err) => {
        Alert.alert(
          tr('garmentDetail.alerts.couldNotLogWear.title'),
          err instanceof Error ? err.message : tr('garmentDetail.alerts.tryAgain'),
        );
      },
    });
  };

  const handleAddToLaundry = () => {
    if (!id) return;
    // Haptic confirmation — without this the action is silent: the More menu
    // closes, the badge ticks on, but the screen looks identical for the
    // 200-500ms invalidate-and-refetch window. The audit (UX#6) flagged this
    // as a tap-to-feedback gap.
    hapticLight();
    markLaundry.mutate(
      { id, inLaundry: true },
      {
        onError: (err) => {
          Alert.alert(
            tr('garmentDetail.alerts.couldNotMove.title'),
            err instanceof Error ? err.message : tr('garmentDetail.alerts.tryAgain'),
          );
        },
      },
    );
  };

  const handleRemoveFromLaundry = () => {
    if (!id) return;
    hapticLight();
    markLaundry.mutate(
      { id, inLaundry: false },
      {
        onError: (err) => {
          Alert.alert(
            tr('garmentDetail.alerts.couldNotMarkClean.title'),
            err instanceof Error ? err.message : tr('garmentDetail.alerts.tryAgain'),
          );
        },
      },
    );
  };

  const handleDelete = () => {
    if (!id) return;
    Alert.alert(
      tr('garmentDetail.alerts.delete.title'),
      tr('garmentDetail.alerts.delete.body'),
      [
        { text: tr('common.cancel'), style: 'cancel' },
        {
          text: tr('garmentDetail.alerts.delete.title'),
          style: 'destructive',
          onPress: () => {
            deleteGarment.mutate(id, {
              onSuccess: () => nav.goBack(),
              onError: (err) =>
                Alert.alert(
                  tr('garmentDetail.alerts.deleteFailed.title'),
                  err instanceof Error ? err.message : tr('garmentDetail.alerts.tryAgain'),
                ),
            });
          },
        },
      ],
    );
  };

  const onMoreOptions = () => {
    if (!garment) return;
    const buttons: { text: string; style?: 'default' | 'cancel' | 'destructive'; onPress?: () => void }[] = [];
    if (garment.in_laundry) {
      buttons.push({ text: tr('garmentDetail.menu.markClean'), onPress: handleRemoveFromLaundry });
    } else {
      buttons.push({ text: tr('garmentDetail.menu.addToLaundry'), onPress: handleAddToLaundry });
    }
    buttons.push({ text: tr('garmentDetail.menu.deleteGarment'), style: 'destructive', onPress: handleDelete });
    buttons.push({ text: tr('common.cancel'), style: 'cancel' });
    Alert.alert(tr('garmentDetail.alerts.options.title'), undefined, buttons);
  };

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
          <IconBtn ariaLabel="More options" variant="ghost" onPress={onMoreOptions}>
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
        <View style={[s.hero, { borderColor: t.border }]}>
          {/* Photo — render_status-aware path selection + faded Tshirt icon
              fallback live in GarmentImageTile (mirrors web). Studio badge,
              wear-count badge etc. layer on top below. */}
          <GarmentImageTile garment={garment} iconSize={64} />
          {/* Studio badge — four states:
              • pending render → "Studio render…" with an inline spinner
              • rendered image present → "Studio"
              • render_status='failed' → "Render unavailable" (N14/F7 — was
                previously hidden, leaving the user staring at the original
                photo with no explanation when a worker run failed)
              • render_status='none' → hidden, the original photo stands
                on its own without a misleading label. */}
          {isStudioRendering ? (
            <View
              accessibilityLiveRegion="polite"
              accessibilityLabel={tr('garmentDetail.badge.studioRendering.a11y')}
              style={[s.heroBadge, s.heroBadgePending, { backgroundColor: t.accentSoft }]}>
              <ActivityIndicator size="small" color={t.accent} style={{ marginRight: 6 }} />
              <Text style={[s.heroBadgeText, { color: t.accent }]}>{tr('garmentDetail.badge.studioRendering')}</Text>
            </View>
          ) : hasRenderedImage ? (
            <View style={[s.heroBadge, { backgroundColor: t.accentSoft }]}>
              <Text style={[s.heroBadgeText, { color: t.accent }]}>{tr('garmentDetail.badge.studio')}</Text>
            </View>
          ) : isStudioFailed ? (
            <View
              accessibilityLabel={tr('garment.render.failed.a11y')}
              style={[s.heroBadge, { backgroundColor: t.destructiveSoft }]}>
              <Text style={[s.heroBadgeText, { color: t.destructive }]}>{tr('garment.render.failed')}</Text>
            </View>
          ) : null}
          <View style={[s.heroBadgeRight, { backgroundColor: t.card, borderColor: t.border }]}>
            <Text
              style={{
                fontFamily: fonts.displayMedium,
                fontStyle: 'italic',
                fontSize: 14,
                color: t.fg,
                letterSpacing: -0.14,
              }}>
              {garment.wear_count ?? 0}
            </Text>
            <Text
              style={{
                fontFamily: fonts.uiSemi,
                fontSize: 8.5,
                color: t.fg2,
                letterSpacing: 1.2,
                textTransform: 'uppercase',
                marginTop: 1,
              }}>
              Wears
            </Text>
          </View>
        </View>

        <View style={[s.tabStrip, { borderColor: t.border, backgroundColor: t.card }]}>
          {(['info', 'outfits', 'similar'] as Tab[]).map((tabId) => {
            const active = tab === tabId;
            const label = tabId === 'info' ? 'Info' : tabId === 'outfits' ? 'Outfits' : 'Similar';
            return (
              <Pressable
                key={tabId}
                accessibilityRole="tab"
                accessibilityLabel={label}
                accessibilityState={{ selected: active }}
                onPress={() => setTab(tabId)}
                style={[
                  s.tabBtn,
                  { backgroundColor: active ? t.fg : 'transparent' },
                ]}>
                <Text
                  style={{
                    fontFamily: fonts.uiSemi,
                    fontSize: 12,
                    color: active ? t.bg : t.fg2,
                    letterSpacing: -0.1,
                  }}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {tab === 'info' ? (
          <View style={{ gap: 12 }}>
            {/* N12 — manual-entry garments arrive with no image_path. Until
                a photo is attached, the hero falls back to the gradient
                placeholder. Offer a single-tap AI catalog-image generator
                here so the wardrobe doesn't fill up with colored squares.
                Hidden once an image (original or rendered) lands, and
                while a studio render is mid-flight (the existing pipeline
                will produce the rendered image any moment). */}
            {!heroPath && !isStudioRendering ? (
              <View style={{ gap: 10 }}>
                <Eyebrow>Image</Eyebrow>
                <Caption>{tr('garment.generateImage.empty')}</Caption>
                <Button
                  label={
                    generateImage.isPending
                      ? tr('garment.generateImage.busy')
                      : tr('garment.generateImage.action')
                  }
                  variant="outline"
                  size="sm"
                  disabled={generateImage.isPending}
                  onPress={handleGenerateImage}
                  accessibilityState={{
                    disabled: generateImage.isPending,
                    busy: generateImage.isPending,
                  }}
                  leadingIcon={
                    generateImage.isPending ? (
                      <ActivityIndicator size="small" color={t.fg} />
                    ) : undefined
                  }
                />
                {/* Codex P2 round 2 on PR #816 — surface non-paywall
                    failures (rate limit, network, function returning
                    success: false) so the user sees something more than
                    the button reverting to its idle label. The paywall
                    sentinel is filtered because it routes via the
                    paywall latch above, not as an error caption. Same
                    shape as the condition-assessment error caption. */}
                {generateImageError &&
                generateImageError !== SUBSCRIPTION_SENTINEL ? (
                  <Caption style={{ color: t.destructive }}>
                    {tr('garment.generateImage.error')}
                  </Caption>
                ) : null}
              </View>
            ) : null}
            {/* M21 — condition assessment block. Badge appears once the
                garment row has a persisted score OR the hook has just
                returned one. The "Check condition" CTA sits adjacent so a
                user without a prior assessment can trigger one inline; an
                accessibility hint surfaces the bottom-sheet target. */}
            <View style={{ gap: 10 }}>
              <Eyebrow>Condition</Eyebrow>
              {activeAssessment ? (
                <ConditionBadge assessment={activeAssessment} onTap={handleOpenSheet} />
              ) : (
                <Caption>{tr('condition.empty')}</Caption>
              )}
              {assessError && assessError !== SUBSCRIPTION_SENTINEL ? (
                <Caption style={{ color: t.destructive }}>
                  {tr('condition.error.network')}
                </Caption>
              ) : null}
              <Button
                label={isAssessing ? tr('condition.assessing') : tr('condition.checkAction')}
                variant="outline"
                size="sm"
                disabled={isAssessing}
                onPress={handleCheckCondition}
                accessibilityState={{ disabled: isAssessing, busy: isAssessing }}
                leadingIcon={
                  isAssessing ? <ActivityIndicator size="small" color={t.fg} /> : undefined
                }
              />
            </View>
            <View style={[s.fieldGroup, { backgroundColor: t.card, borderColor: t.border }]}>
              {fields.map((f, i) => (
                <ListRow
                  key={f.label}
                  title={f.label}
                  hideChevron
                  last={i === fields.length - 1}
                  right={
                    <Text
                      style={{
                        fontFamily: fonts.uiMed,
                        fontSize: 13,
                        color: t.fg,
                        letterSpacing: -0.1,
                      }}>
                      {f.value}
                    </Text>
                  }
                  style={{ paddingHorizontal: 14 }}
                />
              ))}
            </View>
            {garment.occasion_tags && garment.occasion_tags.length > 0 ? (
              <View>
                <Eyebrow style={{ marginBottom: 8 }}>Tags</Eyebrow>
                <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                  {garment.occasion_tags.map((tag) => (
                    <View
                      key={tag}
                      style={[s.tagChip, { backgroundColor: t.bg2, borderColor: t.border }]}>
                      <Text style={[s.tagChipText, { color: t.fg2 }]}>{tag}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
          </View>
        ) : null}

        {tab === 'outfits' ? (
          <EmptyTab title="Not in any outfit yet" body="Build a look featuring this piece." />
        ) : null}

        {tab === 'similar' ? (
          <EmptyTab title="No similar pieces" body="Similar-piece suggestions land in a future release." />
        ) : null}
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
        <Button
          label={wornToday ? 'Worn today' : markWorn.isPending ? 'Logging…' : 'Wear today'}
          block
          disabled={wornToday || markWorn.isPending}
          onPress={handleWearToday}
        />
      </View>

      {/* M21 — condition detail bottom sheet. Surfaces the full breakdown
          (score, wear signals, repair recommendations) plus a Re-assess
          action that re-runs the AI call. RN's stock Modal handles the
          slide-up transition; same pattern as GarmentSaveChoiceSheet so
          mobile doesn't pull in another sheet library. */}
      {activeAssessment ? (
        <ConditionDetailSheet
          visible={sheetOpen}
          assessment={activeAssessment}
          isAssessing={isAssessing}
          onClose={handleCloseSheet}
          onReassess={handleReassess}
        />
      ) : null}
    </SafeAreaView>
  );
}

interface ConditionDetailSheetProps {
  visible: boolean;
  assessment: ConditionAssessment;
  isAssessing: boolean;
  onClose: () => void;
  onReassess: () => void;
}

function ConditionDetailSheet({
  visible,
  assessment,
  isAssessing,
  onClose,
  onReassess,
}: ConditionDetailSheetProps) {
  const t = useTokens();
  const score = Number.isFinite(assessment.condition_score)
    ? Math.max(0, Math.min(100, Math.round(assessment.condition_score)))
    : 0;
  // Single source of truth for tier classification — shared with the
  // ConditionBadge so the sheet's large numeral and the inline pill can
  // never drift out of sync. (Codex P3 on PR #747.)
  const tier = tierForScore(score);
  const tierColor = tier === 'good' ? t.accent : tier === 'poor' ? t.destructive : t.fg;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      accessibilityViewIsModal>
      <Pressable
        accessible={false}
        style={[StyleSheet.absoluteFillObject, { backgroundColor: t.scrimBg }]}
        onPress={onClose}
      />
      <View
        accessibilityRole="none"
        style={[
          sheetStyles.sheet,
          { backgroundColor: t.bg, borderTopColor: t.border },
        ]}>
        <View style={[sheetStyles.handle, { backgroundColor: t.border }]} />

        {/* P1.2 — explicit close affordance. The backdrop tap also dismisses,
            but VoiceOver / TalkBack users need a discoverable button inside
            the sheet card. Top-right placement matches platform convention
            for modal close. (Codex P1 on PR #747.) */}
        <View style={sheetStyles.closeBtnWrap}>
          <IconBtn
            ariaLabel={tr('condition.closeSheet')}
            variant="ghost"
            onPress={onClose}>
            <CloseIcon color={t.fg} />
          </IconBtn>
        </View>

        <Eyebrow style={{ marginBottom: 6 }}>Condition</Eyebrow>
        {/* P1.1 — score block dims while a re-assessment is in flight so
            the surface communicates that the displayed score is stale.
            Paired with the inline ActivityIndicator on the disabled
            Re-assess button below. (Codex P1 on PR #747.) */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'baseline',
            gap: 10,
            marginBottom: 14,
            opacity: isAssessing ? 0.4 : 1,
          }}>
          <Text
            style={{
              fontFamily: fonts.displayMedium,
              fontStyle: 'italic',
              fontSize: 48,
              lineHeight: 52,
              color: tierColor,
              letterSpacing: -1.2,
            }}>
            {score}
          </Text>
          <Text
            style={{
              fontFamily: fonts.uiSemi,
              fontSize: 11,
              letterSpacing: 1.6,
              textTransform: 'uppercase',
              color: tierColor,
            }}>
            {tr(`condition.tier.${tier}`)}
          </Text>
        </View>

        {assessment.summary ? (
          <Text
            style={{
              fontFamily: fonts.ui,
              fontSize: 13.5,
              lineHeight: 19,
              color: t.fg,
              marginBottom: 18,
            }}>
            {assessment.summary}
          </Text>
        ) : null}

        {assessment.wear_signals.length > 0 ? (
          <View style={{ marginBottom: 14 }}>
            <Eyebrow style={{ marginBottom: 8 }}>{tr('condition.wearSignals')}</Eyebrow>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {assessment.wear_signals.map((signal) => (
                <View
                  key={signal}
                  style={[s.tagChip, { backgroundColor: t.bg2, borderColor: t.border }]}>
                  <Text style={[s.tagChipText, { color: t.fg2 }]}>{signal}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {assessment.repair_recommendations.length > 0 ? (
          <View style={{ marginBottom: 14 }}>
            <Eyebrow style={{ marginBottom: 8 }}>{tr('condition.repairTitle')}</Eyebrow>
            <View style={{ gap: 6 }}>
              {assessment.repair_recommendations.map((rec) => (
                <View key={rec} style={{ flexDirection: 'row', gap: 8 }}>
                  <Text style={{ color: t.fg2, fontFamily: fonts.ui, fontSize: 13 }}>•</Text>
                  <Text
                    style={{
                      flex: 1,
                      color: t.fg,
                      fontFamily: fonts.ui,
                      fontSize: 13,
                      lineHeight: 18,
                    }}>
                    {rec}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <Button
          label={isAssessing ? tr('condition.assessing') : tr('condition.reassessAction')}
          variant="outline"
          block
          disabled={isAssessing}
          onPress={onReassess}
          accessibilityState={{ disabled: isAssessing, busy: isAssessing }}
          leadingIcon={
            isAssessing ? <ActivityIndicator size="small" color={t.fg} /> : undefined
          }
        />
      </View>
    </Modal>
  );
}

const sheetStyles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    marginBottom: 16,
  },
  closeBtnWrap: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 1,
  },
});

function EmptyTab({ title, body }: { title: string; body: string }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 32, gap: 6 }}>
      <PageTitle size={22}>{title}</PageTitle>
      <Caption style={{ textAlign: 'center', maxWidth: 240 }}>{body}</Caption>
    </View>
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
  hero: {
    width: '100%',
    aspectRatio: 0.78,
    borderRadius: radii.xl,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  heroBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
  },
  heroBadgePending: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroBadgeText: {
    fontFamily: fonts.uiSemi,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  heroBadgeRight: {
    position: 'absolute',
    top: 12,
    right: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.lg,
    borderWidth: 1,
    alignItems: 'center',
  },
  tabStrip: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  tabBtn: {
    flex: 1,
    height: 32,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldGroup: {
    borderRadius: radii.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  tagChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  tagChipText: {
    fontFamily: fonts.uiSemi,
    fontSize: 11,
    letterSpacing: -0.05,
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
