// Outfit detail — opened from OutfitsScreen, HomeScreen Today's Look, or any inline outfit card.
// Sections (top→bottom): header (back · eyebrow · italic title · share + more) · 2x2 garment thumb
// grid · meta chips row · primary actions row (Wear today / Restyle / Save) · feedback section
// (5-star rating + notes input) · pieces horizontal scroll. Sticky header is via SafeAreaView;
// the body uses a KeyboardAvoidingView so the notes input doesn't get clipped on iOS.
//
// Mirrors design_handoff_burs_rn/source/extra-screens.jsx OutfitDetailScreen + the README "Outfit
// detail" section. Data is a fixture; route param `id` is parsed and passed to a future hook.

import React from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useTokens } from '../theme/ThemeProvider';
import { fonts, radii } from '../theme/tokens';
import { Eyebrow } from '../components/Eyebrow';
import { PageTitle } from '../components/PageTitle';
import { Button } from '../components/Button';
import { IconBtn } from '../components/IconBtn';
import { OutfitCard } from '../components/OutfitCard';
import { BackIcon, MoreIcon, StarIcon } from '../components/icons';
import {
  useOutfit,
  useMarkOutfitWorn,
  useSaveOutfit,
  useDeleteOutfit,
  useRateOutfit,
  useOutfitFeedback,
  useSaveOutfitNote,
} from '../hooks/useOutfits';
import { useSuggestAccessories } from '../hooks/useSuggestAccessories';
import { useSuggestCombinations } from '../hooks/useSuggestCombinations';
import { useCloneOutfitDNA } from '../hooks/useCloneOutfitDNA';
import { useAuth } from '../contexts/AuthContext';
import { SUBSCRIPTION_SENTINEL } from '../lib/edgeFunctionClient';
import { supabase } from '../lib/supabase';
import { Sentry } from '../lib/sentry';
import { t as tr } from '../lib/i18n';
import { useUpsertPlannedOutfit } from '../hooks/usePlannedOutfits';
import { useSignedUrl } from '../hooks/useSignedUrl';
import { useNow } from '../hooks/useNow';
import {
  groupGarmentsBySlot,
  localISODate,
  outfitDisplayName,
  outfitGradientHue,
} from '../lib/outfitDisplay';
import { OutfitSlotRow } from '../components/OutfitSlotRow';
import { useSwapGarment, type SwapCandidate } from '../hooks/useSwapGarment';
import type { OutfitItemWithGarment, OutfitWithItems } from '../types/outfit';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'OutfitDetail'>;

// M37 — anchor persistence. The `outfits` table has no `anchor_garment_id`
// column and the per-PR rules forbid running a migration without explicit
// user direction, so the lock state lives in AsyncStorage keyed by user +
// outfit. The anchor is fundamentally a regeneration-time concept (passed
// to the engine via `prefer_garment_ids`); persisting locally is enough to
// satisfy the wave's "reopen → anchor still shown" gate while keeping the
// surface migration-free.
const ANCHOR_STORAGE_PREFIX = 'm37:outfitAnchor:';
function anchorStorageKey(userId: string, outfitId: string): string {
  return `${ANCHOR_STORAGE_PREFIX}${userId}:${outfitId}`;
}

