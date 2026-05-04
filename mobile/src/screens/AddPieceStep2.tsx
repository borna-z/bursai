// Add piece — Step 2 of 3 (uploading + AI analyzing).
//
// Wiring (W5):
//   1. Resize + upload `route.params.photoUri` to Supabase storage (garments bucket).
//   2. Call analyze_garment edge function with the resulting storagePath.
//   3. On success, auto-navigate to Step 3 with { storagePath, photoUri, analysis }.
//   4. On failure, show ErrorState with a Retry button (re-runs upload + analyze).
//
// UX: deliberately no photo preview in the loading state — the user just took/picked
// the photo seconds ago, they don't need a re-confirmation. Cycling copy ("Uploading
// photo…", "Reading fabric…", "Identifying category…", "Building your garment…") gives
// a sense of motion and tells them what the AI is doing under the hood.
//
// Multi-photo: `allUris` is threaded through but only the first photo is processed in
// this PR. Wave 9 wires the "process next on save" loop. (See W5 Findings entry.)
//
// Skip: temporary escape hatch for users who hit a stuck flow — bounces back to Tabs
// instead of trying to skip with no analysis (which would 404 Step 3's params).

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
import { resizeAndUpload } from '../lib/imageUpload';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'AddPieceStep2'>;

// Cycled every PHASE_INTERVAL_MS so the user sees apparent progress while the AI thinks.
const PHASE_COPY = [
  'Uploading photo…',
  'Reading fabric…',
  'Identifying category…',
  'Building your garment…',
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
  const storagePathRef = useRef<string | null>(null);

  const runUploadAndAnalyze = useCallback(async () => {
    if (!photoUri) {
      setErrorMsg('No photo to analyze');
      return;
    }
    if (!user) {
      setErrorMsg('Not signed in');
      return;
    }
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setErrorMsg(null);
    setPhase(0);

    try {
      const { storagePath } = await resizeAndUpload(photoUri, user.id);
      storagePathRef.current = storagePath;
      const analysis = await analyze(storagePath);
      if (!analysis) {
        // useAnalyzeGarment already surfaced the error message internally; mirror it
        // here so the ErrorState has copy to show without a stale "still uploading" hint.
        setErrorMsg('Could not analyze photo');
        return;
      }
      // Auto-nav to Step 3 with everything Step 3 needs to render the review form.
      nav.navigate('AddPieceStep3', {
        storagePath,
        photoUri,
        analysis,
        source,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      setErrorMsg(msg);
    } finally {
      inFlightRef.current = false;
    }
  }, [photoUri, user, analyze, nav, source]);

  // Kick off the upload + analyze on mount. Ignored on subsequent renders by inFlightRef.
  useEffect(() => {
    void runUploadAndAnalyze();
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
  const currentIndex = 1; // Single-photo for W5; future multi-photo loop bumps this.

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={['top']}>
      {/* ============ HEADER ============ */}
      <View style={[s.header, { borderBottomColor: t.border }]}>
        <IconBtn variant="ghost" onPress={() => nav.navigate('MainTabs')} ariaLabel="Close">
          <CloseIcon color={t.fg} />
        </IconBtn>
        <View style={{ flex: 1 }}>
          <Eyebrow style={{ marginBottom: 2 }}>Step 2 of 3</Eyebrow>
          <PageTitle size={26}>Analyzing</PageTitle>
        </View>
        <Pressable
          onPress={() => nav.navigate('MainTabs')}
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
          {totalCount > 1 ? (
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
