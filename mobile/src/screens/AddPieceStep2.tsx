// Add piece — Step 2 of 3 (parallel analyze + upload).
//
// Two paths, gated on whether route.params.batch is set:
//
// 1. SINGLE-PHOTO (LiveScan + 1-photo direct entries):
//    - ImageManipulator resizes the photo once, returning both the resized URI
//      AND the base64 payload in a single pass.
//    - analyze({ base64 }) fires immediately — Gemini sees the image without
//      waiting for the supabase storage upload to land.
//    - uploadManipulatedImage(...) starts in parallel; its promise is parked in
//      the pendingUpload module under a uploadId.
//    - Once analyze settles, we navigate to Step 3 carrying { uploadId,
//      storagePath: null, analysis }. Step 3's Save handler awaits the parked
//      promise if storagePath is still null at save time.
//
// 2. BATCH (multi-photo — Step 1 with N≥2, OR single-photo Step 1 entries
//    that opt into the same pipeline so the post-Save flow is unified):
//    - The batchPipeline already kicked off resize+upload+analyze for this
//      photo (and the next ~MAX_PARALLEL ahead of it) when Step 1 hit Continue.
//    - awaitItem() resolves once the analyze + upload pair has settled. If
//      it landed first (the user took >2s on the previous Step 3), this
//      resolves immediately; otherwise the loading copy cycles.
//    - On success, navigate to Step 3 with the resolved storagePath +
//      analysis already populated. No pendingUpload registration is needed.
//    - On failure, render an error state with Skip / Retry inline — Skip
//      advances to the next index (or out of the flow if last), Retry
//      re-spawns the pipeline work for this index.
//
// Cancellation: mountedRef prevents navigate-after-unmount and stale setState
// writes when the user backs out / Skips while work is in flight. The single-
// photo path additionally drops its pendingUpload registration on unmount; the
// batch path leaves item bookkeeping to the pipeline (skipped items get their
// storage objects best-effort deleted; saved items keep theirs).

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTokens } from '../theme/ThemeProvider';
import { fonts } from '../theme/tokens';
import { Eyebrow } from '../components/Eyebrow';
import { PageTitle } from '../components/PageTitle';
import { Caption } from '../components/Caption';
import { ErrorState } from '../components/ErrorState';
import { IconBtn } from '../components/IconBtn';
import { CloseIcon } from '../components/icons';
import { useAuth } from '../contexts/AuthContext';
import { useAnalyzeGarment } from '../hooks/useAnalyzeGarment';
import { t as tr } from '../lib/i18n';
import {
  resizeForGarment,
  uploadManipulatedImage,
  deleteUpload,
  GARMENT_IMAGE_MIME,
} from '../lib/imageUpload';
import {
  dropPendingUpload,
  makeUploadId,
  setPendingUpload,
} from '../lib/pendingUpload';
import {
  awaitItem as awaitBatchItem,
  dropBatch,
  markItemSkipped,
  nextPendingIndex,
  retryItem as retryBatchItem,
} from '../lib/batchPipeline';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'AddPieceStep2'>;

// Cycled every PHASE_INTERVAL_MS so the user sees apparent progress while the AI thinks.
// The trailing "Still working" line keeps cycling so a slow analyze doesn't look hung.
// Resolved via tr() at render time so locale switches at runtime cycle the
// translated copy on the next interval tick rather than capturing the
// resolved-at-mount English values.
const PHASE_KEYS = [
  'addpiece.step2.phase.fabric',
  'addpiece.step2.phase.colors',
  'addpiece.step2.phase.category',
  'addpiece.step2.phase.almost',
  'addpiece.step2.phase.stillWorking',
];
const PHASE_INTERVAL_MS = 1500;

