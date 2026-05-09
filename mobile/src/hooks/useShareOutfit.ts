// M41 — Share an outfit via the OS native share sheet.
//
// The wave file's PR B sketch involves rendering the outfit card off-screen
// with `react-native-view-shot` and shipping the resulting PNG via
// `expo-sharing`. Both packages are NOT yet in `mobile/package.json` and
// adding native modules in the same wave that ships an M41 inbox migration
// would force an EAS dev-client rebuild before the next on-device test.
//
// To stay under the wave's "scope guardrails" (the prompt explicitly
// authorizes the simpler version), this hook ships the deferred path:
// React Native's built-in `Share.share()` API surfaces the native sheet
// with the outfit's name + a deep-link to the outfit detail screen. No
// new native modules, no rebuild, no compositing pipeline.
//
// The fuller image-share path lands in a follow-up wave that adds
// `react-native-view-shot` + `expo-sharing` together with the EAS rebuild
// it requires.

import React from 'react';
import { Share } from 'react-native';

import { Sentry } from '../lib/sentry';
import { t as tr } from '../lib/i18n';

export type ShareOutfitInput = {
  /** Outfit row id — used to build the deep-link target. */
  outfitId: string;
  /** Display name used as the share-sheet message subject + headline. */
  name: string;
};

export type ShareOutfitResult =
  | { kind: 'shared'; activityType: string | null }
  | { kind: 'dismissed' };

// Public-facing deep-link host. The web app routes /outfit/:id back into the
// mobile app via universal links once installed; falling back to a plain
// burs.me URL means non-installers still get a usable share preview.
const OUTFIT_LINK_HOST = 'https://burs.me/outfit';

/**
 * Build the deep-link string the share-sheet prefills. Pulled out so a
 * future test can lock the format without exercising the full hook.
 */
export function buildOutfitShareLink(outfitId: string): string {
  return `${OUTFIT_LINK_HOST}/${outfitId}`;
}

/**
 * Build the message body. Translation-aware so Swedish users see Swedish
 * copy in the share sheet preview.
 */
export function buildOutfitShareMessage(input: ShareOutfitInput): string {
  return tr('share.outfit.message', {
    name: input.name,
    link: buildOutfitShareLink(input.outfitId),
  });
}

/**
 * Imperative hook returning a `share()` callable + an `isSharing` flag the
 * caller can use to disable the trigger button while the sheet is open.
 *
 * The flag isn't strictly necessary — `Share.share` is queueable on iOS —
 * but exposing it lets the screen render a faded button so accidental
 * double-taps don't open two sheets in rapid succession.
 */
export function useShareOutfit() {
  const [isSharing, setIsSharing] = React.useState(false);

  const share = React.useCallback(async (input: ShareOutfitInput): Promise<ShareOutfitResult> => {
    setIsSharing(true);
    try {
      const message = buildOutfitShareMessage(input);
      // Both fields are populated so iOS shows the message in apps like
      // Messages and Android joins them with a space. The dialog title
      // is iPad-only ("subject" of the activity).
      const result = await Share.share(
        {
          message,
          title: input.name,
        },
        {
          subject: input.name,
          dialogTitle: tr('share.outfit.dialogTitle'),
        },
      );

      if (result.action === Share.sharedAction) {
        return { kind: 'shared', activityType: result.activityType ?? null };
      }
      return { kind: 'dismissed' };
    } catch (err) {
      // Share.share rejects on iOS when the user is offline + tries to
      // share to AirDrop, and on Android for OS-level rendering errors.
      // Capture as a breadcrumb but rethrow so the screen can surface a
      // best-effort Alert. Mirrors the `captureMutationError` shape used
      // by the rest of the mobile hooks.
      Sentry.withScope((scope) => {
        scope.setTag('hook', 'useShareOutfit');
        Sentry.captureException(err);
      });
      throw err;
    } finally {
      setIsSharing(false);
    }
  }, []);

  return { share, isSharing };
}