export function OutfitDetailScreen() {
  const t = useTokens();
  const nav = useNavigation<Nav>();
  const route = useRoute<Route>();
  const id = route.params?.id;
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const outfitQ = useOutfit(id);
  const outfit = outfitQ.data ?? null;

  const markWorn = useMarkOutfitWorn();
  const saveOutfit = useSaveOutfit();
  const deleteOutfit = useDeleteOutfit();
  const rateOutfit = useRateOutfit();
  const upsertPlanned = useUpsertPlannedOutfit();
  const feedbackQ = useOutfitFeedback(outfit?.id);
  const saveNote = useSaveOutfitNote();

  // M17 — composition helpers (lazy: hooks fire on first reveal, results
  // collapse-friendly). Each section opens its own collapsible card so
  // OutfitDetail stays scan-friendly until the user opts in.
  const accessoriesHook = useSuggestAccessories();
  const combinationsHook = useSuggestCombinations();
  const cloneHook = useCloneOutfitDNA();
  const [accessoriesOpen, setAccessoriesOpen] = React.useState(false);
  const [variationsOpen, setVariationsOpen] = React.useState(false);
  const [cloneOpen, setCloneOpen] = React.useState(false);
  const paywallShownRef = React.useRef(false);

  // P0.1 (Codex on PR #743) — pre-compute the set of garment ids ALREADY in
  // this outfit so the suggestion list never surfaces an accessory the
  // user already owns on this look. `outfit_items` has no UNIQUE on
  // (outfit_id, garment_id), so a remount + re-tap would otherwise
  // re-insert. Filter the suggestion list at render time AND defensively
  // gate the mutation below.
  const existingItemGarmentIds = React.useMemo<Set<string>>(() => {
    const set = new Set<string>();
    for (const item of outfit?.outfit_items ?? []) {
      const id = item.garment?.id;
      if (typeof id === 'string' && id.length > 0) set.add(id);
    }
    return set;
  }, [outfit?.outfit_items]);

  // Filtered suggestion list — anything already in the outfit is dropped
  // before render. Keeps the screen's "Add" semantics meaningful.
  const filteredAccessorySuggestions = React.useMemo(
    () => accessoriesHook.accessorySuggestions.filter(
      (s) => !existingItemGarmentIds.has(s.garment_id),
    ),
    [accessoriesHook.accessorySuggestions, existingItemGarmentIds],
  );
  const filteredAccessoryIds = React.useMemo(
    () => filteredAccessorySuggestions.map((s) => s.garment_id),
    [filteredAccessorySuggestions],
  );

  // Hydrate accessory garment titles in one round-trip — keyed off the
  // filtered set so re-renders after a successful add don't refetch the
  // hidden row.
  const accessoryIdsKey = React.useMemo(
    () => [...filteredAccessoryIds].sort().join(','),
    [filteredAccessoryIds],
  );
  const accessoryRowsQ = useQuery({
    queryKey: ['m17AccessoryRows', user?.id, accessoryIdsKey],
    enabled: !!user && filteredAccessoryIds.length > 0,
    queryFn: async () => {
      if (!user || filteredAccessoryIds.length === 0) return [];
      const { data, error: rowsErr } = await supabase
        .from('garments')
        .select('id, title, category, color_primary, rendered_image_path, original_image_path')
        .in('id', filteredAccessoryIds)
        .eq('user_id', user.id);
      if (rowsErr) throw rowsErr;
      return data ?? [];
    },
  });

  // Route to PaywallScreen when any helper surfaces the subscription
  // sentinel. Sticky ref so a back-and-forth doesn't re-pop the modal —
  // BUT (Codex P1.7 on PR #743) we must release the latch when ALL three
  // helpers' errors are no longer the sentinel. Without this, a user who
  // dismisses the paywall, upgrades, and retriggers a helper would never
  // re-route to the paywall again from this screen even if a later
  // entitlement check fails. Reset when every error is either null or a
  // non-sentinel value.
  React.useEffect(() => {
    const subLocked =
      accessoriesHook.error === SUBSCRIPTION_SENTINEL
      || combinationsHook.error === SUBSCRIPTION_SENTINEL
      || cloneHook.error === SUBSCRIPTION_SENTINEL;
    if (subLocked && !paywallShownRef.current) {
      paywallShownRef.current = true;
      nav.navigate('Paywall');
      return;
    }
    if (!subLocked && paywallShownRef.current) {
      // None of the helpers are reporting the sentinel any more — release
      // the latch so a future failure can re-route. Reads as "back to
      // ground state".
      paywallShownRef.current = false;
    }
  }, [accessoriesHook.error, combinationsHook.error, cloneHook.error, nav]);

  // Codex P2.4 on PR #743 — depend on the specific fields each callback
  // reads, not the whole hook return object (the hook returns a fresh
  // object each render, so depending on it would re-derive the callback
  // every render and defeat the useCallback memoization).
  const accessoriesIsSuggesting = accessoriesHook.isSuggesting;
  const accessoriesIdsLen = accessoriesHook.accessoryGarmentIds.length;
  const accessoriesSuggest = accessoriesHook.suggest;
  const handleSuggestAccessories = React.useCallback(() => {
    if (!outfit) return;
    setAccessoriesOpen(true);
    if (accessoriesIdsLen === 0 && !accessoriesIsSuggesting) {
      void accessoriesSuggest(outfit.id);
    }
  }, [outfit, accessoriesIdsLen, accessoriesIsSuggesting, accessoriesSuggest]);

  const combinationsIsSuggesting = combinationsHook.isSuggesting;
  const combinationsCount = combinationsHook.combinations.length;
  const combinationsSuggest = combinationsHook.suggest;
  const handleTryVariations = React.useCallback(() => {
    if (!outfit) return;
    setVariationsOpen(true);
    if (combinationsCount === 0 && !combinationsIsSuggesting) {
      // Codex P1.6 on PR #743 — `suggest()` takes no args; the function
      // scores the user's full wardrobe, no outfit_id required.
      void combinationsSuggest();
    }
  }, [outfit, combinationsCount, combinationsIsSuggesting, combinationsSuggest]);

  const cloneIsCloning = cloneHook.isCloning;
  const cloneCloned = cloneHook.cloned;
  const cloneClone = cloneHook.clone;
  const handleCloneDna = React.useCallback(() => {
    if (!outfit) return;
    setCloneOpen(true);
    if (!cloneCloned && !cloneIsCloning) {
      void cloneClone(outfit.id);
    }
  }, [outfit, cloneCloned, cloneIsCloning, cloneClone]);

  // Codex P1.8 on PR #743 — explicit refresh handlers per section. Re-firing
  // a helper costs an AI call so we don't auto-refresh on re-open; the user
  // gets a deliberate Refresh button inside each collapsible section. Each
  // handler re-runs the relevant hook regardless of current state (overrides
  // the "already have results" early-return above).
  const accessoriesReset = accessoriesHook.reset;
  const combinationsReset = combinationsHook.reset;
  const cloneReset = cloneHook.reset;
  const handleRefreshAccessories = React.useCallback(() => {
    if (!outfit) return;
    accessoriesReset();
    void accessoriesSuggest(outfit.id);
  }, [outfit, accessoriesReset, accessoriesSuggest]);
  const handleRefreshCombinations = React.useCallback(() => {
    if (!outfit) return;
    combinationsReset();
    void combinationsSuggest();
  }, [outfit, combinationsReset, combinationsSuggest]);
  const handleRefreshClone = React.useCallback(() => {
    if (!outfit) return;
    cloneReset();
    void cloneClone(outfit.id);
  }, [outfit, cloneReset, cloneClone]);

  // "+ Add to outfit" — inserts the accessory garment into the current
  // outfit's outfit_items as `slot: 'accessory'`. Idempotent at the screen
  // layer via a Set of just-added ids AND a defensive check against the
  // outfit's already-persisted garment ids (Codex P0.1 on PR #743). The
  // table has no UNIQUE constraint on (outfit_id, garment_id), so without
  // both gates a remount + re-tap would re-insert. The render-time filter
  // above hides already-added rows from the suggestion list; this gate is
  // defense-in-depth in case the filter ever lags.
  const [addedAccessoryIds, setAddedAccessoryIds] = React.useState<Set<string>>(
    () => new Set(),
  );
  const [addingAccessoryId, setAddingAccessoryId] = React.useState<string | null>(null);
  const addAccessory = React.useCallback(
    async (accessoryGarmentId: string) => {
      if (!outfit || !user) return;
      if (addedAccessoryIds.has(accessoryGarmentId)) return;
      // Defensive — never insert a row for a garment_id that's already
      // attached to this outfit. Defends against the no-UNIQUE-constraint
      // gap (see findings-log entry on outfit_items RLS).
      if (existingItemGarmentIds.has(accessoryGarmentId)) return;
      setAddingAccessoryId(accessoryGarmentId);
      try {
        const { error: insertErr } = await supabase.from('outfit_items').insert({
          outfit_id: outfit.id,
          garment_id: accessoryGarmentId,
          slot: 'accessory',
        });
        if (insertErr) throw insertErr;
        setAddedAccessoryIds((prev) => {
          const next = new Set(prev);
          next.add(accessoryGarmentId);
          return next;
        });
        // Codex P2.5 on PR #743 — match `useOutfit`'s actual queryKey shape
        // exactly. Hook is keyed `['outfit', user?.id, id]` (see
        // mobile/src/hooks/useOutfits.ts:77). The detail/list invalidations
        // re-fetch the outfit + the outfits index so the newly-added
        // accessory appears in the pieces strip + on the outfits screen.
        queryClient.invalidateQueries({ queryKey: ['outfit', user.id, outfit.id] });
        queryClient.invalidateQueries({ queryKey: ['outfits'] });
      } catch (err) {
        Sentry.withScope((s) => {
          s.setTag('mutation', 'OutfitDetailScreen.addAccessory');
          Sentry.captureException(err instanceof Error ? err : new Error(String(err)));
        });
        Alert.alert(
          'Could not add accessory',
          err instanceof Error ? err.message : 'Please try again.',
        );
      } finally {
        setAddingAccessoryId(null);
      }
    },
    [outfit, user, addedAccessoryIds, existingItemGarmentIds, queryClient],
  );

  const [rating, setRating] = React.useState(0);
  const [notes, setNotes] = React.useState('');

  // M37 — slot composition state.
  const [anchorGarmentId, setAnchorGarmentId] = React.useState<string | null>(null);
  const [swapTarget, setSwapTarget] = React.useState<{
    outfitItemId: string;
    slot: string;
    garmentId: string | null;
  } | null>(null);

  // Hydrate the anchor from AsyncStorage when the outfit id resolves. Best-
  // effort — a missing key is the common case (no anchor set yet) and is
  // not an error. The set-anchor path below writes the same key.
  React.useEffect(() => {
    let cancelled = false;
    if (!user || !outfit?.id) {
      setAnchorGarmentId(null);
      return;
    }
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(anchorStorageKey(user.id, outfit.id));
        if (cancelled) return;
        setAnchorGarmentId(stored && stored.length > 0 ? stored : null);
      } catch {
        // AsyncStorage outages shouldn't break the screen — the slot rows
        // simply render without a lock pill until the next read succeeds.
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
      try {
        if (garmentId) {
          await AsyncStorage.setItem(key, garmentId);
        } else {
          await AsyncStorage.removeItem(key);
        }
        setAnchorGarmentId(garmentId);
      } catch (err) {
        Alert.alert(
          'Could not save anchor',
          err instanceof Error ? err.message : 'Please try again.',
        );
      }
    },
    [user, outfit?.id],
  );

  const swapGarmentIds = React.useMemo(() => {
    if (!outfit) return [] as string[];
    return (outfit.outfit_items ?? [])
      .map((it) => it.garment?.id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0);
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
        // If the swapped-out garment was the anchor, clear the lock — the
        // anchored piece is no longer in the outfit.
        if (swapTarget.garmentId && anchorGarmentId === swapTarget.garmentId) {
          await persistAnchor(null);
        }
        setSwapTarget(null);
      } catch (err) {
        Alert.alert(
          'Could not swap',
          err instanceof Error ? err.message : 'Please try again.',
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
                Sentry.withScope((s) => {
                  s.setTag('mutation', 'OutfitDetailScreen.removeItem');
                  Sentry.captureException(
                    err instanceof Error ? err : new Error(String(err)),
                  );
                });
                Alert.alert(
                  'Could not remove',
                  err instanceof Error ? err.message : 'Please try again.',
                );
              }
            },
          },
        ],
      );
    },
    [outfit, user, anchorGarmentId, persistAnchor, queryClient],
  );

  // Hydrate rating + notes from outfit + outfit_feedback so a returning user
  // sees their prior values instead of an empty 5-star row + empty note that
  // a careless tap or save would overwrite. Audit K (rating) and L (notes).
  // Only seed once per outfit id — local edits win after the initial seed.
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

  // Reactive `now` so the wornToday gate flips correctly across midnight on
  // a screen left open. Same fix HomeScreen + PlanScreen got.
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
      .filter((id): id is string => Boolean(id));
    markWorn.mutate(
      { outfitId: outfit.id, garmentIds },
      {
        // Skip the toast when the mutation deduped — see useMarkOutfitWorn's
        // day-level idempotency check (Codex P2 round 10 on PR #738).
        onSuccess: (data) => {
          if (data?.deduped) return;
          Alert.alert('Marked worn', 'Saved to your wear log.');
        },
        onError: (err: unknown) =>
          Alert.alert(
            'Could not mark worn',
            err instanceof Error ? err.message : 'Please try again.',
          ),
      },
    );
  }, [outfit, markWorn]);

  const handleSaveToggle = React.useCallback(() => {
    if (!outfit || isSaved || saveOutfit.isPending) return;
    // Pass the outfit's garment roster so the Style Memory signal carries
    // garment_ids — the ingest_memory_event RPC needs the array (≥2
    // entries) to update positive pair-memory weight on a save.
    const garmentIds =
      outfit.outfit_items
        ?.map((it) => it.garment?.id)
        .filter((id): id is string => typeof id === 'string') ?? [];
    saveOutfit.mutate(
      { outfitId: outfit.id, garmentIds },
      {
        onError: (err: unknown) =>
          Alert.alert(
            'Could not save',
            err instanceof Error ? err.message : 'Please try again.',
          ),
      },
    );
  }, [outfit, isSaved, saveOutfit]);

  const handleAddToPlan = React.useCallback(() => {
    if (!outfit) return;
    upsertPlanned.mutate(
      { date: localISODate(now), outfitId: outfit.id },
      {
        onSuccess: () => Alert.alert('Added', 'Outfit added to today\'s plan.'),
        onError: (err: unknown) =>
          Alert.alert(
            'Could not add to plan',
            err instanceof Error ? err.message : 'Please try again.',
          ),
      },
    );
  }, [outfit, upsertPlanned, now]);

  const handleDelete = React.useCallback(() => {
    if (!outfit) return;
    Alert.alert('Delete', 'Delete this outfit? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteOutfit.mutate(outfit.id, {
            onSuccess: () => nav.goBack(),
            onError: (err: unknown) =>
              Alert.alert(
                'Could not delete',
                err instanceof Error ? err.message : 'Please try again.',
              ),
          });
        },
      },
    ]);
  }, [outfit, deleteOutfit, nav]);

  const handleRate = React.useCallback(
    (n: number) => {
      // Gate on isPending so a quick double-tap on adjacent stars can't
      // fire two concurrent mutations and create duplicate
      // `outfit_feedback` rows. The hook's defensive sweep collapses
      // duplicates if they slip through, but preventing them at the
      // screen layer is the cheaper first line of defence (Codex P2
      // round 8 on PR #738).
      if (rateOutfit.isPending) return;
      const next = n === rating ? 0 : n;
      setRating(next);
      if (!outfit) return;
      rateOutfit.mutate({ outfitId: outfit.id, rating: next });
    },
    [outfit, rating, rateOutfit],
  );

  if (outfitQ.isLoading) {
    return (
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
        <View style={[s.headerRow, { borderBottomColor: t.border }]}>
          <IconBtn ariaLabel="Back" onPress={() => nav.goBack()} variant="ghost">
            <BackIcon color={t.fg} />
          </IconBtn>
          <View style={{ flex: 1 }} />
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={t.accent} />
        </View>
      </SafeAreaView>
    );
  }

  if (!outfit) {
    return (
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
        <View style={[s.headerRow, { borderBottomColor: t.border }]}>
          <IconBtn ariaLabel="Back" onPress={() => nav.goBack()} variant="ghost">
            <BackIcon color={t.fg} />
          </IconBtn>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Eyebrow>Outfit</Eyebrow>
          </View>
          <View style={{ width: 40 }} />
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 10 }}>
          <Text
            style={{
              fontFamily: fonts.displayMedium,
              fontStyle: 'italic',
              fontSize: 22,
              color: t.fg,
              textAlign: 'center',
              letterSpacing: -0.22,
            }}>
            Outfit not found
          </Text>
          <Text
            style={{
              fontFamily: fonts.ui,
              fontSize: 13,
              color: t.fg2,
              textAlign: 'center',
              lineHeight: 19,
            }}>
            This look may have been removed. Go back and pick another.
          </Text>
          <Button label="Back" variant="outline" onPress={() => nav.goBack()} />
        </View>
      </SafeAreaView>
    );
  }

  const name = outfitDisplayName(outfit);
  const kicker = wornToday ? 'Worn today' : isSaved ? 'Saved look' : 'Outfit';
  // Schema has no per-outfit wear-count column. Until wear_logs aggregation
  // lands, render a binary "Worn"/"Never worn" instead of the misleading
  // "1 wear" that never increments past 1. Audit G on PR #718.
  const everWorn = Boolean(outfit.worn_at);

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}>
        <View style={[s.headerRow, { borderBottomColor: t.border }]}>
          <IconBtn ariaLabel="Back" onPress={() => nav.goBack()} variant="ghost">
            <BackIcon color={t.fg} />
          </IconBtn>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Eyebrow>Outfit</Eyebrow>
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
              {name}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <IconBtn
              ariaLabel="More options"
              variant="ghost"
              onPress={() =>
                Alert.alert('Options', undefined, [
                  { text: 'Add to plan', onPress: handleAddToPlan },
                  { text: 'Delete outfit', style: 'destructive', onPress: handleDelete },
                  { text: 'Cancel', style: 'cancel' },
                ])
              }>
              <MoreIcon color={t.fg} />
            </IconBtn>
          </View>
        </View>

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
              // Disable when already worn today so a stray re-tap doesn't
              // re-fire the mutation chain (extra wear_log row, extra
              // wear_count bump on every garment). Audit J on PR #718.
              label={wornToday ? 'Worn today' : 'Wear today'}
              variant={wornToday ? 'accent' : 'primary'}
              block
              style={{ flex: 1 }}
              onPress={handleWear}
              disabled={wornToday || markWorn.isPending}
            />
            <Button label="Restyle" variant="outline" onPress={() => nav.navigate('OutfitGenerate')} />
            <Button
              label={isSaved ? 'Saved' : 'Save'}
              variant={isSaved ? 'accent' : 'outline'}
              onPress={handleSaveToggle}
              disabled={isSaved || saveOutfit.isPending}
            />
          </View>

          {/* M18 — "Try it on" CTA routes to PhotoFeedback for a selfie
              comparison against this saved outfit. Sits above the M17
              composition helpers because it's a one-tap mainline action
              (vs. the helpers' opt-in, AI-cost-bearing affordances). */}
          <Button
            label={tr('photoFeedback.tryOnAction')}
            variant="quiet"
            size="sm"
            onPress={() => nav.navigate('PhotoFeedback', { outfitId: outfit.id })}
            accessibilityHint="Take a mirror selfie and compare to this outfit"
          />

          {/* M17 — composition helper actions. Collapsible so the screen
              stays scan-friendly until the user opts in. Codex P2.6 on PR
              #743: while a helper is mid-request, swap the label to a
              loading copy so the disabled state isn't silent. Codex P2.7:
              accessibilityHint describes the action's effect for VoiceOver
              / TalkBack users. */}
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <Button
              label={
                accessoriesHook.isSuggesting
                  ? tr('outfitDetail.helperLoading')
                  : tr('outfitDetail.suggestAccessoriesAction')
              }
              variant="quiet"
              size="sm"
              onPress={handleSuggestAccessories}
              disabled={accessoriesHook.isSuggesting}
              accessibilityHint="Suggests 3-5 accessories from your wardrobe"
            />
            <Button
              label={
                combinationsHook.isSuggesting
                  ? tr('outfitDetail.helperLoading')
                  : tr('outfitDetail.tryVariationsAction')
              }
              variant="quiet"
              size="sm"
              onPress={handleTryVariations}
              disabled={combinationsHook.isSuggesting}
              accessibilityHint="Generates 3 alternative outfits"
            />
            <Button
              label={
                cloneHook.isCloning
                  ? tr('outfitDetail.helperLoading')
                  : tr('outfitDetail.cloneDnaAction')
              }
              variant="quiet"
              size="sm"
              onPress={handleCloneDna}
              disabled={cloneHook.isCloning}
              accessibilityHint="Generates a fresh outfit in this style"
            />
          </View>

          {accessoriesOpen ? (
            <CollapsibleSection
              title={tr('outfitDetail.accessories.title')}
              onClose={() => setAccessoriesOpen(false)}
              onRefresh={handleRefreshAccessories}
              refreshDisabled={accessoriesHook.isSuggesting}>
              {accessoriesHook.isSuggesting || accessoryRowsQ.isLoading ? (
                <View style={{ paddingVertical: 12, alignItems: 'center' }}>
                  <ActivityIndicator color={t.accent} />
                </View>
              ) : accessoriesHook.error
                  && accessoriesHook.error !== SUBSCRIPTION_SENTINEL ? (
                <Text style={[s.sectionEmpty, { color: t.fg2 }]}>
                  {accessoriesHook.error}
                </Text>
              ) : filteredAccessorySuggestions.length === 0 ? (
                <Text style={[s.sectionEmpty, { color: t.fg2 }]}>
                  {tr('outfitDetail.accessories.empty')}
                </Text>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 10, paddingVertical: 4 }}>
                  {filteredAccessorySuggestions.map((sugg) => {
                    const accessoryId = sugg.garment_id;
                    const row = (accessoryRowsQ.data ?? []).find((r) => r.id === accessoryId);
                    const added = addedAccessoryIds.has(accessoryId);
                    const adding = addingAccessoryId === accessoryId;
                    // Codex P1.1 on PR #743 — surface the AI's `reason`
                    // when present (it's the human-readable narrative for
                    // why this accessory pairs with the look). Falls back
                    // to the existing color · category line so older / null
                    // rationales still get a meaningful subtitle.
                    const fallbackSub = [row?.color_primary, row?.category]
                      .filter(Boolean)
                      .join(' · ')
                      .toUpperCase();
                    const subtitle = sugg.reason ?? fallbackSub;
                    return (
                      <AccessoryCard
                        key={accessoryId}
                        title={row?.title ?? 'Accessory'}
                        subtitle={subtitle}
                        // Reasons are full sentences; uppercase the
                        // category fallback only.
                        subtitleUppercase={!sugg.reason}
                        imagePath={row?.rendered_image_path ?? row?.original_image_path ?? null}
                        added={added}
                        adding={adding}
                        onAdd={() => addAccessory(accessoryId)}
                      />
                    );
                  })}
                </ScrollView>
              )}
            </CollapsibleSection>
          ) : null}

          {variationsOpen ? (
            <CollapsibleSection
              title={tr('outfitDetail.variations.title')}
              onClose={() => setVariationsOpen(false)}
              onRefresh={handleRefreshCombinations}
              refreshDisabled={combinationsHook.isSuggesting}>
              {combinationsHook.isSuggesting ? (
                <View style={{ paddingVertical: 12, alignItems: 'center' }}>
                  <ActivityIndicator color={t.accent} />
                </View>
              ) : combinationsHook.error
                  && combinationsHook.error !== SUBSCRIPTION_SENTINEL ? (
                <Text style={[s.sectionEmpty, { color: t.fg2 }]}>
                  {combinationsHook.error}
                </Text>
              ) : combinationsHook.combinations.length === 0 ? (
                <Text style={[s.sectionEmpty, { color: t.fg2 }]}>
                  {tr('outfitDetail.variations.empty')}
                </Text>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 10, paddingVertical: 4 }}>
                  {combinationsHook.combinations.slice(0, 3).map((draft) => {
                    const itemCount = draft.items.length;
                    const sub = `${itemCount} PIECE${itemCount === 1 ? '' : 'S'}`;
                    const name =
                      draft.family_label?.trim()
                      || draft.occasion?.trim()
                      || 'Variation';
                    // Codex P1.4 on PR #743 — pass the full garment id list
                    // as `seedGarmentIds` so the engine builds an outfit
                    // around every source piece, not just the first. The
                    // earlier `garmentId: draft.items[0]?.garment_id`
                    // dropped N-1 garments and turned the variation tap
                    // into a single-anchor restyle.
                    const seedIds = draft.items
                      .map((it) => it.garment_id)
                      .filter((id): id is string => typeof id === 'string' && id.length > 0);
                    return (
                      <View key={draft.draftId} style={{ width: 220 }}>
                        <OutfitCard
                          name={name}
                          sub={sub}
                          onPress={() =>
                            nav.navigate('OutfitGenerate', {
                              seedGarmentIds: seedIds,
                            })
                          }
                        />
                      </View>
                    );
                  })}
                </ScrollView>
              )}
            </CollapsibleSection>
          ) : null}

          {cloneOpen ? (
            <CollapsibleSection
              title={tr('outfitDetail.cloneDna.title')}
              onClose={() => setCloneOpen(false)}
              onRefresh={handleRefreshClone}
              refreshDisabled={cloneHook.isCloning}>
              {cloneHook.isCloning ? (
                <View style={{ paddingVertical: 12, alignItems: 'center' }}>
                  <ActivityIndicator color={t.accent} />
                </View>
              ) : cloneHook.error
                  && cloneHook.error !== SUBSCRIPTION_SENTINEL ? (
                <Text style={[s.sectionEmpty, { color: t.fg2 }]}>
                  {cloneHook.error}
                </Text>
              ) : cloneHook.cloned ? (
                <View style={{ gap: 10 }}>
                  <Text style={[s.cloneBanner, { color: t.fg2, borderColor: t.border }]}>
                    {tr('outfitDetail.cloneDna.banner')}
                  </Text>
                  {(() => {
                    // Codex P1.4 on PR #743 — same fix as the variations
                    // branch: pass the full clone roster, not just the
                    // first garment. Wrapped in an IIFE so the seed list
                    // is computed once per render without leaking into
                    // the surrounding gap-style View.
                    const cloned = cloneHook.cloned;
                    const seedIds = cloned.items
                      .map((it) => it.garment_id)
                      .filter((id): id is string => typeof id === 'string' && id.length > 0);
                    return (
                      <OutfitCard
                        name={cloned.family_label?.trim() || 'Cloned look'}
                        sub={`${cloned.items.length} PIECE${cloned.items.length === 1 ? '' : 'S'}`}
                        onPress={() =>
                          nav.navigate('OutfitGenerate', {
                            seedGarmentIds: seedIds,
                          })
                        }
                      />
                    );
                  })()}
                </View>
              ) : (
                <Text style={[s.sectionEmpty, { color: t.fg2 }]}>
                  {tr('outfitDetail.variations.empty')}
                </Text>
              )}
            </CollapsibleSection>
          ) : null}

          <View>
            <Eyebrow style={{ marginBottom: 10 }}>How was it?</Eyebrow>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Pressable
                  key={n}
                  accessibilityRole="button"
                  accessibilityLabel={`Rate ${n} of 5`}
                  onPress={() => handleRate(n)}
                  hitSlop={6}>
                  <StarIcon size={28} color={n <= rating ? t.accent : t.fg3} active={n <= rating} />
                </Pressable>
              ))}
            </View>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Add a note — what worked, what didn't"
              placeholderTextColor={t.fg3}
              multiline
              style={[
                s.notesInput,
                {
                  color: t.fg,
                  backgroundColor: t.card,
                  borderColor: t.border,
                },
              ]}
            />
            {/* Save button surfaces only when the textarea diverges from what
                we last loaded. Without it the typed note was never persisted
                — audit L on PR #718. Cancel reverts to the persisted text
                so a half-typed change can be discarded explicitly. */}
            {notesDirty ? (
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                <Button
                  label={saveNote.isPending ? 'Saving…' : 'Save note'}
                  size="sm"
                  onPress={() => {
                    if (!outfit) return;
                    saveNote.mutate(
                      { outfitId: outfit.id, note: notes },
                      {
                        onError: (err: unknown) =>
                          Alert.alert(
                            'Could not save note',
                            err instanceof Error ? err.message : 'Please try again.',
                          ),
                      },
                    );
                  }}
                  disabled={saveNote.isPending}
                />
                <Button
                  label="Cancel"
                  size="sm"
                  variant="outline"
                  onPress={() => setNotes(persistedNote)}
                  disabled={saveNote.isPending}
                />
              </View>
            ) : null}
          </View>

          {/* M37 — slot composition. Replaces the prior flat horizontal
              piece strip with a vertical slotted list. Each slot exposes
              Swap / Anchor / Remove. The anchored slot renders a lock
              pill alongside its eyebrow; the lock state persists across
              reopens via AsyncStorage (see anchorStorageKey above). */}
          <View>
            <View style={s.sectionHead}>
              <Eyebrow>Garments in this outfit</Eyebrow>
              <Text style={{ color: t.fg2, fontFamily: fonts.uiMed, fontSize: 11 }}>
                {outfit.outfit_items?.length ?? 0}
              </Text>
            </View>
            <View style={{ gap: 10 }}>
              {slotGroups.map((group) =>
                group.items.map((item) => {
                  const garmentId = item.garment?.id ?? null;
                  const isAnchored =
                    !!garmentId && anchorGarmentId === garmentId;
                  return (
                    <OutfitSlotRow
                      key={item.id}
                      slot={group.slot}
                      item={item}
                      isAnchored={isAnchored}
                      onPress={() => {
                        if (garmentId) {
                          // `push` not `navigate` — drill-down across detail
                          // routes; navigate would collapse onto an existing
                          // GarmentDetail entry earlier in the stack and
                          // shorten the back stack.
                          nav.push('GarmentDetail', { id: garmentId });
                        }
                      }}
                      onSwap={() => handleOpenSwap(group.slot, item)}
                      onAnchor={() => {
                        if (!garmentId) return;
                        void handleAnchor(garmentId);
                      }}
                      onRemove={() => {
                        void handleRemoveItem(item);
                      }}
                      swapDisabled={!!swapTarget && swapTarget.outfitItemId !== item.id}
                    />
                  );
                }),
              )}
            </View>
          </View>
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
    </SafeAreaView>
  );
}

