// Action handlers for GarmentDetailScreen — extracted in Phase 3.
//
// On native iOS / Android "action sheet" maps to `Alert.alert`'s native
// action prompt. The More options menu (`openMoreOptionsSheet`) builds
// that prompt and routes the user's pick to one of the four mutation
// handlers: mark-clean, add-to-laundry, delete, or edit-navigate. The
// per-tap mark-worn handler and the inline lingerie/wishlist toggles
// ride the same set of underlying mutation hooks, so they all live
// together here — exposing a single `useGarmentActions` hook avoids
// re-binding the mutations across the tab + sticky-bar + More menu
// surfaces in the orchestrator.
//
// The hook keeps `useTranslation()`-equivalent string resolution
// co-located with the surface that renders the prompts (Phase 3
// modularization risk #3), and returns the handlers + a small surface
// of mutation pending flags the orchestrator uses to disable buttons.

import React from 'react';
import { Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import {
  useDeleteGarment,
  useMarkLaundry,
  useMarkWorn,
  useUpdateGarment,
} from '../../hooks/useGarments';
import { hapticLight, hapticSuccess } from '../../lib/haptics';
import { t as tr } from '../../lib/i18n';
import type { Garment } from '../../types/garment';
import type { RootStackParamList } from '../../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export interface UseGarmentActionsResult {
  // Mutation-pending flags surfaced for sticky-bar disable state.
  markWornPending: boolean;
  // Action handlers.
  openMoreOptionsSheet: () => void;
  handleWearToday: (opts?: { wornToday?: boolean }) => void;
  handleToggleWishlist: (next: boolean) => void;
  handleToggleLingerie: (next: boolean) => void;
}

export function useGarmentActions(
  garment: Garment | null | undefined,
): UseGarmentActionsResult {
  const nav = useNavigation<Nav>();
  const markWorn = useMarkWorn();
  const markLaundry = useMarkLaundry();
  const updateGarment = useUpdateGarment();
  const deleteGarment = useDeleteGarment();

  const id = garment?.id;

  const handleWearToday = React.useCallback(
    (opts?: { wornToday?: boolean }) => {
      if (!id) return;
      if (opts?.wornToday) return;
      hapticSuccess();
      markWorn.mutate(id, {
        onError: (err) => {
          Alert.alert(
            tr('garmentDetail.alerts.couldNotLogWear.title'),
            err instanceof Error ? err.message : tr('garmentDetail.alerts.tryAgain'),
          );
        },
      });
    },
    [id, markWorn],
  );

  const handleAddToLaundry = React.useCallback(() => {
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
  }, [id, markLaundry]);

  const handleRemoveFromLaundry = React.useCallback(() => {
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
  }, [id, markLaundry]);

  const handleDelete = React.useCallback(() => {
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
  }, [id, deleteGarment, nav]);

  // Q-C2 — toggle handlers for the new personal flags. Both ride the
  // existing `useUpdateGarment` generic mutation so the cache patching +
  // smart-counts invalidation (Q-C1) come along for free. The
  // `unknown as GarmentUpdate` cast is a temporary bridge until
  // `supabase/types.gen.ts` is regenerated after the
  // `20260512000000_garment_personal_flags` migration applies — the new
  // columns aren't in the auto-generated `GarmentUpdate` type yet.
  // PostgREST tolerates extra columns (the field is real server-side
  // post-migration), so the cast is a TS-only bridge.
  // Q-C2 — wired to SettingsRow.toggle.onValueChange (single-arg
  // `(next: boolean) => void`). Originally curried for the Alert menu;
  // refactored to plain handlers after that path moved to inline
  // toggles — Codex P2 round 1 on Q-C2 PR #831.
  const handleToggleWishlist = React.useCallback(
    (next: boolean) => {
      if (!id) return;
      hapticLight();
      updateGarment.mutate(
        {
          id,
          updates: { is_wishlist: next } as unknown as Parameters<typeof updateGarment.mutate>[0]['updates'],
        },
        {
          onError: (err) => {
            Alert.alert(
              tr('garmentDetail.alerts.couldNotUpdate.title'),
              err instanceof Error ? err.message : tr('garmentDetail.alerts.tryAgain'),
            );
          },
        },
      );
    },
    [id, updateGarment],
  );
  const handleToggleLingerie = React.useCallback(
    (next: boolean) => {
      if (!id) return;
      hapticLight();
      updateGarment.mutate(
        {
          id,
          updates: { is_lingerie: next } as unknown as Parameters<typeof updateGarment.mutate>[0]['updates'],
        },
        {
          onError: (err) => {
            Alert.alert(
              tr('garmentDetail.alerts.couldNotUpdate.title'),
              err instanceof Error ? err.message : tr('garmentDetail.alerts.tryAgain'),
            );
          },
        },
      );
    },
    [id, updateGarment],
  );

  const openMoreOptionsSheet = React.useCallback(() => {
    if (!garment) return;
    const buttons: { text: string; style?: 'default' | 'cancel' | 'destructive'; onPress?: () => void }[] = [];
    if (garment.in_laundry) {
      buttons.push({ text: tr('garmentDetail.menu.markClean'), onPress: handleRemoveFromLaundry });
    } else {
      buttons.push({ text: tr('garmentDetail.menu.addToLaundry'), onPress: handleAddToLaundry });
    }
    // Q-C2 — Wishlist + Lingerie were initially added here, but
    // `Alert.alert` on Android only keeps the first three buttons (RN's
    // `Alert.js` slices to `buttons.slice(0, 3)` on the native module
    // boundary). Adding two more would silently drop Delete + Cancel on
    // Android, breaking critical paths. Toggles moved to inline
    // SettingsRows below — Codex P2 round 1 on Q-C2 PR #831.
    buttons.push({ text: tr('garmentDetail.menu.deleteGarment'), style: 'destructive', onPress: handleDelete });
    buttons.push({ text: tr('common.cancel'), style: 'cancel' });
    Alert.alert(tr('garmentDetail.alerts.options.title'), undefined, buttons);
  }, [garment, handleAddToLaundry, handleRemoveFromLaundry, handleDelete]);

  return {
    markWornPending: markWorn.isPending,
    openMoreOptionsSheet,
    handleWearToday,
    handleToggleWishlist,
    handleToggleLingerie,
  };
}
