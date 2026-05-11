// Outfit detail — opened from OutfitsScreen, HomeScreen Today's Look, or
// any inline outfit card. Sections (top→bottom): header (back · eyebrow ·
// italic title · share + more) · 2x2 garment thumb grid · meta chips row
// · primary actions row (Wear today / Restyle / Save) · M17 composition
// helpers · feedback section (5-star rating + notes) · M37 slot
// composition list. Sticky header is via SafeAreaView; the body uses a
// KeyboardAvoidingView so the notes input doesn't get clipped on iOS.
//
// N13 split — sub-components and helpers live in sibling files. This
// file is the orchestrator: useOutfit + helper hooks + state + handlers
// + layout.

import React from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQueryClient } from '@tanstack/react-query';

import { useTokens } from '../theme/ThemeProvider';
import { fonts } from '../theme/tokens';
import { Eyebrow } from '../components/Eyebrow';
import { PageTitle } from '../components/PageTitle';
import { Button } from '../components/Button';
import {
  useOutfit,
  useMarkOutfitWorn,
  useSaveOutfit,
  useDeleteOutfit,
  useRateOutfit,
  useOutfitFeedback,
  useSaveOutfitNote,
} from '../hooks/useOutfits';
import { useShareOutfit } from '../hooks/useShareOutfit';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Sentry } from '../lib/sentry';
import { t as tr } from '../lib/i18n';
import { showToast } from '../lib/toast';
import { useUpsertPlannedOutfit } from '../hooks/usePlannedOutfits';
import { useNow } from '../hooks/useNow';
import {
  groupGarmentsBySlot,
  localISODate,
  outfitDisplayName,
} from '../lib/outfitDisplay';
import { useSwapGarment } from '../hooks/useSwapGarment';
import type { OutfitItemWithGarment } from '../types/outfit';
import type { RootStackParamList } from '../navigation/RootNavigator';

import { anchorStorageKey } from './OutfitDetailScreen.helpers';
import { DetailThumbGrid, MetaChip } from './OutfitDetailScreen.thumbGrid';
import { SwapCandidateSheet } from './OutfitDetailScreen.swapSheet';
import { DatePickerSheet } from './TravelCapsuleScreen.datePicker';
import { HelperSections } from './OutfitDetailScreen.helperSections';
import { FeedbackSection } from './OutfitDetailScreen.feedback';
import { OutfitDetailHeader } from './OutfitDetailScreen.header';
import { SlotCompositionList } from './OutfitDetailScreen.slots';
import { LoadingShell, NotFoundShell } from './OutfitDetailScreen.shells';
import { useOutfitDetailHelperState } from './OutfitDetailScreen.useHelperState';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'OutfitDetail'>;