export function AddPieceStep2() {
  const t = useTokens();
  const nav = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { user } = useAuth();
  const { analyze } = useAnalyzeGarment();

  const photoUri = route.params?.photoUri;
  const allUris = route.params?.allUris ?? (photoUri ? [photoUri] : []);
  // Default to 'add_photo' for direct/deep-linked entries — Step 1 always supplies one.
  const source = route.params?.source ?? 'add_photo';
  // Multi-photo batch coordinator state. When set, this Step 2 instance is
  // showing the loading screen for `batch.index` of `batch.total`; the
  // pipeline (started in Step 1) owns the resize+upload+analyze work.
  const batch = route.params?.batch;

  const [phase, setPhase] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // Guards against StrictMode / re-render double-runs of the upload effect — without
  // this the same photo would upload twice on first mount, charging the user double
  // for the analyze call. Mirrors the activeGenerationRef pattern in web's useAddGarment.
  const inFlightRef = useRef(false);
  // Tracks the most recent uploadId so the unmount cleanup can both drop the
  // pendingUpload registration AND best-effort delete the orphaned storage object
  // when the upload eventually resolves on a back-button-mid-flight session.
  const uploadIdRef = useRef<string | null>(null);
  const uploadStorageRef = useRef<string | null>(null);
  // Tracks WHICH uploadId (if any) was transferred to Step 3. Codex round 7 P2:
  // the prior boolean ownerTransferredRef conflated "any attempt was transferred"
  // with "this specific attempt was transferred". After a Retry-then-success
  // sequence, an older attempt resolving later would see the boolean as `true`
  // (because the NEW attempt transferred) and skip its self-cleanup, leaking the
  // old storage object. Storing the id lets every .then closure compare against
  // its own captured uploadId.
  const transferredUploadIdRef = useRef<string | null>(null);
  // Component-mount guard — set false on unmount so post-unmount setState / navigate
  // calls become no-ops. Without this guard a back-button mid-analyze would teleport
  // the user into Step 3 of an aborted flow.
  const mountedRef = useRef(true);
  // Batch path: tracks whether this Step 2 mount handed off to another batch
  // screen via `nav.replace` (forward to Step 3 on success, or replace to the
  // next pending Step 2 on Skip). When the user backs out of Step 2 with the
  // hardware/gesture back button instead — bypassing the header close action
  // that explicitly calls `dropBatch` — the cleanup needs to drop the batch
  // itself; otherwise background uploads keep running and ready-but-unsaved
  // storage objects orphan because no later screen owns the batchId.
  // (Codex P2 round 2 on PR #777.)
  const handedOffBatchRef = useRef(false);

  // Batch path — wait for the pipeline-owned analyze + upload, then forward
  // to Step 3 with both already populated. Re-runs on Retry.
  const runBatchItem = useCallback(async () => {
    if (!batch) return;
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    if (mountedRef.current) {
      setErrorMsg(null);
      setPhase(0);
    }
    try {
      const item = await awaitBatchItem(batch.batchId, batch.index);
      if (!mountedRef.current) return;
      if (!item) {
        // Batch was dropped out from under us — treat as a discarded session.
        setErrorMsg(tr('addpiece.step2.error.couldNotAnalyze'));
        return;
      }
      if (item.status === 'failed' || !item.analysis || !item.storagePath) {
        setErrorMsg(item.errorMessage ?? tr('addpiece.step2.error.couldNotAnalyze'));
        return;
      }
      // Replace (not push) so the back stack stays clean across the
      // Step 2 ↔ Step 3 oscillation: a batch of N photos shouldn't leave
      // 2N screens on the stack. Back from any batch screen lands on Step 1.
      handedOffBatchRef.current = true;
      nav.replace('AddPieceStep3', {
        storagePath: item.storagePath,
        photoUri: item.uri,
        analysis: item.analysis,
        source,
        batch,
      });
    } catch (err) {
      if (!mountedRef.current) return;
      const msg = err instanceof Error ? err.message : tr('addpiece.step2.error.uploadFailed');
      setErrorMsg(msg);
    } finally {
      inFlightRef.current = false;
    }
  }, [batch, nav, source]);

  const runAnalyzeAndUpload = useCallback(async () => {
    if (batch) {
      void runBatchItem();
      return;
    }
    if (!photoUri) {
      if (mountedRef.current) setErrorMsg(tr('addpiece.step2.error.noPhoto'));
      return;
    }
    if (!user) {
      if (mountedRef.current) setErrorMsg(tr('addpiece.step2.error.notSignedIn'));
      return;
    }
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    if (mountedRef.current) {
      setErrorMsg(null);
      setPhase(0);
    }

    // Clean up any prior upload registration that didn't end in a saved garment
    // — applies on retry. Two layers:
    //   1. dropPendingUpload removes the still-in-flight registration from the
    //      module map so a stale promise can't be consumed by Step 3.
    //   2. If a prior attempt already finished its upload (analyze failed AFTER
    //      upload landed), `previousStorage` holds the storage path. Best-effort
    //      delete it before re-uploading so retries don't accumulate orphans in
    //      the user's bucket. Codex P2 on PR #725.
    const previousUploadId = uploadIdRef.current;
    const previousStorage = uploadStorageRef.current;
    uploadIdRef.current = null;
    uploadStorageRef.current = null;
    transferredUploadIdRef.current = null;
    if (previousUploadId) dropPendingUpload(previousUploadId);
    if (previousStorage) void deleteUpload(previousStorage);

    try {
      // Single resize, two consumers — base64 for analyze, file bytes for upload.
      const resized = await resizeForGarment(photoUri, { wantBase64: true });
      if (!mountedRef.current) return;

      // Kick the upload off in parallel. The promise is parked in the pendingUpload
      // module under uploadId; Step 3 reads it on Save. We hold a local reference
      // so unmount cleanup can best-effort delete the resulting storage object if
      // the user backed out before the upload landed.
      const uploadId = makeUploadId();
      uploadIdRef.current = uploadId;
      const uploadPromise = uploadManipulatedImage(resized, user.id);
      // Wrap with two side-effects:
      //   1. Capture storagePath so unmount-cleanup can orphan-delete if the user
      //      backed out before resolution AND ownership wasn't transferred to Step 3.
      //   2. If we resolved after the component already tore down (race window
      //      between upload latency and back-button), fire orphan deletion directly
      //      from the .then — the cleanup snapshot can't catch a path that wasn't
      //      yet set when it ran. Reviewer-flagged leak.
      //
      // Codex round 7 P2: per-uploadId active/transferred check. An attempt is
      // "live" if uploadIdRef still points at it (active in Step 2) OR
      // transferredUploadIdRef holds it (handed to Step 3). Anything else is a
      // stale completion from a prior retry — self-delete and skip shared-state
      // mutation so the new attempt's bookkeeping isn't clobbered.
      const wrapped = uploadPromise.then((res) => {
        const isActive = uploadIdRef.current === uploadId;
        const isTransferred = transferredUploadIdRef.current === uploadId;
        if (!isActive && !isTransferred) {
          void deleteUpload(res.storagePath);
          return res;
        }
        uploadStorageRef.current = res.storagePath;
        // If the component already unmounted AND THIS attempt wasn't transferred
        // to Step 3, the storage object is orphaned — delete eagerly. The
        // per-uploadId check ensures a transferred attempt isn't deleted (Step 3
        // still owns the file).
        if (!mountedRef.current && !isTransferred) {
          void deleteUpload(res.storagePath);
        }
        return res;
      });
      setPendingUpload(uploadId, wrapped);
      // Surface the upload error in dev — the user-facing flow falls through to
      // Step 3's Save handler, which surfaces a friendlier message if the await
      // there ends up rejecting.
      // N3.10 F-005: gate behind __DEV__. The .catch fires for expected user-
      // initiated cancels (e.g. back-button mid-analyze aborts the upload),
      // which would otherwise spam Sentry breadcrumbs / production logs with
      // benign rejections every time someone backs out of Step 2.
      wrapped.catch((err) => {
        if (__DEV__) {
          console.warn('[AddPieceStep2] upload failed:', err);
        }
      });

      // Fire analyze with the base64 payload. Strip-and-prefix — ImageManipulator
      // returns just the raw base64 string, but the edge function's image_url
      // contract takes a data URL. Web sends the FileReader.readAsDataURL output
      // directly so it includes the prefix; we replicate that for parity.
      // The MIME prefix tracks `GARMENT_IMAGE_MIME` so analyze sees the same
      // format the encoder actually produced (N6 switched from JPEG to WebP).
      const base64 = resized.base64
        ? `data:${GARMENT_IMAGE_MIME};base64,${resized.base64}`
        : null;
      if (!base64) {
        // ImageManipulator promised a base64 — if it's missing, fall back to the
        // post-upload storagePath path. Costs ~1-2s but keeps the screen unstuck.
        const upRes = await uploadPromise;
        if (!mountedRef.current) return;
        const fallbackAnalysis = await analyze({ storagePath: upRes.storagePath });
        if (!mountedRef.current) return;
        if (!fallbackAnalysis) {
          setErrorMsg(tr('addpiece.step2.error.couldNotAnalyze'));
          return;
        }
        // Storage is already on disk; pass the path directly so Step 3 doesn't have
        // to await the pendingUpload promise.
        dropPendingUpload(uploadId);
        uploadIdRef.current = null;
        uploadStorageRef.current = null;
        nav.navigate('AddPieceStep3', {
          storagePath: upRes.storagePath,
          photoUri,
          analysis: fallbackAnalysis,
          source,
        });
        return;
      }

      const analysis = await analyze({ base64 });
      if (!mountedRef.current) return;
      if (!analysis) {
        setErrorMsg(tr('addpiece.step2.error.couldNotAnalyze'));
        return;
      }

      // Hand the upload promise off to Step 3. Storage path is null until upload
      // completes — Step 3's Save handler will await pendingUpload[uploadId] if
      // needed. Use the function-local `uploadId` (not uploadIdRef.current):
      // handleSkip can null the ref synchronously while the unmount that would
      // normally fire `mountedRef.current = false` has not yet landed, so the
      // post-await guard above doesn't catch that race. Reading the ref here
      // would then pass uploadId: undefined to Step 3 and the Save handler
      // would throw "Upload was lost". Codex round 9 P2 on PR #725.
      transferredUploadIdRef.current = uploadId;
      uploadIdRef.current = null;
      nav.navigate('AddPieceStep3', {
        storagePath: null,
        uploadId,
        photoUri,
        analysis,
        source,
      });
    } catch (err) {
      if (!mountedRef.current) return;
      const msg = err instanceof Error ? err.message : tr('addpiece.step2.error.uploadFailed');
      setErrorMsg(msg);
    } finally {
      inFlightRef.current = false;
    }
  }, [batch, runBatchItem, photoUri, user, analyze, nav, source]);

  // Kick off the parallel analyze + upload on mount. Subsequent renders are gated
  // by inFlightRef. Cleanup: mark unmounted (cancellation guard for in-flight
  // async) AND drop any orphaned upload registration that never reached Step 3.
  useEffect(() => {
    mountedRef.current = true;
    void runAnalyzeAndUpload();
    return () => {
      mountedRef.current = false;
      const orphanId = uploadIdRef.current;
      const orphanStorage = uploadStorageRef.current;
      const wasTransferred = transferredUploadIdRef.current !== null;
      uploadIdRef.current = null;
      uploadStorageRef.current = null;
      if (orphanId) dropPendingUpload(orphanId);
      // Only orphan-delete when ownership was NOT handed to Step 3. On the happy
      // path (Step 2 → Step 3 → Save → nav.reset), the storage path is now
      // referenced by a saved garment row; deleting it here would break the
      // garment image. The .then wrapper inside runAnalyzeAndUpload covers the
      // race where the upload resolves AFTER unmount on a non-transfer flow.
      // Codex round 4 P1 on PR #725; round 7 P2 switched the gate to per-uploadId
      // tracking, but uploadStorageRef is only ever written by an active or
      // transferred attempt (stale ones self-delete in the .then before touching
      // the shared ref), so the boolean transferred-or-not check on the ref's
      // owner is sufficient here.
      if (!wasTransferred && orphanStorage) void deleteUpload(orphanStorage);
      // Batch path: if the user backed out of Step 2 without one of the
      // explicit handoffs (Continue → Step 3, Skip → next Step 2, header
      // close → dropBatch + nav), tear the batch down so background
      // uploads stop and any ready-but-unsaved storage objects are deleted.
      // (Codex P2 round 2 on PR #777.)
      if (batch && !handedOffBatchRef.current) {
        dropBatch(batch.batchId);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cycle the phase copy every PHASE_INTERVAL_MS while loading. Stops once errorMsg
  // is set so the ErrorState body isn't fighting a still-mounted timer.
  useEffect(() => {
    if (errorMsg) return;
    const id = setInterval(() => {
      setPhase((p) => Math.min(p + 1, PHASE_KEYS.length - 1));
    }, PHASE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [errorMsg]);

  // Codex P2 on PR #738: after a successful analyze, Step 2 navigates forward
  // without clearing local state — if the user backs out of Step 3, they'd
  // land on Step 2 still showing the loading spinner with no path to retry.
  // Detect that scenario on focus: if `transferredUploadIdRef` is non-null
  // we already handed our work off to Step 3, so a re-focus means the user
  // is back-navigating. Bounce them to Step 1 (the AddPiece entry point) so
  // they don't sit on a stuck loading screen. The unmount-cleanup effect
  // still fires correctly — `transferredUploadIdRef.current !== null` means
  // `wasTransferred = true`, so the cleanup skips the orphan-delete path
  // (Step 3 owns the storage object).
  //
  // Batch path: Step 2 uses nav.replace to forward to Step 3, so the only
  // way this focus-effect re-fires is if the user re-entered the screen
  // from a modal/OAuth round-trip. Don't treat that as abandonment —
  // batch sequencing relies on nav.replace being authoritative.
  useFocusEffect(
    useCallback(() => {
      if (batch) return undefined;
      if (transferredUploadIdRef.current !== null) {
        nav.navigate('AddPieceStep1');
      }
      return undefined;
    }, [nav, batch]),
  );

  const isError = !!errorMsg;
  // Batch path drives the X/Y from the route; single-photo path stays at 1/1
  // (or 1/N for legacy LiveScan callers that thread allUris but don't run a
  // batch — the singular copy still applies).
  const totalCount = batch ? batch.total : allUris.length;
  const currentIndex = batch ? batch.index + 1 : 1;
  const hasExtras = totalCount > 1;

  // Skip / Close — drop the upload registration before bouncing out. The in-flight
  // upload may still resolve in the background; the unmount cleanup handles
  // deletion if the storagePath becomes available before the component fully tears
  // down.
  //
  // Batch path: tearing out of Step 2 mid-batch drops the WHOLE batch (best-
  // effort delete every analyzed-but-unsaved storage object). The user
  // reviewing item 3-of-5 hitting Close is choosing to walk away from the
  // remaining items, not just this one. Per-item skip lives on the failed
  // state below.
  const handleSkip = () => {
    if (batch) {
      dropBatch(batch.batchId);
      nav.navigate('MainTabs');
      return;
    }
    const orphanId = uploadIdRef.current;
    uploadIdRef.current = null;
    if (orphanId) dropPendingUpload(orphanId);
    nav.navigate('MainTabs');
  };

  // Batch-only — user dismisses a failed item and we advance to the next
  // pending one (or out of the flow if this was the last).
  const handleSkipFailedBatchItem = () => {
    if (!batch) return;
    markItemSkipped(batch.batchId, batch.index);
    const next = nextPendingIndex(batch.batchId, batch.index);
    if (next === -1) {
      dropBatch(batch.batchId);
      nav.navigate('MainTabs');
      return;
    }
    handedOffBatchRef.current = true;
    nav.replace('AddPieceStep2', {
      photoUri: allUris[next] ?? photoUri ?? '',
      allUris,
      source,
      batch: { ...batch, index: next },
    });
  };

  // Batch-only — re-spawn the pipeline work for this index and re-await.
  const handleRetryBatchItem = () => {
    if (!batch) return;
    if (!retryBatchItem(batch.batchId, batch.index)) return;
    if (mountedRef.current) {
      setErrorMsg(null);
      setPhase(0);
    }
    void runBatchItem();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={['top']}>
      {/* ============ HEADER ============ */}
      <View style={[s.header, { borderBottomColor: t.border }]}>
        <IconBtn variant="ghost" onPress={handleSkip} ariaLabel={tr('addpiece.step2.close')}>
          <CloseIcon color={t.fg} />
        </IconBtn>
        <View style={{ flex: 1 }}>
          <Eyebrow style={{ marginBottom: 2 }}>{tr('addpiece.step2.headerEyebrow', { current: 2, total: 3 })}</Eyebrow>
          <PageTitle size={26}>{tr('addpiece.step2.headerTitle')}</PageTitle>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={tr('addpiece.step2.skip')}
          onPress={handleSkip}
          style={{ paddingHorizontal: 6, paddingVertical: 8 }}>
          <Text style={{ fontFamily: fonts.uiMed, fontSize: 13, color: t.fg2, fontWeight: '500' }}>{tr('addpiece.step2.skip')}</Text>
        </Pressable>
      </View>

      {isError ? (
        <ErrorState
          title={tr('addpiece.step2.error.title')}
          body={errorMsg ?? tr('addpiece.step2.error.body')}
          onRetry={
            batch
              ? handleRetryBatchItem
              : () => void runAnalyzeAndUpload()
          }
          // Batch path adds a Skip-this-photo secondary action so a single
          // bad photo doesn't sink the whole session — the user advances
          // to the next pending item or wraps up if this was the last.
          secondaryActionLabel={batch ? tr('addpiece.step2.batch.skip') : undefined}
          onSecondaryAction={batch ? handleSkipFailedBatchItem : undefined}
        />
      ) : (
        <View style={s.loadingWrap}>
          {/* Multi-photo progress hint — singular when allUris.length === 1 so the copy
              doesn't read awkwardly for the common single-piece flow. */}
          {hasExtras ? (
            <Eyebrow style={{ marginBottom: 12 }}>
              {tr('addpiece.step2.progress.batch', { current: currentIndex, total: totalCount })}
            </Eyebrow>
          ) : (
            <Eyebrow style={{ marginBottom: 12 }}>{tr('addpiece.step2.progress.single')}</Eyebrow>
          )}

          <ActivityIndicator size="large" color={t.accent} />

          <Text
            style={{
              marginTop: 24,
              fontFamily: fonts.displayMedium,
              fontStyle: 'italic',
              fontSize: 24,
              fontWeight: '500',
              color: t.fg,
              letterSpacing: -0.24,
              textAlign: 'center',
            }}>
            {tr(PHASE_KEYS[phase])}
          </Text>

          <Caption style={{ textAlign: 'center', marginTop: 8, maxWidth: 280 }}>
            {tr('addpiece.step2.progress.body')}
          </Caption>

          {/* Batch active: tell the user the rest are getting ready in the
              background so they understand why the next photo loads quickly.
              Legacy single-photo path with allUris > 1 (LiveScan never hits
              this) falls back to the older 'batchNote' copy that warned
              about the now-removed single-photo-only limit. */}
          {hasExtras && batch ? (
            <Caption style={{ textAlign: 'center', marginTop: 14, opacity: 0.75, maxWidth: 280 }}>
              {tr('addpiece.step2.batch.activeNote')}
            </Caption>
          ) : hasExtras ? (
            <Caption style={{ textAlign: 'center', marginTop: 14, opacity: 0.75, maxWidth: 280 }}>
              {tr('addpiece.step2.progress.batchNote')}
            </Caption>
          ) : null}
        </View>
      )}
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
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
});
