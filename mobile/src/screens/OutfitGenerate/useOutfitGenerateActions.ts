// Persist / wear / plan / save action handlers for OutfitGenerateScreen —
// extracted in Phase 3 polish.
//
// The orchestrator continues to own:
//   • generation lifecycle (`useGenerateOutfit`)
//   • route params + anchor metadata
//   • paywall sentinel routing
//   • the result-land success haptic
//
// This hook bundles the three persistence-driven actions (save / wear /
// plan) so the orchestrator stays focused on rendering and effect wiring.
// `succeededRef` is forwarded in so the unmount-cleanup contract in the
// parent stays intact (a fired save sets it true → swipe-back keeps the
// result populated).

import { useMemo } from 'react';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { hapticLight, hapticSuccess } from '../../lib/haptics';
import { usePersistGeneratedOutfit, useMarkOutfitWorn } from '../../hooks/useOutfits';
import { t as tr } from '../../lib/i18n';
import { showToast } from '../../lib/toast';
import type { RootStackParamList } from '../../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export interface PersistableItem {
  garment_id: string;
  slot: string;
}

export interface UseOutfitGenerateActionsArgs {
  nav: Nav;
  result: {
    outfit_id?: string | null;
    outfit_name?: string | null;
    occasion?: string | null;
    description?: string | null;
  } | null;
  persistableItems: PersistableItem[];
  savedOutfitId: string | null;
  setSavedOutfitId: (id: string) => void;
  preselectDate: string | undefined;
  // The orchestrator's success-marker — flipped to true before mutate so
  // a back-swipe during the in-flight window keeps the result populated.
  markSucceeded: () => void;
}

export function useOutfitGenerateActions({
  nav,
  result,
  persistableItems,
  savedOutfitId,
  setSavedOutfitId,
  preselectDate,
  markSucceeded,
}: UseOutfitGenerateActionsArgs) {
  const persistOutfit = usePersistGeneratedOutfit();
  const markWorn = useMarkOutfitWorn();

  const persistArgs = useMemo(
    () =>
      result
        ? {
            occasion: result.occasion ?? null,
            explanation: result.description ?? '',
            familyLabel: result.outfit_name ?? null,
            items: persistableItems,
          }
        : null,
    [result, persistableItems],
  );

  const persistPending = persistOutfit.isPending;
  const wearPending = markWorn.isPending;

  const showEmptyToast = () =>
    showToast(
      'error',
      tr('outfitGenerate.save.empty.title'),
      tr('outfitGenerate.save.empty.body'),
    );

  const handleSave = () => {
    if (!result || !persistArgs || persistPending || savedOutfitId) return;
    if (persistableItems.length === 0) {
      showEmptyToast();
      return;
    }
    hapticLight();
    markSucceeded();
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
    markSucceeded();
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

  const handlePlan = () => {
    if (!result || persistPending) return;
    const existing = savedOutfitId ?? result.outfit_id ?? null;
    if (existing) {
      hapticLight();
      markSucceeded();
      nav.navigate('OutfitDetail', {
        id: existing,
        openPlanner: true,
        preselectDate,
      });
      return;
    }
    if (!persistArgs || persistableItems.length === 0) {
      showEmptyToast();
      return;
    }
    hapticLight();
    persistOutfit.mutate(persistArgs, {
      onSuccess: ({ outfitId }) => {
        setSavedOutfitId(outfitId);
        markSucceeded();
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
      showEmptyToast();
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

  return {
    persistPending,
    wearPending,
    handleSave,
    handlePlan,
    handleWear,
  };
}