export function OutfitDetailScreen() {
  const t = useTokens();
  const nav = useNavigation<Nav>();
  const route = useRoute<Route>();
  const id = route.params?.id;
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Q-B — planner sheet auto-mounts open when the screen is reached via
  // OutfitGenerate's "Plan for a date" action (or any future caller that
  // passes `openPlanner: true`). `preselectDate` (YYYY-MM-DD) seeds the
  // staged date inside `DatePickerSheet`; falls through to today via
  // the sheet's own initialISO default when undefined.
  //
  // Both values are snapshotted via lazy `useState` init so they survive
  // the mount-effect's `nav.setParams({ … undefined })` clear below.
  // `DatePickerSheet` re-anchors whenever its `initialISO` prop changes,
  // so reading `route.params.preselectDate` directly would flip back to
  // today the instant the param-clear lands — Codex P2 round 1 on Q-B.
  const [plannerOpen, setPlannerOpen] = React.useState<boolean>(
    () => route.params?.openPlanner === true,
  );
  const [plannerInitialISO] = React.useState<string | undefined>(
    () => route.params?.preselectDate,
  );
  // Clear the trigger params after first mount so a back-nav onto this
  // screen doesn't re-open the planner — React Navigation persists
  // params unless we explicitly null them. `setParams` lands on the
  // SAME route entry, which is what we want.
  React.useEffect(() => {
    if (route.params?.openPlanner || route.params?.preselectDate) {
      nav.setParams({ openPlanner: undefined, preselectDate: undefined });
    }
    // We only want the param-clear to happen once at mount, not on
    // every re-render that happens to see openPlanner true (which
    // would be empty after the first setParams). Empty deps is correct.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const outfitQ = useOutfit(id);
  const outfit = outfitQ.data ?? null;

  const markWorn = useMarkOutfitWorn();
  const saveOutfit = useSaveOutfit();
  const deleteOutfit = useDeleteOutfit();
  const rateOutfit = useRateOutfit();
  const upsertPlanned = useUpsertPlannedOutfit();
  const feedbackQ = useOutfitFeedback(outfit?.id);
  const saveNote = useSaveOutfitNote();
  // M41 — share an outfit via the OS share sheet.
  const { share: shareOutfit, isSharing } = useShareOutfit();

  // M17 — composition helpers (lazy: hooks fire on first reveal).
  const helperState = useOutfitDetailHelperState({ outfit, nav });

  const [rating, setRating] = React.useState(0);
  const [notes, setNotes] = React.useState('');

  // M37 — slot composition state.
  const [anchorGarmentId, setAnchorGarmentId] = React.useState<string | null>(null);
  const [swapTarget, setSwapTarget] = React.useState<{
    outfitItemId: string;
    slot: string;
    garmentId: string | null;
  } | null>(null);

  // N14/F1 — guards the AsyncStorage read against a fast tap. The original
  // hydration effect only used a `cancelled` ref to drop a late `setState`
  // after unmount, but a user tapping Anchor before the read resolved could
  // have their tap clobbered by the hydrated value milliseconds later.
  // `hydratedRef` flips true after the read resolves; `persistAnchor` flips
  // it on a user write so any in-flight hydration is short-circuited.
  const hydratedRef = React.useRef(false);

  // Hydrate the anchor from AsyncStorage when the outfit id resolves.
  React.useEffect(() => {
    let cancelled = false;
    if (!user || !outfit?.id) {
      setAnchorGarmentId(null);
      hydratedRef.current = false;
      return;
    }
    hydratedRef.current = false;
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(anchorStorageKey(user.id, outfit.id));
        if (cancelled || hydratedRef.current) return;
        setAnchorGarmentId(stored && stored.length > 0 ? stored : null);
      } catch (err) {
        Sentry.addBreadcrumb({
          category: 'storage',
          level: 'warning',
          message: 'OutfitDetail: anchor read failed',
          data: { error: err instanceof Error ? err.message : String(err) },
        });
      } finally {
        if (!cancelled) hydratedRef.current = true;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, outfit?.id]);

  const persistAnchor = React.useCallback(
    async (garmentId: string | null) => {
      if (!user || !outfit?.id) return;
      const key = anchorStorageKey(user.id, outfit.id);
      // N14/F1 — claim hydration so a still-in-flight AsyncStorage read
      // can't clobber the user's just-written value.
      hydratedRef.current = true;
      try {
        if (garmentId) {
          await AsyncStorage.setItem(key, garmentId);
        } else {
          await AsyncStorage.removeItem(key);
        }
        setAnchorGarmentId(garmentId);
      } catch (err) {
        Sentry.addBreadcrumb({
          category: 'storage',
          level: 'warning',
          message: 'OutfitDetail: anchor write failed',
          data: { error: err instanceof Error ? err.message : String(err) },
        });
        showToast(
          'error',
          tr('outfitDetail.toast.couldNotSaveAnchor'),
          err instanceof Error ? err.message : tr('common.alerts.tryAgain'),
        );
      }
    },
    [user, outfit?.id],
  );

  const swapGarmentIds = React.useMemo(() => {
    if (!outfit) return [] as string[];
    return (outfit.outfit_items ?? [])
      .map((it) => it.garment?.id)
      .filter((gid): gid is string => typeof gid === 'string' && gid.length > 0);
  }, [outfit]);

  const swapHook = useSwapGarment({
    outfitId: outfit?.id ?? null,
    slot: swapTarget?.slot ?? null,
    outfitItemId: swapTarget?.outfitItemId ?? null,
    excludeGarmentIds: swapGarmentIds,
    enabled: !!swapTarget,
  });

  const slotGroups = React.useMemo(
    () => groupGarmentsBySlot(outfit?.outfit_items ?? []),
    [outfit?.outfit_items],
  );

  const handleOpenSwap = React.useCallback(
    (slot: string, item: OutfitItemWithGarment) => {
      setSwapTarget({
        outfitItemId: item.id,
        slot,
        garmentId: item.garment?.id ?? null,
      });
    },
    [],
  );

  const handleCloseSwap = React.useCallback(() => {
    setSwapTarget(null);
  }, []);

  const handleSelectSwap = React.useCallback(
    async (newGarmentId: string) => {
      if (!swapTarget) return;
      try {
        await swapHook.swap({ newGarmentId });
        // If the swapped-out garment was the anchor, clear the lock.
        if (swapTarget.garmentId && anchorGarmentId === swapTarget.garmentId) {
          await persistAnchor(null);
        }
        setSwapTarget(null);
      } catch (err) {
        showToast(
          'error',
          tr('outfitDetail.toast.couldNotSwap'),
          err instanceof Error ? err.message : tr('common.alerts.tryAgain'),
        );
      }
    },
    [swapTarget, swapHook, anchorGarmentId, persistAnchor],
  );

  const handleAnchor = React.useCallback(
    async (garmentId: string) => {
      if (anchorGarmentId === garmentId) {
        await persistAnchor(null);
        return;
      }
      await persistAnchor(garmentId);
    },
    [anchorGarmentId, persistAnchor],
  );

  const handleRemoveItem = React.useCallback(
    async (item: OutfitItemWithGarment) => {
      if (!outfit || !user) return;
      const garmentTitle = item.garment?.title ?? 'this piece';
      Alert.alert(
        tr('outfitDetail.remove.title'),
        tr('outfitDetail.remove.body', { title: garmentTitle }),
        [
          { text: tr('outfitDetail.remove.cancel'), style: 'cancel' },
          {
            text: tr('outfitDetail.remove.confirm'),
            style: 'destructive',
            onPress: async () => {
              try {
                const { error: deleteErr } = await supabase
                  .from('outfit_items')
                  .delete()
                  .eq('id', item.id);
                if (deleteErr) throw deleteErr;
                if (item.garment?.id && anchorGarmentId === item.garment.id) {
                  await persistAnchor(null);
                }
                queryClient.invalidateQueries({
                  queryKey: ['outfit', user.id, outfit.id],
                });
                queryClient.invalidateQueries({ queryKey: ['outfits'] });
              } catch (err) {
                Sentry.withScope((scope) => {
                  scope.setTag('mutation', 'OutfitDetailScreen.removeItem');
                  Sentry.captureException(
                    err instanceof Error ? err : new Error(String(err)),
                  );
                });
                showToast(
                  'error',
                  tr('outfitDetail.toast.couldNotRemove'),
                  err instanceof Error ? err.message : tr('common.alerts.tryAgain'),
                );
              }
            },
          },
        ],
      );
    },
    [outfit, user, anchorGarmentId, persistAnchor, queryClient],
  );

  // Hydrate rating + notes from outfit + outfit_feedback so a returning
  // user sees their prior values.
  const hydratedForId = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!outfit?.id || feedbackQ.isLoading) return;
    if (hydratedForId.current === outfit.id) return;
    hydratedForId.current = outfit.id;
    const seedRating =
      feedbackQ.data?.rating ??
      (typeof outfit.rating === 'number' ? outfit.rating : 0);
    setRating(seedRating ?? 0);
    setNotes(feedbackQ.data?.commentary ?? '');
  }, [outfit?.id, outfit?.rating, feedbackQ.data, feedbackQ.isLoading]);

  const persistedNote = feedbackQ.data?.commentary ?? '';
  const notesDirty = notes.trim() !== persistedNote.trim();

  // Reactive `now` so the wornToday gate flips correctly across midnight.
  const now = useNow();
  const wornToday = React.useMemo(() => {
    if (!outfit?.worn_at) return false;
    const wornDate = new Date(outfit.worn_at);
    if (Number.isNaN(wornDate.getTime())) return false;
    return localISODate(wornDate) === localISODate(now);
  }, [outfit?.worn_at, now]);

  const isSaved = Boolean(outfit?.saved);

  const handleWear = React.useCallback(() => {
    if (!outfit) return;
    const garmentIds = (outfit.outfit_items ?? [])
      .map((item) => item.garment?.id)
      .filter((gid): gid is string => Boolean(gid));
    markWorn.mutate(
      { outfitId: outfit.id, garmentIds },
      {
        onSuccess: (data) => {
          if (data?.deduped) return;
          showToast(
            'success',
            tr('outfit.actions.markedWorn.title'),
            tr('outfit.actions.markedWorn.body'),
          );
        },
        onError: (err: unknown) =>
          showToast(
            'error',
            tr('outfit.actions.couldNotMarkWorn.title'),
            err instanceof Error ? err.message : tr('common.alerts.tryAgain'),
          ),
      },
    );
  }, [outfit, markWorn]);

  const handleSaveToggle = React.useCallback(() => {
    if (!outfit || isSaved || saveOutfit.isPending) return;
    const garmentIds =
      outfit.outfit_items
        ?.map((it) => it.garment?.id)
        .filter((gid): gid is string => typeof gid === 'string') ?? [];
    saveOutfit.mutate(
      { outfitId: outfit.id, garmentIds },
      {
        onError: (err: unknown) =>
          showToast(
            'error',
            tr('outfit.actions.couldNotSave.title'),
            err instanceof Error ? err.message : tr('common.alerts.tryAgain'),
          ),
      },
    );
  }, [outfit, isSaved, saveOutfit]);

  const handleAddToPlan = React.useCallback(() => {
    if (!outfit) return;
    upsertPlanned.mutate(
      { date: localISODate(now), outfitId: outfit.id },
      {
        onSuccess: () =>
          showToast(
            'success',
            tr('outfit.actions.added.title'),
            tr('outfit.actions.added.body'),
          ),
        onError: (err: unknown) =>
          showToast(
            'error',
            tr('outfit.actions.couldNotAddPlan.title'),
            err instanceof Error ? err.message : tr('common.alerts.tryAgain'),
          ),
      },
    );
  }, [outfit, upsertPlanned, now]);

  // Q-B — planner sheet confirm. Writes a planned_outfits row for the
  // chosen date; when the user picked TODAY we also fire `markWorn` so
  // the "Wear today" semantics ride along (matches the spec's "single
  // sheet, the date decides the action" UX). Sheet dismisses on confirm
  // either way. Garment ids forwarded to `markWorn` so each piece's
  // wear_count + last_worn_at land.
  const handlePlannerConfirm = React.useCallback(
    (iso: string) => {
      if (!outfit) return;
      const todayIso = localISODate(now);
      const isToday = iso === todayIso;
      const garmentIds = (outfit.outfit_items ?? [])
        .map((it: OutfitItemWithGarment) => it.garment?.id)
        .filter((g): g is string => typeof g === 'string' && g.length > 0);
      upsertPlanned.mutate(
        { date: iso, outfitId: outfit.id },
        {
          onSuccess: () => {
            setPlannerOpen(false);
            if (isToday) {
              markWorn.mutate(
                { outfitId: outfit.id, garmentIds },
                {
                  onError: (err: unknown) =>
                    showToast(
                      'error',
                      tr('outfit.actions.couldNotWear.title'),
                      err instanceof Error ? err.message : tr('common.alerts.tryAgain'),
                    ),
                },
              );
            }
            showToast(
              'success',
              tr('plannerSheet.success.title'),
              tr('plannerSheet.success.body'),
            );
          },
          onError: (err: unknown) =>
            showToast(
              'error',
              tr('plannerSheet.failed.title'),
              err instanceof Error ? err.message : tr('common.alerts.tryAgain'),
            ),
        },
      );
    },
    [outfit, upsertPlanned, markWorn, now],
  );

  const handleShare = React.useCallback(async () => {
    if (!outfit) return;
    const displayName = outfitDisplayName(outfit);
    try {
      await shareOutfit({ outfitId: outfit.id, name: displayName });
    } catch {
      showToast('error', tr('share.outfit.error.title'), tr('share.outfit.error.body'));
    }
  }, [outfit, shareOutfit]);

  const handleDelete = React.useCallback(() => {
    if (!outfit) return;
    Alert.alert(tr('outfit.actions.delete.title'), tr('outfit.actions.delete.body'), [
      { text: tr('outfit.actions.delete.cancel'), style: 'cancel' },
      {
        text: tr('outfit.actions.delete.confirm'),
        style: 'destructive',
        onPress: () => {
          deleteOutfit.mutate(outfit.id, {
            onSuccess: () => nav.goBack(),
            onError: (err: unknown) =>
              showToast(
                'error',
                tr('outfit.actions.couldNotDelete.title'),
                err instanceof Error ? err.message : tr('common.alerts.tryAgain'),
              ),
          });
        },
      },
    ]);
  }, [outfit, deleteOutfit, nav]);

  const handleRate = React.useCallback(
    (n: number) => {
      if (rateOutfit.isPending) return;
      const nextRating = n === rating ? 0 : n;
      setRating(nextRating);
      if (!outfit) return;
      rateOutfit.mutate({ outfitId: outfit.id, rating: nextRating });
    },
    [outfit, rating, rateOutfit],
  );

  const handleSaveNote = React.useCallback(() => {
    if (!outfit) return;
    saveNote.mutate(
      { outfitId: outfit.id, note: notes },
      {
        onError: (err: unknown) =>
          showToast(
            'error',
            tr('outfitDetail.toast.couldNotSaveNote'),
            err instanceof Error ? err.message : tr('common.alerts.tryAgain'),
          ),
      },
    );
  }, [outfit, notes, saveNote]);

  if (outfitQ.isLoading) {
    return <LoadingShell onBack={() => nav.goBack()} />;
  }

  if (!outfit) {
    return <NotFoundShell onBack={() => nav.goBack()} />;
  }

  const name = outfitDisplayName(outfit);
  const kicker = wornToday ? 'Worn today' : isSaved ? 'Saved look' : 'Outfit';
  const everWorn = Boolean(outfit.worn_at);

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}>
        <OutfitDetailHeader
          title={name}
          isSharing={isSharing}
          onBack={() => nav.goBack()}
          onShare={handleShare}
          onAddToPlan={handleAddToPlan}
          onDelete={handleDelete}
        />

        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 60, gap: 18 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          <View>
            <Eyebrow style={{ marginBottom: 4 }}>{kicker}</Eyebrow>
            <PageTitle>{name}</PageTitle>
          </View>

          <DetailThumbGrid outfit={outfit} />

          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
            {outfit.occasion ? <MetaChip label={outfit.occasion} /> : null}
            {outfit.style_vibe ? <MetaChip label={outfit.style_vibe} /> : null}
            {outfit.confidence_level ? <MetaChip label={outfit.confidence_level} /> : null}
            <MetaChip label={everWorn ? 'Worn' : 'Never worn'} />
          </View>

          {outfit.explanation ? (
            <Text style={{ fontFamily: fonts.ui, fontSize: 13, lineHeight: 19.5, color: t.fg2 }}>
              {outfit.explanation}
            </Text>
          ) : null}

          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button
              label={wornToday ? 'Worn today' : 'Wear today'}
              variant={wornToday ? 'accent' : 'primary'}
              block
              style={{ flex: 1 }}
              onPress={handleWear}
              disabled={wornToday || markWorn.isPending}
            />
            <Button
              label="Restyle"
              variant="outline"
              onPress={() =>
                nav.navigate(
                  'OutfitGenerate',
                  anchorGarmentId ? { garmentId: anchorGarmentId } : undefined,
                )
              }
            />
            <Button
              label={isSaved ? 'Saved' : 'Save'}
              variant={isSaved ? 'accent' : 'outline'}
              onPress={handleSaveToggle}
              disabled={isSaved || saveOutfit.isPending}
            />
          </View>

          {/* M18 — Try-it-on selfie comparison CTA. */}
          <Button
            label={tr('photoFeedback.tryOnAction')}
            variant="quiet"
            size="sm"
            onPress={() => nav.navigate('PhotoFeedback', { outfitId: outfit.id })}
            accessibilityHint="Take a mirror selfie and compare to this outfit"
          />

          <HelperSections
            accessoriesHook={helperState.accessoriesHook}
            combinationsHook={helperState.combinationsHook}
            cloneHook={helperState.cloneHook}
            accessoriesOpen={helperState.accessoriesOpen}
            variationsOpen={helperState.variationsOpen}
            cloneOpen={helperState.cloneOpen}
            filteredAccessorySuggestions={helperState.filteredAccessorySuggestions}
            accessoryRows={helperState.accessoryRowsData}
            accessoryRowsLoading={helperState.accessoryRowsLoading}
            addedAccessoryIds={helperState.addedAccessoryIds}
            addingAccessoryId={helperState.addingAccessoryId}
            onSuggestAccessories={helperState.handleSuggestAccessories}
            onTryVariations={helperState.handleTryVariations}
            onCloneDna={helperState.handleCloneDna}
            onCloseAccessories={() => helperState.setAccessoriesOpen(false)}
            onCloseVariations={() => helperState.setVariationsOpen(false)}
            onCloseClone={() => helperState.setCloneOpen(false)}
            onRefreshAccessories={helperState.handleRefreshAccessories}
            onRefreshCombinations={helperState.handleRefreshCombinations}
            onRefreshClone={helperState.handleRefreshClone}
            onAddAccessory={helperState.addAccessory}
            onOpenVariation={(seedIds) =>
              nav.navigate('OutfitGenerate', { seedGarmentIds: seedIds })
            }
            onOpenClone={(seedIds) =>
              nav.navigate('OutfitGenerate', { seedGarmentIds: seedIds })
            }
          />

          <FeedbackSection
            rating={rating}
            notes={notes}
            notesDirty={notesDirty}
            saveNotePending={saveNote.isPending}
            onRate={handleRate}
            onNotesChange={setNotes}
            onSaveNote={handleSaveNote}
            onCancelNote={() => setNotes(persistedNote)}
          />

          {/* M37 — slot composition. Replaces the prior flat horizontal
              piece strip with a vertical slotted list. The anchored slot
              renders a lock pill; the lock state persists across reopens
              via AsyncStorage. */}
          <SlotCompositionList
            slotGroups={slotGroups}
            itemCount={outfit.outfit_items?.length ?? 0}
            anchorGarmentId={anchorGarmentId}
            swapTargetItemId={swapTarget?.outfitItemId ?? null}
            onPressItem={(garmentId) => nav.push('GarmentDetail', { id: garmentId })}
            onSwap={handleOpenSwap}
            onAnchor={(garmentId) => {
              void handleAnchor(garmentId);
            }}
            onRemove={(item) => {
              void handleRemoveItem(item);
            }}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      {swapTarget ? (
        <SwapCandidateSheet
          slotLabelKey={swapTarget.slot}
          isLoading={swapHook.isLoadingCandidates}
          isSwapping={swapHook.isSwapping}
          candidates={swapHook.candidates}
          error={swapHook.candidatesError}
          onClose={handleCloseSwap}
          onSelect={handleSelectSwap}
        />
      ) : null}

      {/* Q-B — planner sheet (reuses TravelCapsule's DatePickerSheet for
          the month-grid primitive). Mounts always (Modal manages its own
          visibility) so the `visible` toggle drives the open animation.
          On confirm, writes `planned_outfits` for the picked date and —
          when picked === today — also marks the outfit worn so the
          "Wear today" semantics ride along. */}
      <DatePickerSheet
        visible={plannerOpen}
        title={tr('plannerSheet.title')}
        eyebrowText={tr('plannerSheet.eyebrow')}
        initialISO={plannerInitialISO}
        onClose={() => setPlannerOpen(false)}
        onConfirm={handlePlannerConfirm}
      />
    </SafeAreaView>
  );
}
