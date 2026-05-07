// Add piece — Step 3 of 3 (review + save).
//
// Wiring (W5): receives { storagePath, photoUri, analysis } from Step 2 and lets the
// user review the AI-detected fields before saving.
//   • Hero shows the local photoUri (no signed-URL round-trip — the file is right there).
//   • Title is editable via TextInput; everything else is read-only display in W5
//     (category / color / material pickers land in Wave 9 with the bulk-edit UX).
//   • Confidence badge (green ≥0.7, amber otherwise) tells the user whether to scrutinise.
//   • Save → useAddGarment.mutateAsync → nav.reset to GarmentDetail. The reset uses
//     index: 1 so GarmentDetail is the active screen with MainTabs in the back stack —
//     swiping back from the new garment lands on the home tab, matching the web's
//     "you came from the FAB, here's your new piece" flow.
//
// Multi-photo (W9 follow-up): the piece-selector strip is gone in W5. When multi-photo
// lands, the strip returns and Save loops back to Step 2 with the next photo.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTokens } from '../theme/ThemeProvider';
import { fonts, radii } from '../theme/tokens';
import { Eyebrow } from '../components/Eyebrow';
import { PageTitle } from '../components/PageTitle';
import { Caption } from '../components/Caption';
import { Button } from '../components/Button';
import { Chip } from '../components/Chip';
import { IconBtn } from '../components/IconBtn';
import { BackIcon } from '../components/icons';
import { GarmentSaveChoiceSheet } from '../components/GarmentSaveChoiceSheet';
import { useAddGarment, OfflineQueuedError } from '../hooks/useAddGarment';
import { useDetectDuplicate, topDuplicate } from '../hooks/useDetectDuplicate';
import { t as tr } from '../lib/i18n';
import { hapticLight, hapticSuccess } from '../lib/haptics';
import { deleteUpload } from '../lib/imageUpload';
import {
  dropPendingUpload,
  takePendingUpload,
  type PendingUploadPromise,
} from '../lib/pendingUpload';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'AddPieceStep3'>;

const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
const SEASON_LABEL_KEYS: Record<string, string> = {
  spring: 'addpiece.step3.season.spring',
  summer: 'addpiece.step3.season.summer',
  autumn: 'addpiece.step3.season.autumn',
  winter: 'addpiece.step3.season.winter',
};

// Capitalise first character. The analyzer emits lowercase tokens for category /
// color / material; the display rows want title-case so they read like editorial
// copy rather than raw enum values. The em-dash empty marker uses the i18n
// `fieldEmpty` key so locales can swap it (e.g. for RTL or punctuation rules).
function titleCase(value: string | null | undefined): string {
  if (!value) return tr('addpiece.step3.fieldEmpty');
  return value.charAt(0).toUpperCase() + value.slice(1);
}

// Tiny debounce hook — used to throttle the title input feeding the
// duplicate-detection query so per-keystroke edits don't burn the
// detect_duplicate_garment 8/min rate limit. Inlined here because it's the
// only consumer; a shared util would be premature.
function useDebouncedTitle(value: string, ms: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}