function CollapsibleSection({
  title,
  onClose,
  onRefresh,
  refreshDisabled,
  children,
}: {
  title: string;
  onClose: () => void;
  /** M17 Codex P1.8 — small refresh button alongside Hide. Re-fires the
   *  upstream hook when tapped. Don't auto-refresh on re-open (cost-aware
   *  — each tap costs an AI call); explicit user gesture only. Optional
   *  so non-helper sections can omit it. */
  onRefresh?: () => void;
  refreshDisabled?: boolean;
  children: React.ReactNode;
}) {
  const t = useTokens();
  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: t.border,
        borderRadius: radii.lg,
        backgroundColor: t.card,
        padding: 14,
        gap: 10,
      }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Eyebrow>{title}</Eyebrow>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          {onRefresh ? (
            <Pressable
              onPress={onRefresh}
              accessibilityRole="button"
              accessibilityLabel={tr('outfitDetail.refreshAction')}
              accessibilityHint="Re-runs the suggestion to fetch a fresh result"
              disabled={refreshDisabled}
              hitSlop={6}>
              <Text
                style={{
                  fontFamily: fonts.uiSemi,
                  fontSize: 11,
                  letterSpacing: 1.4,
                  color: refreshDisabled ? t.fg3 : t.fg2,
                  textTransform: 'uppercase',
                }}>
                {tr('outfitDetail.refreshAction')}
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Hide section"
            hitSlop={6}>
            <Text
              style={{
                fontFamily: fonts.uiSemi,
                fontSize: 11,
                letterSpacing: 1.4,
                color: t.fg2,
                textTransform: 'uppercase',
              }}>
              Hide
            </Text>
          </Pressable>
        </View>
      </View>
      {children}
    </View>
  );
}

