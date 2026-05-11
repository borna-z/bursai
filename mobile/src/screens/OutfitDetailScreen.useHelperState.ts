// OutfitDetailScreen — M17 helper-hook orchestration (N13 split).
//
// Bundles the three composition helpers (accessories / variations /
// clone-DNA) so the parent screen only sees a single state surface. The
// hook owns: per-helper paywall latches, the accessories row hydration
// query, "add to outfit" inserts, and the open/refresh handlers.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useSuggestAccessories } from '../hooks/useSuggestAccessories';
import { useSuggestCombinations } from '../hooks/useSuggestCombinations';
import { useCloneOutfitDNA } from '../hooks/useCloneOutfitDNA';
import { useAuth } from '../contexts/AuthContext';
import { SUBSCRIPTION_SENTINEL } from '../lib/edgeFunctionClient';
import { supabase } from '../lib/supabase';
import { Sentry } from '../lib/sentry';
import { t as tr } from '../lib/i18n';
import { showToast } from '../lib/toast';
import type { OutfitWithItems } from '../types/outfit';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function useOutfitDetailHelperState({
  outfit,
  nav,
}: {
  outfit: OutfitWithItems | null;
  nav: Nav;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const accessoriesHook = useSuggestAccessories();
  const combinationsHook = useSuggestCombinations();
  const cloneHook = useCloneOutfitDNA();

  const [accessoriesOpen, setAccessoriesOpen] = useState(false);
  const [variationsOpen, setVariationsOpen] = useState(false);
  const [cloneOpen, setCloneOpen] = useState(false);
  const paywallShownRef = useRef(false);

  // P0.1 — pre-compute garment ids already in this outfit so the
  // suggestion list never surfaces an accessory the user already owns.
  const existingItemGarmentIds = useMemo<Set<string>>(() => {
    const set = new Set<string>();
    for (const item of outfit?.outfit_items ?? []) {
      const gid = item.garment?.id;
      if (typeof gid === 'string' && gid.length > 0) set.add(gid);
    }
    return set;
  }, [outfit?.outfit_items]);

  const filteredAccessorySuggestions = useMemo(
    () => accessoriesHook.accessorySuggestions.filter(
      (s) => !existingItemGarmentIds.has(s.garment_id),
    ),
    [accessoriesHook.accessorySuggestions, existingItemGarmentIds],
  );
  const filteredAccessoryIds = useMemo(
    () => filteredAccessorySuggestions.map((s) => s.garment_id),
    [filteredAccessorySuggestions],
  );
  const accessoryIdsKey = useMemo(
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

  // Three independent per-helper paywall latches so a transient non-
  // sentinel error in one helper doesn't release the latches of the
  // other two.
  const accessoriesPaywallRef = useRef(false);
  const combinationsPaywallRef = useRef(false);
  const clonePaywallRef = useRef(false);
  useEffect(() => {
    const accSentinel = accessoriesHook.error === SUBSCRIPTION_SENTINEL;
    const combSentinel = combinationsHook.error === SUBSCRIPTION_SENTINEL;
    const cloneSentinel = cloneHook.error === SUBSCRIPTION_SENTINEL;

    if (!accSentinel) accessoriesPaywallRef.current = false;
    if (!combSentinel) combinationsPaywallRef.current = false;
    if (!cloneSentinel) clonePaywallRef.current = false;

    const newSentinel =
      (accSentinel && !accessoriesPaywallRef.current)
      || (combSentinel && !combinationsPaywallRef.current)
      || (cloneSentinel && !clonePaywallRef.current);
    if (newSentinel && !paywallShownRef.current) {
      if (accSentinel) accessoriesPaywallRef.current = true;
      if (combSentinel) combinationsPaywallRef.current = true;
      if (cloneSentinel) clonePaywallRef.current = true;
      paywallShownRef.current = true;
      nav.navigate('Paywall');
      return;
    }

    if (
      !accSentinel
      && !combSentinel
      && !cloneSentinel
      && paywallShownRef.current
    ) {
      paywallShownRef.current = false;
    }
  }, [accessoriesHook.error, combinationsHook.error, cloneHook.error, nav]);

  // Codex P2.4 — depend on the specific fields each callback reads.
  const accessoriesIsSuggesting = accessoriesHook.isSuggesting;
  const accessoriesIdsLen = accessoriesHook.accessoryGarmentIds.length;
  const accessoriesSuggest = accessoriesHook.suggest;
  const handleSuggestAccessories = useCallback(() => {
    if (!outfit) return;
    setAccessoriesOpen(true);
    if (accessoriesIdsLen === 0 && !accessoriesIsSuggesting) {
      void accessoriesSuggest(outfit.id);
    }
  }, [outfit, accessoriesIdsLen, accessoriesIsSuggesting, accessoriesSuggest]);

  const combinationsIsSuggesting = combinationsHook.isSuggesting;
  const combinationsCount = combinationsHook.combinations.length;
  const combinationsSuggest = combinationsHook.suggest;
  const handleTryVariations = useCallback(() => {
    if (!outfit) return;
    setVariationsOpen(true);
    if (combinationsCount === 0 && !combinationsIsSuggesting) {
      void combinationsSuggest();
    }
  }, [outfit, combinationsCount, combinationsIsSuggesting, combinationsSuggest]);

  const cloneIsCloning = cloneHook.isCloning;
  const cloneCloned = cloneHook.cloned;
  const cloneClone = cloneHook.clone;
  const handleCloneDna = useCallback(() => {
    if (!outfit) return;
    setCloneOpen(true);
    if (!cloneCloned && !cloneIsCloning) {
      void cloneClone(outfit.id);
    }
  }, [outfit, cloneCloned, cloneIsCloning, cloneClone]);

  // Explicit refresh handlers per section.
  const accessoriesReset = accessoriesHook.reset;
  const combinationsReset = combinationsHook.reset;
  const cloneReset = cloneHook.reset;
  const handleRefreshAccessories = useCallback(() => {
    if (!outfit) return;
    accessoriesReset();
    void accessoriesSuggest(outfit.id);
  }, [outfit, accessoriesReset, accessoriesSuggest]);
  const handleRefreshCombinations = useCallback(() => {
    if (!outfit) return;
    combinationsReset();
    void combinationsSuggest();
  }, [outfit, combinationsReset, combinationsSuggest]);
  const handleRefreshClone = useCallback(() => {
    if (!outfit) return;
    cloneReset();
    void cloneClone(outfit.id);
  }, [outfit, cloneReset, cloneClone]);

  // "+ Add to outfit" — inserts the accessory garment.
  const [addedAccessoryIds, setAddedAccessoryIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [addingAccessoryId, setAddingAccessoryId] = useState<string | null>(null);
  const addAccessory = useCallback(
    async (accessoryGarmentId: string) => {
      if (!outfit || !user) return;
      if (addedAccessoryIds.has(accessoryGarmentId)) return;
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
        queryClient.invalidateQueries({ queryKey: ['outfit', user.id, outfit.id] });
        queryClient.invalidateQueries({ queryKey: ['outfits'] });
      } catch (err) {
        Sentry.withScope((scope) => {
          scope.setTag('mutation', 'OutfitDetailScreen.addAccessory');
          Sentry.captureException(err instanceof Error ? err : new Error(String(err)));
        });
        showToast(
          'error',
          tr('outfitDetail.toast.couldNotAddAccessory'),
          err instanceof Error ? err.message : tr('common.alerts.tryAgain'),
        );
      } finally {
        setAddingAccessoryId(null);
      }
    },
    [outfit, user, addedAccessoryIds, existingItemGarmentIds, queryClient],
  );

  return {
    accessoriesHook,
    combinationsHook,
    cloneHook,
    accessoriesOpen,
    variationsOpen,
    cloneOpen,
    setAccessoriesOpen,
    setVariationsOpen,
    setCloneOpen,
    filteredAccessorySuggestions,
    accessoryRowsData: accessoryRowsQ.data ?? [],
    accessoryRowsLoading: accessoryRowsQ.isLoading,
    addedAccessoryIds,
    addingAccessoryId,
    handleSuggestAccessories,
    handleTryVariations,
    handleCloneDna,
    handleRefreshAccessories,
    handleRefreshCombinations,
    handleRefreshClone,
    addAccessory,
  };
}
