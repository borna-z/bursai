// Add piece — Step 2 of 3 (parallel analyze + upload).
//
// PR 1 changes the wiring from serial to parallel:
//   1. ImageManipulator resizes the photo once, asking for both the resized
//      file URI AND the base64 payload in a single pass.
//   2. analyze({ base64 }) fires immediately — Gemini sees the image without
//      waiting for the supabase storage upload to land.
//   3. uploadManipulatedImage(...) starts in parallel; its promise is parked in
//      the pendingUpload module under a uploadId.
//   4. Once analyze settles, we navigate to Step 3 carrying { uploadId,
//      storagePath: null, analysis }. Step 3's Save handler awaits the parked
//      promise if storagePath is still null at save time.
//
// The serial path used to take ~5s on a 3MB photo over throttled 4G (resize
// 400ms + read bytes 200ms + upload 1.8s + analyze 2.5s ≈ 4.9s). Parallel cuts
// that to ~max(upload, analyze) = ~2.5s for the user-visible "until form
// renders" wait — the upload finishes in the background while they review fields.
//
// Cancellation: mountedRef prevents navigate-after-unmount and stale setState
// writes when the user backs out / Skips while analyze is in flight. The
// in-flight upload promise is dropped from the pendingUpload module on unmount;
// if the upload eventually succeeds, its row in storage is orphaned (cleaned up
// best-effort via deleteUpload when we resolve the promise on a backed-out
// session).
//
// Multi-photo: `allUris` is threaded through but only the first photo is
// processed in this PR. PR 5 wires the batch flow.

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
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
import {
  resizeForGarment,
  uploadManipulatedImage,
  deleteUpload,
} from '../lib/imageUpload';
import {
  dropPendingUpload,
  makeUploadId,
  setPendingUpload,
} from '../lib/pendingUpload';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'AddPieceStep2'>;