function AccessoryCard({
  title,
  subtitle,
  subtitleUppercase = true,
  imagePath,
  added,
  adding,
  onAdd,
}: {
  title: string;
  subtitle: string;
  /** True for the eyebrow-style color · category fallback (uppercase,
   *  tracked) — false for the AI's `reason` narrative (sentence case,
   *  natural reading). M17 Codex P1.1 on PR #743. */
  subtitleUppercase?: boolean;
  imagePath: string | null;
  added: boolean;
  adding: boolean;
  onAdd: () => void;
}) {
  const t = useTokens();
  const { data: signedUrl } = useSignedUrl(imagePath);
  const [broken, setBroken] = React.useState(false);
  React.useEffect(() => setBroken(false), [imagePath, signedUrl]);
  const showImage = signedUrl && !broken;
  const hue = outfitGradientHue(title);

  return (
    <View
      style={{
        width: 150,
        borderWidth: 1,
        borderColor: t.border,
        borderRadius: radii.lg,
        backgroundColor: t.card,
        overflow: 'hidden',
      }}>
      <View style={{ width: '100%', height: 110, position: 'relative' }}>
        <LinearGradient
          colors={[`hsl(${hue}, 38%, 78%)`, `hsl(${(hue + 30) % 360}, 30%, 62%)`]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />
        {showImage ? (
          <Image
            source={{ uri: signedUrl }}
            onError={() => setBroken(true)}
            style={{ width: '100%', height: '100%' }}
            resizeMode="cover"
          />
        ) : null}
      </View>
      <View style={{ padding: 10, gap: 4 }}>
        <Text
          numberOfLines={1}
          style={{
            fontFamily: fonts.uiSemi,
            fontSize: 12.5,
            color: t.fg,
            letterSpacing: -0.13,
          }}>
          {title}
        </Text>
        {subtitle ? (
          <Text
            numberOfLines={subtitleUppercase ? 1 : 3}
            style={
              subtitleUppercase
                ? {
                    fontFamily: fonts.uiSemi,
                    fontSize: 9.5,
                    color: t.fg2,
                    letterSpacing: 1.4,
                    textTransform: 'uppercase',
                  }
                : {
                    fontFamily: fonts.ui,
                    fontSize: 11,
                    lineHeight: 15,
                    color: t.fg2,
                  }
            }>
            {subtitle}
          </Text>
        ) : null}
        <Button
          label={added ? 'Added' : tr('outfitDetail.accessories.addAction')}
          size="sm"
          variant={added ? 'accent' : 'outline'}
          onPress={onAdd}
          disabled={added || adding}
        />
      </View>
    </View>
  );
}

function MetaChip({ label }: { label: string }) {
  const t = useTokens();
  return (
    <View style={[s.metaChip, { backgroundColor: t.bg2, borderColor: t.border }]}>
      <Text
        style={{
          fontFamily: fonts.uiSemi,
          fontSize: 10,
          color: t.fg2,
          letterSpacing: 1.4,
          textTransform: 'uppercase',
        }}>
        {label}
      </Text>
    </View>
  );
}

function DetailThumbGrid({ outfit }: { outfit: OutfitWithItems }) {
  const items = (outfit.outfit_items ?? []).slice(0, 4);
  const fillerCount = Math.max(0, 4 - items.length);
  const fallbackHue = outfitGradientHue(outfit.id);
  return (
    <View style={s.thumbGrid}>
      {items.map((item) => (
        <DetailThumbCell key={item.id} item={item} fallbackHue={fallbackHue} />
      ))}
      {Array.from({ length: fillerCount }).map((_, i) => (
        <DetailThumbCell key={`filler-${i}`} item={null} fallbackHue={fallbackHue} />
      ))}
    </View>
  );
}

function DetailThumbCell({
  item,
  fallbackHue,
}: {
  item: OutfitItemWithGarment | null;
  fallbackHue: number;
}) {
  const t = useTokens();
  const garment = item?.garment ?? null;
  const imagePath = garment?.rendered_image_path ?? garment?.original_image_path ?? null;
  const { data: signedUrl } = useSignedUrl(imagePath);
  const [broken, setBroken] = React.useState(false);
  React.useEffect(() => setBroken(false), [imagePath, signedUrl]);
  const showImage = signedUrl && !broken;
  const hue = garment?.id ? outfitGradientHue(garment.id) : fallbackHue;
  const label = (item?.slot ?? garment?.category ?? '').toString().toUpperCase();

  return (
    <View style={[s.thumbCell, { borderColor: t.border }]}>
      <LinearGradient
        colors={[`hsl(${hue}, 38%, 78%)`, `hsl(${(hue + 30) % 360}, 30%, 62%)`]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />
      {showImage ? (
        <Image
          source={{ uri: signedUrl }}
          onError={() => setBroken(true)}
          style={{ width: '100%', height: '100%' }}
          resizeMode="cover"
        />
      ) : null}
      {label ? (
        <View style={[s.thumbLabel, { backgroundColor: t.card, borderColor: t.border }]}>
          <Text style={[s.thumbLabelText, { color: t.fg2 }]}>{label}</Text>
        </View>
      ) : null}
    </View>
  );
}

// M37 — Swap candidate bottom sheet. Modal-based to stay consistent with the
// rest of the screen (Alert.alert + inline Modal); a more elaborate
// @gorhom/bottom-sheet wasn't in deps when this wave shipped and isn't
// justified for a single picker. The sheet renders a list of garments whose
// canonical slot matches the row being swapped — already-attached garments
// are excluded by useSwapGarment.
function SwapCandidateSheet({
  slotLabelKey,
  isLoading,
  isSwapping,
  candidates,
  error,
  onClose,
  onSelect,
}: {
  slotLabelKey: string;
  isLoading: boolean;
  isSwapping: boolean;
  candidates: SwapCandidate[];
  error: string | null;
  onClose: () => void;
  onSelect: (garmentId: string) => void;
}) {
  const t = useTokens();
  const labelKey = `outfitDetail.slot.${slotLabelKey}`;
  const localized = tr(labelKey);
  const slotLabel =
    localized && localized !== labelKey
      ? localized
      : slotLabelKey.toUpperCase();

  return (
    <Modal
      visible
      transparent
      animationType="slide"
      onRequestClose={onClose}>
      <Pressable style={[s.sheetBackdrop]} onPress={onClose} accessible={false}>
        <View />
      </Pressable>
      <View style={[s.sheetContainer, { backgroundColor: t.card, borderColor: t.border }]}>
        <View style={[s.sheetHandle, { backgroundColor: t.border }]} />
        <View style={s.sheetHeader}>
          <Eyebrow>{tr('outfitDetail.swap.title', { slot: slotLabel })}</Eyebrow>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={tr('outfitDetail.swap.cancel')}
            hitSlop={6}>
            <Text
              style={{
                fontFamily: fonts.uiSemi,
                fontSize: 11,
                letterSpacing: 1.4,
                color: t.fg2,
                textTransform: 'uppercase',
              }}>
              {tr('outfitDetail.swap.cancel')}
            </Text>
          </Pressable>
        </View>
        {isLoading ? (
          <View style={{ paddingVertical: 32, alignItems: 'center' }}>
            <ActivityIndicator color={t.accent} />
            <Text style={[s.sectionEmpty, { color: t.fg2, marginTop: 8 }]}>
              {tr('outfitDetail.swap.loading')}
            </Text>
          </View>
        ) : error ? (
          <Text style={[s.sectionEmpty, { color: t.fg2 }]}>{error}</Text>
        ) : candidates.length === 0 ? (
          <Text style={[s.sectionEmpty, { color: t.fg2 }]}>
            {tr('outfitDetail.swap.empty')}
          </Text>
        ) : (
          <FlatList
            data={candidates}
            keyExtractor={(c) => c.garment.id}
            contentContainerStyle={{ paddingBottom: 24, gap: 8 }}
            renderItem={({ item }) => (
              <SwapCandidateRow
                candidate={item}
                disabled={isSwapping}
                onPress={() => onSelect(item.garment.id)}
              />
            )}
          />
        )}
      </View>
    </Modal>
  );
}

function SwapCandidateRow({
  candidate,
  disabled,
  onPress,
}: {
  candidate: SwapCandidate;
  disabled: boolean;
  onPress: () => void;
}) {
  const t = useTokens();
  const garment = candidate.garment;
  const imagePath = garment.rendered_image_path ?? garment.original_image_path ?? null;
  const { data: signedUrl } = useSignedUrl(imagePath);
  const [broken, setBroken] = React.useState(false);
  React.useEffect(() => setBroken(false), [imagePath, signedUrl]);
  const showImage = signedUrl && !broken;
  const hue = outfitGradientHue(garment.id);
  const sub = [garment.color_primary, garment.category].filter(Boolean).join(' · ').toUpperCase();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={garment.title ?? 'Garment'}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        s.candidateRow,
        {
          backgroundColor: t.bg2,
          borderColor: t.border,
          opacity: disabled ? 0.6 : pressed ? 0.85 : 1,
        },
      ]}>
      <View style={[s.candidateThumb, { borderColor: t.border }]}>
        <LinearGradient
          colors={[`hsl(${hue}, 38%, 78%)`, `hsl(${(hue + 30) % 360}, 30%, 62%)`]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {showImage ? (
          <Image
            source={{ uri: signedUrl }}
            onError={() => setBroken(true)}
            style={{ width: '100%', height: '100%' }}
            resizeMode="cover"
          />
        ) : null}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          numberOfLines={1}
          style={{
            fontFamily: fonts.uiSemi,
            fontSize: 13,
            color: t.fg,
            letterSpacing: -0.13,
          }}>
          {garment.title ?? 'Garment'}
        </Text>
        {sub ? (
          <Text
            numberOfLines={1}
            style={{
              fontFamily: fonts.uiSemi,
              fontSize: 9.5,
              color: t.fg2,
              letterSpacing: 1.4,
              textTransform: 'uppercase',
              marginTop: 2,
            }}>
            {sub}
          </Text>
        ) : null}
      </View>
    </Pressable>
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
  thumbGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  thumbCell: {
    width: '48%',
    flexGrow: 1,
    aspectRatio: 1,
    borderRadius: radii.lg,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  thumbLabel: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  thumbLabelText: {
    fontFamily: fonts.uiSemi,
    fontSize: 9,
    letterSpacing: 1.2,
  },
  metaChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  notesInput: {
    minHeight: 88,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    borderRadius: radii.lg,
    borderWidth: 1,
    fontFamily: fonts.ui,
    fontSize: 13,
    textAlignVertical: 'top',
  },
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 10,
  },
  sectionEmpty: {
    fontFamily: fonts.ui,
    fontSize: 13,
    lineHeight: 19,
    paddingVertical: 8,
  },
  cloneBanner: {
    fontFamily: fonts.uiSemi,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignSelf: 'flex-start',
  },
  sheetBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheetContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '72%',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    gap: 12,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    marginTop: 4,
    marginBottom: 4,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  candidateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  candidateThumb: {
    width: 48,
    height: 60,
    borderRadius: radii.md,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
});
