// Add piece — Step 2 of 3 (uploading + AI analyzing).
//
// Wiring (W5):
//   1. Resize + upload `route.params.photoUri` to Supabase storage (garments bucket).
//   2. Call analyze_garment edge function with the resulting storagePath.
//   3. On success, auto-navigate to Step 3 with { storagePath, photoUri, analysis }.
//   4. On failure, show ErrorState with a Retry button (re-runs upload + analyze).
//
// UX: deliberately no photo preview in the loading state — the user just took/picked
// the photo seconds ago, they don't need a re-confirmation. Cycling copy gives a sense
// of motion and tells them what the AI is doing under the hood. After ~12s the cycler
// flips to a "still working" line so the screen doesn't look frozen on a slow analyze.
//
// Cancellation: mountedRef prevents navigate-after-unmount and stale setState writes
// when the user backs out / Skips while upload + analyze is in flight. The orphan
// upload is deleted on retry-after-failure and on Skip-after-upload so dead JPEGs
// don't accumulate in the user's bucket folder.
//
// Multi-photo: `allUris` is threaded through but only the first photo is processed in
// this PR. A small inline note tells the user the rest will not be analyzed in W5.
// Wave 9 wires the "process next on save" loop.

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
import { resizeAndUpload, deleteUpload } from '../lib/imageUpload';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'AddPieceStep2'>;

// Cycled every PHASE_INTERVAL_MS so the user sees apparent progress while the AI thinks.
// The trailing "Still working" line keeps cycling so a slow analyze doesn't look hung.
const PHASE_COPY = [
  'Uploading photo…',
  'Reading fabric…',
  'Identifying category…',
  'Building your garment…',
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
  // Tracks the most recent uploaded storage path so retry / Skip can clean it up
  // before re-uploading or bouncing the user out. Without this, a failed analyze
  // followed by a retry would leak the old upload object in the user's bucket.
  const storagePathRef = useRef<string | null>(null);
  // Component-mount guard — set false on unmount so post-unmount setState / navigate
  // calls become no-ops. The runUploadAndAnalyze closure stays alive after unmount
  // (the fetch keeps running in RN), so without this guard a back-button mid-upload
  // would teleport the user into Step 3 of an aborted flow.
  const mountedRef = useRef(true);

  const runUploadAndAnalyze = useCallback(async () => {
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

    // Clean up any prior upload that didn't end in a saved garment — applies on retry.
    const previousPath = storagePathRef.current;
    storagePathRef.current = null;
    if (previousPath) {
      void deleteUpload(previousPath);
    }

    try {
      const { storagePath } = await resizeAndUpload(photoUri, user.id);
      if (!mountedRef.current) {
        // User left mid-upload — drop the orphan and bail before analyze.
        void deleteUpload(storagePath);
        return;
      }
      storagePathRef.current = storagePath;
      const analysis = await analyze(storagePath);
      if (!mountedRef.current) {
        // User left mid-analyze — orphan cleanup; the cron-cleaned-on-next-save
        // policy doesn't exist yet, so we delete eagerly.
        void deleteUpload(storagePath);
        storagePathRef.current = null;
        return;
      }
      if (!analysis) {
        // useAnalyzeGarment already surfaced the error message internally; mirror it
        // here so the ErrorState has copy to show without a stale "still uploading" hint.
        setErrorMsg('Could not analyze photo');
        return;
      }
      // Storage path now belongs to the (about-to-be-saved) garment row — clear the ref
      // so the unmount/Skip cleanup doesn't try to delete a path that's now referenced.
      storagePathRef.current = null;
      // Auto-nav to Step 3 with everything Step 3 needs to render the review form.
      nav.navigate('AddPieceStep3', {
        storagePath,
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

  // Kick off the upload + analyze on mount. Ignored on subsequent renders by inFlightRef.
  // Cleanup: mark unmounted (cancellation guard for in-flight async) AND drop any
  // orphaned upload that didn't get attached to a saved garment.
  useEffect(() => {
    mountedRef.current = true;
    void runUploadAndAnalyze();
    return () => {
      mountedRef.current = false;
      const orphan = storagePathRef.current;
      storagePathRef.current = null;
      if (orphan) {
        void deleteUpload(orphan);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cycle the phase copy every PHASE_INTERVAL_MS while loading. Stops once errorMsg
  // is set so the ErrorState body isn't fighting a still-mounted timer. The clamp
  // pins the "Still working" line as the final state so a slow analyze doesn't look
  // frozen on the previous "Building your garment…" string.
  useEffect(() => {
    if (errorMsg) return;
    const id = setInterval(() => {
      setPhase((p) => Math.min(p + 1, PHASE_COPY.length - 1));
    }, PHASE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [errorMsg]);

  const isError = !!errorMsg;
  const totalCount = allUris.length;
  const currentIndex = 1; // Single-photo for W5; future multi-photo loop bumps this.
  const hasExtras = totalCount > 1;

  // Skip / Close — clean up the orphan upload (if any) before bouncing out so the
  // user's bucket doesn't accumulate dead JPEGs from abandoned flows.
  const handleSkip = () => {
    const orphan = storagePathRef.current;
    storagePathRef.current = null;
    if (orphan) {
      void deleteUpload(orphan);
    }
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
          onRetry={() => void runUploadAndAnalyze()}
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