// Cycled every PHASE_INTERVAL_MS so the user sees apparent progress while the AI thinks.
// The trailing "Still working" line keeps cycling so a slow analyze doesn't look hung.
const PHASE_COPY = [
  'Reading fabric…',
  'Detecting colors…',
  'Identifying category…',
  'Almost there…',
  'Still working — almost there…',
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
  // Distinguishes "uploadIdRef cleared by ownership-transfer to Step 3" from
  // "uploadIdRef cleared by unmount cleanup". Without this, an upload that resolves
  // after Step 2 unmounts but before Step 3 consumes the path can't tell whether
  // to orphan-delete or stay quiet. Set to true exactly once when nav.navigate
  // hands the uploadId to Step 3.
  const ownerTransferredRef = useRef(false);
  // Component-mount guard — set false on unmount so post-unmount setState / navigate
  // calls become no-ops. Without this guard a back-button mid-analyze would teleport
  // the user into Step 3 of an aborted flow.
  const mountedRef = useRef(true);

  const runAnalyzeAndUpload = useCallback(async () => {
    if (!photoUri) {
      if (mountedRef.current) setErrorMsg('No photo to analyze');
      return;
    }
    if (!user) {
      if (mountedRef.current) setErrorMsg('Not signed in');
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
    ownerTransferredRef.current = false;
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
      // Codex round 6 P2: gate every shared-state mutation on this upload still
      // being the active one. Without this, a Retry-after-failure scenario can
      // have the OLD upload's .then resolve LATER and overwrite uploadStorageRef
      // with a stale path; the unmount cleanup then deletes the wrong file (or
      // the new path leaks because uploadStorageRef no longer points at it).
      // Comparing against `uploadId` captured in this closure isolates the two
      // attempts. If we're stale, eagerly delete our own storage object — no
      // shared ref will track it, and the new attempt has its own bookkeeping.
      const wrapped = uploadPromise.then((res) => {
        const isStale = uploadIdRef.current !== uploadId && !ownerTransferredRef.current;
        if (isStale) {
          void deleteUpload(res.storagePath);
          return res;
        }
        uploadStorageRef.current = res.storagePath;
        // If the component already unmounted AND ownership wasn't transferred to
        // Step 3 (uploadIdRef cleared by handover, not unmount), the storage object
        // is orphaned — delete eagerly. Distinguishing the two clears requires the
        // separate ownerTransferredRef below.
        if (!mountedRef.current && !ownerTransferredRef.current) {
          void deleteUpload(res.storagePath);
        }
        return res;
      });
      setPendingUpload(uploadId, wrapped);
      // Surface the upload error in dev — the user-facing flow falls through to
      // Step 3's Save handler, which surfaces a friendlier message if the await
      // there ends up rejecting.
      wrapped.catch((err) => {
        // eslint-disable-next-line no-console
        console.warn('[AddPieceStep2] upload failed:', err);
      });

      // Fire analyze with the base64 payload. Strip-and-prefix — ImageManipulator
      // returns just the raw base64 string, but the edge function's image_url
      // contract takes a data URL. Web sends the FileReader.readAsDataURL output
      // directly so it includes the prefix; we replicate that for parity.
      const base64 = resized.base64
        ? `data:image/jpeg;base64,${resized.base64}`
        : null;
      if (!base64) {
        // ImageManipulator promised a base64 — if it's missing, fall back to the
        // post-upload storagePath path. Costs ~1-2s but keeps the screen unstuck.
        const upRes = await uploadPromise;
        if (!mountedRef.current) return;
        const fallbackAnalysis = await analyze({ storagePath: upRes.storagePath });
        if (!mountedRef.current) return;
        if (!fallbackAnalysis) {
          setErrorMsg('Could not analyze photo');
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
        setErrorMsg('Could not analyze photo');
        return;
      }

      // Hand the upload promise off to Step 3. Storage path is null until upload
      // completes — Step 3's Save handler will await pendingUpload[uploadId] if
      // needed. Mark ownership-transferred BEFORE clearing the ref so the .then
      // wrapper doesn't mistakenly orphan-delete a path Step 3 still owns.
      const uploadIdForStep3 = uploadIdRef.current;
      ownerTransferredRef.current = true;
      uploadIdRef.current = null;
      nav.navigate('AddPieceStep3', {
        storagePath: null,
        uploadId: uploadIdForStep3 ?? undefined,
        photoUri,
        analysis,
        source,
      });
    } catch (err) {
      if (!mountedRef.current) return;
      const msg = err instanceof Error ? err.message : 'Upload failed';
      setErrorMsg(msg);
    } finally {
      inFlightRef.current = false;
    }
  }, [photoUri, user, analyze, nav, source]);

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
      const transferred = ownerTransferredRef.current;
      uploadIdRef.current = null;
      uploadStorageRef.current = null;
      if (orphanId) dropPendingUpload(orphanId);
      // Only orphan-delete when ownership was NOT handed to Step 3. On the happy
      // path (Step 2 → Step 3 → Save → nav.reset), the storage path is now
      // referenced by a saved garment row; deleting it here would break the
      // garment image. The .then wrapper inside runAnalyzeAndUpload covers the
      // race where the upload resolves AFTER unmount on a non-transfer flow.
      // Codex round 4 P1 on PR #725.
      if (!transferred && orphanStorage) void deleteUpload(orphanStorage);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cycle the phase copy every PHASE_INTERVAL_MS while loading. Stops once errorMsg
  // is set so the ErrorState body isn't fighting a still-mounted timer.
  useEffect(() => {
    if (errorMsg) return;
    const id = setInterval(() => {
      setPhase((p) => Math.min(p + 1, PHASE_COPY.length - 1));
    }, PHASE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [errorMsg]);

  const isError = !!errorMsg;
  const totalCount = allUris.length;
  const currentIndex = 1; // Single-photo for now; PR 5 wires the batch loop.
  const hasExtras = totalCount > 1;

  // Skip / Close — drop the upload registration before bouncing out. The in-flight
  // upload may still resolve in the background; the unmount cleanup handles
  // deletion if the storagePath becomes available before the component fully tears
  // down.
  const handleSkip = () => {
    const orphanId = uploadIdRef.current;
    uploadIdRef.current = null;
    if (orphanId) dropPendingUpload(orphanId);
    nav.navigate('MainTabs');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={['top']}>
      {/* ============ HEADER ============ */}
      <View style={[s.header, { borderBottomColor: t.border }]}>
        <IconBtn variant="ghost" onPress={handleSkip} ariaLabel="Close">
          <CloseIcon color={t.fg} />
        </IconBtn>
        <View style={{ flex: 1 }}>
          <Eyebrow style={{ marginBottom: 2 }}>Step 2 of 3</Eyebrow>
          <PageTitle size={26}>Analyzing</PageTitle>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Skip"
          onPress={handleSkip}
          style={{ paddingHorizontal: 6, paddingVertical: 8 }}>
          <Text style={{ fontFamily: fonts.uiMed, fontSize: 13, color: t.fg2, fontWeight: '500' }}>Skip</Text>
        </Pressable>
      </View>

      {isError ? (
        <ErrorState
          title="Couldn't analyze your photo"
          body={errorMsg ?? 'Try again or pick a different photo.'}
          onRetry={() => void runAnalyzeAndUpload()}
        />
      ) : (
        <View style={s.loadingWrap}>
          {/* Multi-photo progress hint — singular when allUris.length === 1 so the copy
              doesn't read awkwardly for the common single-piece flow. */}
          {hasExtras ? (
            <Eyebrow style={{ marginBottom: 12 }}>
              Photo {currentIndex} of {totalCount}
            </Eyebrow>
          ) : (
            <Eyebrow style={{ marginBottom: 12 }}>Working on it</Eyebrow>
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
            {PHASE_COPY[phase]}
          </Text>

          <Caption style={{ textAlign: 'center', marginTop: 8, maxWidth: 280 }}>
            We&rsquo;ll have your garment ready in a moment.
          </Caption>

          {/* Honest UX about W5's single-photo limit so the user isn't surprised when
              their other staged photos vanish after Save. */}
          {hasExtras ? (
            <Caption style={{ textAlign: 'center', marginTop: 14, opacity: 0.75, maxWidth: 280 }}>
              Multi-photo batch is coming soon — only the first photo is being analyzed in this
              version. The rest will need to be re-added.
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