export function AddPieceStep3() {
  const t = useTokens();
  const nav = useNavigation<Nav>();
  const route = useRoute<Route>();
  const params = route.params;
  const addGarment = useAddGarment();
  const [titleOverride, setTitleOverride] = useState<string>(params?.analysis.title ?? '');
  const [choiceOpen, setChoiceOpen] = useState(false);
  // In-flight guard for the entire save flow — covers the pre-mutation upload
  // await window where `addGarment.isPending` is still false. Without this, a
  // user could reopen the sheet and tap again while the first call is still
  // waiting on the upload promise; both paths would then execute mutateAsync
  // in parallel (TanStack Query has no default same-mutation serialization)
  // and create duplicate garment rows + duplicate render/enrichment side
  // effects. Codex P1 on PR #725.
  //
  // Ref + state pair: the ref is the source of truth for reentrancy (state
  // setters are async, so two double-taps fired in the same tick both see the
  // stale `isSaving === false` snapshot). The state mirrors the ref so the
  // sheet + Save button can disable themselves on rerender.
  const savingRef = useRef(false);
  const [isSaving, setIsSaving] = useState(false);
  // Pending-upload promise pulled out of the global registry on first read so the
  // sheet's two paths (Studio / Original) share a single resolution. `take` deletes
  // the entry from the module on first read; we cache it here in case the user
  // taps Cancel and then opens the sheet again.
  const uploadPromiseRef = useRef<PendingUploadPromise | null>(null);
  // Tracks whether a save successfully landed. Used by the unmount cleanup to
  // distinguish "user backed out / re-scanned" (delete the orphan) from "save
  // succeeded → nav.reset → unmount" (don't touch — the saved garment row owns
  // the storage object now). Codex round 5 P2 on PR #725.
  const savedRef = useRef(false);
  // Deferred cleanup callback. Set by the unmount handler IF the user navigates
  // away while a save is in flight. handleSave's finally invokes it after
  // savingRef has been cleared and savedRef reflects the outcome — runCleanup
  // is internally guarded by savedRef, so a successful save no-ops it; a
  // failed save runs the orphan-delete path. Codex round 10 P2 on PR #725.
  const pendingCleanupRef = useRef<(() => void) | null>(null);

  // Resolve the deferred storagePath if Step 2 navigated us here before the
  // upload landed. Idempotent — repeat calls return the cached promise.
  const getUploadPromise = (): PendingUploadPromise | null => {
    if (uploadPromiseRef.current) return uploadPromiseRef.current;
    if (!params?.uploadId) return null;
    const promise = takePendingUpload(params.uploadId);
    if (promise) uploadPromiseRef.current = promise;
    return uploadPromiseRef.current;
  };

  // Unmount cleanup: drop any pending-upload entry the user never consumed and
  // best-effort delete the storage object if it had already landed. Without this
  // a back-out / re-scan / nav.reset-without-save would leave the entry in the
  // module map for the app's lifetime AND leak a JPEG in the user's bucket.
  // savedRef gates the storage delete — on the happy save path, nav.reset
  // unmounts Step 3 too, but we MUST NOT delete the file the saved garment row
  // now references.
  //
  // Codex round 6 P1: if the user backs out before getUploadPromise() ever ran
  // (e.g. immediately taps Re-scan on entering Step 3), uploadPromiseRef is
  // still null — `dropPendingUpload` would just remove the Map entry without
  // ever attaching a delete handler, so the in-flight upload would land and
  // its storage object would leak. We need to TAKE the promise (not just drop)
  // so we can chain .then(deleteUpload) before letting the cleanup return.
  useEffect(() => {
    const uploadId = params?.uploadId;
    // Capture the direct storagePath at mount — Step 2's base64-fallback path
    // navigates with `storagePath` populated and no `uploadId` (line 213-219 of
    // AddPieceStep2.tsx). On that flow neither the pendingUpload registry nor
    // the cached promise references the file, so a back-out without save would
    // leak the JPEG forever. Codex round 8 P2 on PR #725.
    const directStoragePath = params?.storagePath ?? null;
    return () => {
      // Build the orphan-delete work as a closure so we can either run it now
      // (no save in flight) or defer it until the save settles. The closure
      // re-checks savedRef at invocation time so a successful save no-ops it.
      const runCleanup = () => {
        if (savedRef.current) return;
        // Prefer the cached promise; fall back to taking from the registry if
        // nobody read it yet (early-exit path). takePendingUpload is idempotent
        // — a no-op if Step 2 already cleared the entry on its own unmount path
        // (shouldn't happen since Step 2 only clears on non-transfer flows).
        let promise = uploadPromiseRef.current;
        if (!promise && uploadId) {
          promise = takePendingUpload(uploadId) ?? null;
        } else if (uploadId) {
          // We did consume earlier — make sure the registry entry isn't stranded
          // (takePendingUpload already deletes on consumption, but a defensive
          // drop here protects against future wiring changes in the registry).
          dropPendingUpload(uploadId);
        }
        if (promise) {
          promise.then((res) => deleteUpload(res.storagePath)).catch(() => {});
        } else if (directStoragePath) {
          // Direct-path arrival (base64-fallback in Step 2): the file is already
          // in storage and there's no promise to await. Delete it eagerly.
          void deleteUpload(directStoragePath);
        }
      };
      // Codex round 10 P2 on PR #725: if a save is in flight when the user
      // navigates away (back / re-scan), defer cleanup to handleSave's finally
      // instead of running it now. Round 7's eager early-return left the file
      // orphaned forever when the save subsequently failed; round 10 splits
      // the two phases so:
      //   - mid-save unmount + save success → savedRef=true, deferred no-ops
      //   - mid-save unmount + save failure → finally runs deferred runCleanup
      //   - no save in flight → run cleanup immediately (back-out / re-scan)
      if (savingRef.current) {
        pendingCleanupRef.current = runCleanup;
        return;
      }
      runCleanup();
    };
    // params?.uploadId / storagePath are stable for the lifetime of this screen
    // instance — React Navigation creates a new instance on re-entry, so
    // capturing once on mount is correct.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // M4 — duplicate detection. Hooks must run unconditionally (rules-of-hooks),
  // so they're declared above the no-params early return. The query is
  // disabled when category is missing — a missing-params render passes a
  // null input and the hook short-circuits via its `enabled` gate.
  //
  // resolvedStoragePath: starts as the direct path (Step 2's base64-fallback)
  // or null. The effect below awaits the parallel-upload promise and flips it
  // to the real storage path once available, which re-fires the duplicate
  // query with image_path so visual matches surface even when attribute
  // scoring alone wouldn't reach the 0.85 modal threshold. Codex P2 round 2.
  const [resolvedStoragePath, setResolvedStoragePath] = useState<string | null>(
    () => params?.storagePath ?? null,
  );
  useEffect(() => {
    if (params?.storagePath || !params?.uploadId) return;
    if (!uploadPromiseRef.current) {
      const promise = takePendingUpload(params.uploadId);
      if (!promise) return;
      uploadPromiseRef.current = promise;
    }
    let cancelled = false;
    uploadPromiseRef.current
      .then((res) => {
        if (cancelled) return;
        setResolvedStoragePath(res.storagePath);
      })
      // A rejected upload just leaves the duplicate query attribute-only —
      // matching handleSave's failure path. Save itself surfaces the error
      // via friendlySaveError; duplicate detection has no UX to surface here.
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [params?.uploadId, params?.storagePath]);

  // Codex P2 round 3: every keystroke on the title used to refire the
  // duplicate query — `detect_duplicate_garment` is rate-limited at 8/min,
  // so a 9-char edit could burn the budget and suppress the actual warning
  // with a 429 by the time the visual check is ready. Debounce the
  // title-derived input by 600ms so the user is mid-pause before we re-ask.
  // The trim() lives inside the debounce target so a "  Blue Tee   " edit
  // doesn't beat the debounce by churning whitespace.
  const debouncedDuplicateTitle = useDebouncedTitle(
    titleOverride.trim() || (params?.analysis.title ?? ''),
    600,
  );

  const duplicateInput = useMemo(
    () =>
      params?.analysis
        ? {
            image_path: resolvedStoragePath,
            category: params.analysis.category ?? null,
            color_primary: params.analysis.color_primary ?? null,
            title: debouncedDuplicateTitle || params.analysis.title,
            subcategory: params.analysis.subcategory ?? null,
            material: params.analysis.material ?? null,
          }
        : null,
    [
      resolvedStoragePath,
      params?.analysis,
      debouncedDuplicateTitle,
    ],
  );
  const duplicateQuery = useDetectDuplicate(duplicateInput);
  const duplicateMatch = topDuplicate(duplicateQuery.data);

  // Surface the modal once per match: track which garment_id we've already
  // shown a prompt for so editing the title (which fires a fresh query) doesn't
  // re-pop the modal after the user already chose "Add anyway".
  //
  // Codex P2 round 4: if the duplicate query resolves AFTER the user has
  // already opened the save sheet and started handleSave, popping the modal
  // creates a race — "View existing" would nav.reset to the cached garment
  // while the in-flight mutateAsync still inserts a new (duplicate) row and
  // handleSave's onSuccess nav.reset competes with ours. Suppress the prompt
  // once save is in flight, and hide an already-open modal via the visible
  // gate below.
  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
  const duplicateAcknowledgedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!duplicateMatch) return;
    if (savingRef.current || addGarment.isPending) return;
    if (duplicateAcknowledgedRef.current === duplicateMatch.garment_id) return;
    setDuplicateModalOpen(true);
  }, [duplicateMatch, addGarment.isPending]);

  // Defensive guard — without route params the screen has nothing to render. Bounce
  // the user back to Step 1 instead of crashing on `params.analysis.title`.
  if (!params) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={['top']}>
        <View style={s.fallback}>
          <Text style={{ fontFamily: fonts.ui, color: t.fg }}>{tr('addpiece.step3.fallback.body')}</Text>
          <Button label={tr('addpiece.step3.fallback.startOver')} onPress={() => nav.navigate('AddPieceStep1')} />
        </View>
      </SafeAreaView>
    );
  }

  const { storagePath, photoUri, analysis, source } = params;
  // Missing confidence (`null`) is treated as low — the badge surfaces a
  // prompt to review fields rather than the auto-confirmed copy. Codex P2
  // round on PR #738.
  const confidenceHigh = typeof analysis.confidence === 'number' && analysis.confidence >= 0.7;
  const seasonsLower = analysis.season_tags.map((s) => s.toLowerCase());

  const dismissDuplicate = (acknowledge: boolean) => {
    if (acknowledge && duplicateMatch) {
      duplicateAcknowledgedRef.current = duplicateMatch.garment_id;
    }
    setDuplicateModalOpen(false);
  };

  const onViewExistingDuplicate = () => {
    if (!duplicateMatch) return;
    hapticLight();
    dismissDuplicate(true);
    // Codex P2 round 2: nav.navigate() pushes GarmentDetail on top while
    // Step 3 stays mounted — the unmount-cleanup effect never runs and the
    // newly-uploaded JPEG sits orphaned in storage until the user happens to
    // pop back. Treat "View existing" as abandoning this new garment: reset
    // the stack the same way handleSave does, so Step 3 unmounts and its
    // cleanup runCleanup fires (savedRef stays false → orphan delete runs).
    nav.reset({
      index: 1,
      routes: [
        { name: 'MainTabs' },
        { name: 'GarmentDetail', params: { id: duplicateMatch.garment_id } },
      ],
    });
  };

  const onAddAnyway = () => {
    hapticLight();
    dismissDuplicate(true);
  };

  // Map raw exception text to user-facing copy. PostgREST and supabase-js bubble up
  // wire-format messages ("duplicate key value violates unique constraint",
  // "FetchError: Network request failed", etc.) that are noise to the end user.
  const friendlySaveError = (err: unknown): string => {
    if (!(err instanceof Error)) return tr('addpiece.step3.error.generic');
    const m = err.message.toLowerCase();
    if (m.includes('network') || m.includes('fetch')) {
      return tr('addpiece.step3.error.network');
    }
    if (m.includes('duplicate')) {
      return tr('addpiece.step3.error.duplicate');
    }
    if (m.includes('not authenticated')) {
      return tr('addpiece.step3.error.notSignedIn');
    }
    if (m.includes('upload was lost') || m.includes('re-add')) {
      return tr('addpiece.step3.error.uploadLost');
    }
    return tr('addpiece.step3.error.generic');
  };

  const handleSave = async (enableStudioQuality: boolean) => {
    // Reentrancy guard — if a prior tap is still resolving the upload await OR
    // running mutateAsync, drop this call. Ref check (not state) because two
    // taps in the same tick both see the same stale isSaving snapshot before
    // React rerenders.
    if (savingRef.current) return;
    savingRef.current = true;
    setIsSaving(true);
    hapticLight();
    setChoiceOpen(false);
    try {
      // Resolve the storagePath. If Step 2 already finished its upload, the param
      // is populated and we save immediately. If not, await the in-flight upload
      // before calling useAddGarment — analyze had a head start, so the wait is
      // typically <500ms by the time the user has reviewed the form.
      let resolvedPath = storagePath;
      if (!resolvedPath) {
        const promise = getUploadPromise();
        if (!promise) {
          throw new Error('Upload was lost — please re-add this piece.');
        }
        try {
          const upRes = await promise;
          resolvedPath = upRes.storagePath;
        } catch (uploadErr) {
          // Codex round 11 P2 on PR #725: a failed upload poisons
          // uploadPromiseRef — a subsequent Save tap would re-await the same
          // rejected promise and fail identically. Clear the cached promise so
          // the next Save attempt's getUploadPromise() returns null and we
          // surface "Upload was lost" (which friendlySaveError now maps to a
          // re-scan prompt). The registry entry was already consumed by
          // takePendingUpload on the first read, so no extra cleanup needed.
          uploadPromiseRef.current = null;
          throw uploadErr;
        }
      }

      const garment = await addGarment.mutateAsync({
        storagePath: resolvedPath,
        analysis,
        source,
        enableStudioQuality,
        title: titleOverride.trim() || analysis.title,
        category: analysis.category,
      });
      hapticSuccess();
      // Mark saved BEFORE nav.reset — once the navigator unmounts this screen,
      // the cleanup effect runs synchronously and reads savedRef. Setting it true
      // first prevents the cleanup from deleting the storage object the saved
      // garment row now references.
      savedRef.current = true;
      // index: 1 makes GarmentDetail the active screen, with MainTabs in the back stack
      // so the swipe-back gesture lands on the home tab. (index: 0 with two routes would
      // surface MainTabs and stash GarmentDetail under it — wrong UX.)
      nav.reset({
        index: 1,
        routes: [
          { name: 'MainTabs' },
          { name: 'GarmentDetail', params: { id: garment.id } },
        ],
      });
    } catch (err) {
      // M5 — offline queue. The save was tucked into the offline queue; the
      // file will replay when the network returns. Treat as "done with the
      // AddPiece flow" from the user's POV — they've reviewed and committed
      // — but unwind to MainTabs since there's no garment row id to nav to.
      // The offlineQueue handler also retries the upload promise's resolved
      // path, so we mark savedRef=true to skip the orphan cleanup (the
      // queued payload owns the storagePath now).
      if (err instanceof OfflineQueuedError) {
        savedRef.current = true;
        Alert.alert(
          tr('addpiece.step3.offline.title'),
          tr('addpiece.step3.offline.body'),
        );
        nav.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
      } else {
        Alert.alert(tr('addpiece.step3.saveFailed.title'), friendlySaveError(err));
      }
    } finally {
      savingRef.current = false;
      setIsSaving(false);
      // Codex round 10 P2: if the user unmounted Step 3 while this save was in
      // flight, the cleanup effect parked a closure here instead of running
      // it. Invoke it now — runCleanup is internally guarded by savedRef, so
      // a successful save no-ops, and a failed save runs the orphan delete.
      const deferred = pendingCleanupRef.current;
      if (deferred) {
        pendingCleanupRef.current = null;
        deferred();
      }
    }
  };

  const openChoiceSheet = () => {
    if (isSaving) return;
    hapticLight();
    setChoiceOpen(true);
  };

  // Either flag covers a different phase: isSaving spans the upload-await window;
  // addGarment.isPending spans the mutateAsync round-trip. Both must keep the UI
  // disabled to fully cover the race surface.
  const saveBusy = isSaving || addGarment.isPending;

  // "Re-scan" pops back to Step 1 instead of nav.goBack() to Step 2 — Step 2 keeps its
  // post-success state in the back stack (idle render with no in-flight work), so a
  // straight goBack would land the user on a "loading…" screen that never resolves.
  // Round 2 audit (P/O finding) — using nav.navigate to an existing route pops the stack
  // back to it, dropping Step 2 + Step 3 cleanly.
  const handleRescan = () => {
    hapticLight();
    nav.navigate('AddPieceStep1');
  };

  // Codex P2 on PR #738: a tap on the header back button used to silently
  // pop the screen, dropping the upload + analysis the user just spent
  // 2-5 seconds producing. Confirm before discarding when there's a
  // successful analysis on the screen (the only state Step 3 ever renders;
  // the no-params bail-out above handles the missing-analysis case). The
  // unmount cleanup effect still runs on the discard path — savedRef stays
  // false, so the orphan-delete fires and frees the storage object.
  const confirmBack = () => {
    if (!params?.analysis) {
      nav.goBack();
      return;
    }
    Alert.alert(
      tr('addpiece.step3.discard.title'),
      tr('addpiece.step3.discard.body'),
      [
        { text: tr('common.cancel'), style: 'cancel' },
        { text: tr('common.discard'), style: 'destructive', onPress: () => nav.goBack() },
      ],
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={['top']}>
      {/* ============ HEADER ============ */}
      <View style={[s.header, { borderBottomColor: t.border }]}>
        <IconBtn variant="ghost" onPress={confirmBack} ariaLabel={tr('common.back')}>
          <BackIcon color={t.fg} />
        </IconBtn>
        <View style={{ flex: 1 }}>
          <Eyebrow style={{ marginBottom: 2 }}>{tr('addpiece.step3.headerEyebrow')}</Eyebrow>
          <PageTitle size={26}>{tr('addpiece.step3.headerTitle')}</PageTitle>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={tr('addpiece.step3.rescan.aria')}
          onPress={handleRescan}
          style={{ paddingHorizontal: 6, paddingVertical: 8 }}>
          <Text style={{ fontFamily: fonts.uiMed, fontSize: 13, color: t.accent, fontWeight: '500' }}>
            {tr('addpiece.step3.rescan')}
          </Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 24, gap: 14 }}
        showsVerticalScrollIndicator={false}>
        {/* ============ HERO ============ */}
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
          <View
            style={[
              s.heroImage,
              { borderColor: t.border, backgroundColor: t.bg2 },
            ]}>
            <Image
              source={{ uri: photoUri }}
              style={StyleSheet.absoluteFillObject}
              resizeMode="cover"
            />
          </View>
          <View style={{ flex: 1, paddingTop: 4 }}>
            <Eyebrow style={{ marginBottom: 4 }}>{tr('addpiece.step3.detected')}</Eyebrow>
            <Text
              style={{
                fontFamily: fonts.displayMedium,
                fontStyle: 'italic',
                fontWeight: '500',
                fontSize: 22,
                lineHeight: 26,
                letterSpacing: -0.22,
                color: t.fg,
              }}>
              {analysis.title || tr('addpiece.step3.untitled')}
            </Text>
            {/* Confidence badge — accent gold for high-trust auto-fill, soft destructive
                terracotta for "review carefully". Honours the single-accent token rule
                (mobile/CLAUDE.md): no new brand colours, just accent + destructive
                already in tokens.ts. Audit round 2 — replaces hardcoded rgba(). */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 10 }}>
              <View
                accessible
                accessibilityLabel={
                  confidenceHigh
                    ? tr('addpiece.step3.confidence.high.aria')
                    : tr('addpiece.step3.confidence.low.aria')
                }
                style={[
                  s.confidenceBadge,
                  {
                    backgroundColor: confidenceHigh ? t.accentSoft : t.destructiveSoft,
                    borderColor: confidenceHigh ? t.accent : t.destructive,
                  },
                ]}>
                <Text
                  style={{
                    fontFamily: fonts.uiSemi,
                    fontSize: 10,
                    letterSpacing: 1.2,
                    textTransform: 'uppercase',
                    color: confidenceHigh ? t.accent : t.destructive,
                  }}>
                  {confidenceHigh ? tr('addpiece.step3.confidence.high') : tr('addpiece.step3.confidence.low')}
                </Text>
              </View>
              <Chip label={titleCase(analysis.category)} />
              {analysis.color_primary ? <Chip label={titleCase(analysis.color_primary)} /> : null}
            </View>
          </View>
        </View>

        {/* ============ TITLE INPUT ============ */}
        <View style={{ gap: 6 }}>
          <Text
            style={{
              fontFamily: fonts.uiSemi,
              fontSize: 10,
              letterSpacing: 1.4,
              color: t.fg2,
              textTransform: 'uppercase',
            }}>
            {tr('addpiece.step3.titleLabel')}
          </Text>
          <TextInput
            value={titleOverride}
            onChangeText={setTitleOverride}
            placeholder={analysis.title || tr('addpiece.step3.titlePlaceholder')}
            placeholderTextColor={t.fg3}
            style={[
              s.titleInput,
              { borderColor: t.border, backgroundColor: t.card, color: t.fg },
            ]}
            maxLength={60}
            returnKeyType="done"
          />
        </View>

        {/* ============ READ-ONLY DETAIL ROWS ============ */}
        <View style={{ gap: 8 }}>
          {/* Display-only in W5; editing each field needs picker UIs that land in Wave 9. */}
          {(
            [
              [tr('addpiece.step3.field.category'), titleCase(analysis.category)],
              [tr('addpiece.step3.field.subcategory'), titleCase(analysis.subcategory)],
              [tr('addpiece.step3.field.colorPrimary'), titleCase(analysis.color_primary)],
              [tr('addpiece.step3.field.material'), titleCase(analysis.material)],
              [tr('addpiece.step3.field.pattern'), titleCase(analysis.pattern)],
              [tr('addpiece.step3.field.fit'), titleCase(analysis.fit)],
            ] as [string, string][]
          ).map(([label, value]) => (
            <View
              key={label}
              style={[s.fieldRow, { borderColor: t.border, backgroundColor: t.card }]}>
              <Text
                style={{
                  fontFamily: fonts.uiSemi,
                  fontSize: 10,
                  letterSpacing: 1.4,
                  color: t.fg2,
                  textTransform: 'uppercase',
                }}>
                {label}
              </Text>
              <Text
                style={{
                  fontFamily: fonts.uiMed,
                  fontSize: 13,
                  color: t.fg,
                  fontWeight: '500',
                  flexShrink: 1,
                  textAlign: 'right',
                }}
                numberOfLines={1}>
                {value}
              </Text>
            </View>
          ))}
        </View>

        {/* ============ SEASONS ============ */}
        <View>
          <Eyebrow style={{ marginBottom: 8 }}>{tr('addpiece.step3.seasonsEyebrow')}</Eyebrow>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {SEASONS.map((season) => (
              <Chip
                key={season}
                label={tr(SEASON_LABEL_KEYS[season])}
                active={seasonsLower.includes(season)}
              />
            ))}
          </View>
        </View>
      </ScrollView>

      {/* ============ STICKY SAVE BAR ============ */}
      <View style={[s.stickyBar, { borderTopColor: t.border, backgroundColor: t.bg }]}>
        <View style={{ flex: 1 }}>
          <Eyebrow style={{ marginBottom: 2 }}>{tr('addpiece.step3.almostEyebrow')}</Eyebrow>
          <Text style={{ fontFamily: fonts.ui, fontSize: 11, color: t.fg2, letterSpacing: -0.11 }}>
            {tr('addpiece.step3.almostBody')}
          </Text>
        </View>
        <Button
          label={saveBusy ? tr('addpiece.step3.saving') : tr('addpiece.step3.save')}
          onPress={openChoiceSheet}
          disabled={saveBusy}
          accessibilityLabel={saveBusy ? tr('addpiece.step3.saving.aria') : tr('addpiece.step3.save.aria')}
          accessibilityState={{ busy: saveBusy, disabled: saveBusy }}
        />
      </View>

      <GarmentSaveChoiceSheet
        open={choiceOpen}
        isSaving={saveBusy}
        onClose={() => setChoiceOpen(false)}
        onSelectStudio={() => void handleSave(true)}
        onSelectOriginal={() => void handleSave(false)}
      />

      <Modal
        visible={duplicateModalOpen && !!duplicateMatch && !saveBusy}
        transparent
        animationType="fade"
        onRequestClose={() => dismissDuplicate(false)}>
        <View style={[s.modalScrim, { backgroundColor: t.scrimBg }]}>
          <View
            style={[
              s.modalCard,
              { backgroundColor: t.card, borderColor: t.border },
            ]}>
            <Eyebrow style={{ marginBottom: 6 }}>{tr('addpiece.duplicate.eyebrow')}</Eyebrow>
            <PageTitle size={22}>{tr('addpiece.duplicate.title')}</PageTitle>
            <Caption style={{ marginTop: 8, lineHeight: 19 }}>
              {duplicateMatch?.title
                ? tr('addpiece.duplicate.body', { title: duplicateMatch.title })
                : tr('addpiece.duplicate.bodyNoTitle')}
            </Caption>
            <View style={{ marginTop: 18, gap: 8 }}>
              <Button
                label={tr('addpiece.duplicate.viewExisting')}
                onPress={onViewExistingDuplicate}
                accessibilityLabel={tr('addpiece.duplicate.viewExisting')}
              />
              <Button
                label={tr('addpiece.duplicate.addAnyway')}
                variant="quiet"
                onPress={onAddAnyway}
                accessibilityLabel={tr('addpiece.duplicate.addAnyway')}
              />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  heroImage: {
    width: 100,
    height: 130,
    borderRadius: radii.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  confidenceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  titleInput: {
    height: 44,
    borderRadius: radii.lg,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontFamily: fonts.uiMed,
    fontSize: 14,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: 12,
  },
  stickyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14,
    borderTopWidth: 1,
  },
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 24,
  },
  modalScrim: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: radii.xl,
    borderWidth: 1,
    padding: 22,
  },
});
