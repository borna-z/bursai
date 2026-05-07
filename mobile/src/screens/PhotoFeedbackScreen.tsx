// Photo feedback / selfie comparison — M18 entry surface.
//
// Flow: camera permission gate → live viewfinder with shutter → "Use this
// selfie?" confirm overlay (matches LiveScan post-capture pattern) → upload
// + analyze via `usePhotoFeedback` → feedback card (italic page title,
// fit-notes caption, color-callout chips, swap-suggestion garment cards).
//
// Layout decisions:
//   • Always-light surface for the feedback card half (uses `useTokens()`),
//     always-dark surface for the camera viewfinder (matches LiveScanScreen
//     — same documented exemption for camera UIs).
//   • `Modal`-less single-screen implementation — the screen pushes onto
//     the native stack from OutfitDetail / Plan, so back-swipe cancels
//     the in-flight call via `usePhotoFeedback`'s mount-cleanup abort.
//   • Subscription-locked sentinel routes to PaywallScreen on first
//     occurrence per screen lifetime (sticky ref). Other errors render
//     inline with a Retry CTA.
//
// Route param: `{ outfitId: string }` (resolved from RootStackParamList).
// `useGarment(swap_suggestions[i].garment_id)` hydrates per-suggestion
// garment row when the AI surfaces a swap with an explicit id; otherwise
// the suggestion renders as a reason-only chip.

import React from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CameraView, useCameraPermissions, type CameraType } from 'expo-camera';

import { useTokens } from '../theme/ThemeProvider';
import { fonts, radii } from '../theme/tokens';
import { Button } from '../components/Button';
import { Caption } from '../components/Caption';
import { Eyebrow } from '../components/Eyebrow';
import { GarmentCard } from '../components/GarmentCard';
import { IconBtn } from '../components/IconBtn';
import { PageTitle } from '../components/PageTitle';
import { CloseIcon, RotateIcon } from '../components/icons';
import { useGarment } from '../hooks/useGarments';
import { usePhotoFeedback, type PhotoFeedback } from '../hooks/usePhotoFeedback';
import { SUBSCRIPTION_SENTINEL } from '../lib/edgeFunctionClient';
import { hapticLight, hapticMedium } from '../lib/haptics';
import { t as tr } from '../lib/i18n';
import { Sentry } from '../lib/sentry';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'PhotoFeedback'>;

// Always-dark camera palette — see LiveScanScreen for the documented
// exemption for camera UIs.
const VF_BG = '#0c0c0c';
const VF_FG = '#FFFFFF';
const VF_FG2 = 'rgba(255,255,255,0.65)';
const VF_BORDER = 'rgba(255,255,255,0.12)';

export function PhotoFeedbackScreen() {
  // The capture/confirm/submitting branches of this screen render against
  // the always-dark camera palette (VF_BG/VF_FG/...) — same documented
  // exemption LiveScanScreen carries for camera UIs — so we don't read
  // theme tokens here. The light-themed result card lives in
  // `FeedbackView` below, which calls `useTokens()` in its own scope
  // (M18 P3.2 — removed the dead zero-size Text suppressor).
  const nav = useNavigation<Nav>();
  const route = useRoute<Route>();
  const outfitId = route.params?.outfitId ?? '';

  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = React.useState<CameraType>('front');
  const [capturedUri, setCapturedUri] = React.useState<string | null>(null);
  const cameraRef = React.useRef<CameraView | null>(null);

  const photoFeedback = usePhotoFeedback();
  const {
    feedback,
    isUploading,
    isAnalyzing,
    error,
    submitFeedback,
    reset,
  } = photoFeedback;

  // Auto-request permission once on mount when the user hasn't been asked.
  // Matches LiveScanScreen's permission UX exactly.
  React.useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      void requestPermission();
    }
  }, [permission, requestPermission]);

  // Sticky paywall route — fire once per screen lifetime when the
  // subscription sentinel surfaces. Same pattern OutfitDetail (M17) uses
  // for its composition helpers; keeps a paywall dismiss + retry flow
  // from re-popping the modal in a tight loop.
  //
  // M18 P1.3 — release strategies (belt + braces):
  //   • `useFocusEffect` clears the latch when the screen regains focus
  //     (the user dismissed the paywall and came back). This is the
  //     primary release path — it doesn't depend on the error flipping
  //     to non-sentinel between calls (which it may not, since a second
  //     hit can land before any non-sentinel state is observed).
  //   • The error-driven release below is kept as a backup so a clean
  //     transition through a non-sentinel error also resets the latch.
  //   • `handleConfirm` ALSO resets the latch immediately — a user who
  //     explicitly retaps "Use this selfie" has clearly opted to retry,
  //     and we want the next 402 to route to the paywall again instead
  //     of falling through to the inline error path (which suppresses
  //     the sentinel and would otherwise produce a silent failure).
  const paywallShownRef = React.useRef(false);
  React.useEffect(() => {
    if (error === SUBSCRIPTION_SENTINEL && !paywallShownRef.current) {
      paywallShownRef.current = true;
      nav.navigate('Paywall');
    }
    if (error !== SUBSCRIPTION_SENTINEL && paywallShownRef.current) {
      // Release the latch so a future failure can re-route.
      paywallShownRef.current = false;
    }
  }, [error, nav]);
  useFocusEffect(
    React.useCallback(() => {
      // On focus regain — typically returning from PaywallScreen — clear
      // the latch so the next 402 can route to the paywall again. Pure
      // cleanup-on-focus; the focus listener fires both on initial focus
      // and any re-focus, which is the desired behaviour.
      paywallShownRef.current = false;
      return undefined;
    }, []),
  );

  const handleCapture = React.useCallback(async () => {
    if (!cameraRef.current) return;
    hapticMedium();
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.85,
        skipProcessing: false,
      });
      if (photo?.uri) {
        setCapturedUri(photo.uri);
      } else {
        Alert.alert(tr('photoFeedback.captureFailedTitle'), tr('photoFeedback.captureFailedBody'));
      }
    } catch (err) {
      // M18 P2.5 — instrument capture failures so we can see them in
      // Sentry the same way the hook tracks upload/analyze failures.
      // Tagged with `mutation` so the dashboard groups it alongside the
      // hook-side breadcrumbs.
      Sentry.captureException(err, { tags: { mutation: 'photo_feedback_capture' } });
      Alert.alert(tr('photoFeedback.captureFailedTitle'), tr('photoFeedback.captureFailedBody'));
    }
  }, []);

  const handleRetake = React.useCallback(() => {
    hapticLight();
    setCapturedUri(null);
    reset();
  }, [reset]);

  const handleConfirm = React.useCallback(() => {
    if (!capturedUri || !outfitId) return;
    // Release the paywall latch so a fresh 402 from this explicit retry
    // can route to the paywall again instead of being suppressed by the
    // inline-error guard (M18 P1.3).
    paywallShownRef.current = false;
    void submitFeedback({ outfitId, selfieUri: capturedUri });
  }, [capturedUri, outfitId, submitFeedback]);

  const handleSwitchCamera = React.useCallback(() => {
    hapticLight();
    setFacing((f) => (f === 'back' ? 'front' : 'back'));
  }, []);

  const handleClose = React.useCallback(() => {
    hapticLight();
    nav.goBack();
  }, [nav]);

  const handleDone = React.useCallback(() => {
    hapticLight();
    nav.goBack();
  }, [nav]);

  // `cameraReady` only gates the live viewfinder branch — once the user
  // has captured a still and we're rendering the confirm/submitting
  // branches, mid-flow permission revocation is intentionally NOT
  // re-checked. Reasoning (M18 P2.4): the captured `photo.uri` is a
  // local cache file owned by the app, not a live-camera handle, so
  // the upload + analyze flow continues to work even after permission
  // is revoked from Settings. The only artefact would be the user
  // returning to a "permission denied" placeholder if they hit
  // "Retake". That's correct behaviour, not a bug.
  const cameraReady = Boolean(permission?.granted);
  const submitting = isUploading || isAnalyzing;

  // Feedback view — the camera + capture confirm steps unmount visually
  // once the analysis lands so the user lands on the result.
  if (feedback) {
    return (
      <FeedbackView
        feedback={feedback}
        onRetake={handleRetake}
        onDone={handleDone}
      />
    );
  }

  // Submitting view — uploading + analyzing both render the same blocking
  // overlay over the captured-selfie preview. Distinguished by status copy
  // so the user sees "Uploading…" before "Analyzing…".
  if (submitting && capturedUri) {
    return (
      <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: VF_BG }}>
        <View style={s.header}>
          <Pressable onPress={handleClose} accessibilityRole="button" accessibilityLabel={tr('photoFeedback.close')} style={s.headerBtn}>
            <CloseIcon color={VF_FG} />
          </Pressable>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text
              style={{
                fontFamily: fonts.uiSemi,
                fontSize: 10,
                letterSpacing: 1.8,
                color: VF_FG2,
                textTransform: 'uppercase',
              }}>
              {tr('photoFeedback.eyebrow')}
            </Text>
            <Text
              style={{
                fontFamily: fonts.displayMedium,
                fontStyle: 'italic',
                fontSize: 22,
                color: VF_FG,
                marginTop: 2,
              }}>
              {tr('photoFeedback.title')}
            </Text>
          </View>
          <View style={s.headerBtn} />
        </View>
        <View style={s.viewfinder}>
          <Image
            source={{ uri: capturedUri }}
            style={StyleSheet.absoluteFillObject}
            resizeMode="cover"
          />
          <View style={s.busyOverlay}>
            <ActivityIndicator color={VF_FG} size="large" />
            <Text
              style={{
                marginTop: 14,
                fontFamily: fonts.uiSemi,
                fontSize: 11,
                letterSpacing: 1.6,
                textTransform: 'uppercase',
                color: VF_FG,
              }}>
              {isUploading ? tr('photoFeedback.uploading') : tr('photoFeedback.analyzing')}
            </Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // Confirm step — captured but not yet submitted. Shows the still + two
  // CTAs ("Retake" / "Use this selfie"). Mirrors LiveScanScreen's
  // post-capture overlay pattern.
  if (capturedUri) {
    return (
      <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: VF_BG }}>
        <View style={s.header}>
          <Pressable onPress={handleClose} accessibilityRole="button" accessibilityLabel={tr('photoFeedback.close')} style={s.headerBtn}>
            <CloseIcon color={VF_FG} />
          </Pressable>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text
              style={{
                fontFamily: fonts.uiSemi,
                fontSize: 10,
                letterSpacing: 1.8,
                color: VF_FG2,
                textTransform: 'uppercase',
              }}>
              {tr('photoFeedback.eyebrow')}
            </Text>
            <Text
              style={{
                fontFamily: fonts.displayMedium,
                fontStyle: 'italic',
                fontSize: 22,
                color: VF_FG,
                marginTop: 2,
              }}>
              {tr('photoFeedback.title')}
            </Text>
          </View>
          <View style={s.headerBtn} />
        </View>
        <View style={s.viewfinder}>
          <Image
            source={{ uri: capturedUri }}
            style={StyleSheet.absoluteFillObject}
            resizeMode="cover"
          />
        </View>
        {/* Inline error — only shown when an upload/analyze attempt has
            already failed. Keeps the user on the confirm screen with the
            same selfie so a retry doesn't force a re-shoot. The
            subscription sentinel is intentionally NOT rendered here — the
            paywall route effect intercepts it before this branch. */}
        {error && error !== SUBSCRIPTION_SENTINEL ? (
          <View style={[s.errorRow, { backgroundColor: VF_BG, borderTopColor: VF_BORDER }]}>
            <Text
              style={{
                fontFamily: fonts.ui,
                fontSize: 12.5,
                lineHeight: 17,
                color: VF_FG,
                textAlign: 'center',
              }}>
              {tr('photoFeedback.error')}
            </Text>
          </View>
        ) : null}
        <View style={s.confirmBar}>
          <Button label={tr('photoFeedback.retake')} variant="outline" onPress={handleRetake} block style={{ flex: 1 }} />
          <Button label={tr('photoFeedback.confirm')} onPress={handleConfirm} block style={{ flex: 1 }} />
        </View>
      </SafeAreaView>
    );
  }

  // Capture step — live viewfinder + shutter. Camera is dark-themed.
  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: VF_BG }}>
      <View style={s.header}>
        <Pressable onPress={handleClose} accessibilityRole="button" accessibilityLabel={tr('photoFeedback.close')} style={s.headerBtn}>
          <CloseIcon color={VF_FG} />
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text
            style={{
              fontFamily: fonts.uiSemi,
              fontSize: 10,
              letterSpacing: 1.8,
              color: VF_FG2,
              textTransform: 'uppercase',
            }}>
            {tr('photoFeedback.eyebrow')}
          </Text>
          <Text
            style={{
              fontFamily: fonts.displayMedium,
              fontStyle: 'italic',
              fontSize: 22,
              color: VF_FG,
              marginTop: 2,
            }}>
            {tr('photoFeedback.title')}
          </Text>
        </View>
        <View style={s.headerBtn} />
      </View>
      <View style={s.viewfinder}>
        {cameraReady ? (
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            facing={facing}
          />
        ) : (
          <View style={s.placeholder}>
            <View style={[s.placeholderInner, { borderColor: VF_BORDER }]}>
              <Text
                style={{
                  fontFamily: fonts.displayMedium,
                  fontStyle: 'italic',
                  fontSize: 18,
                  color: VF_FG,
                  textAlign: 'center',
                  paddingHorizontal: 24,
                }}>
                {tr('photoFeedback.cameraUnavailable')}
              </Text>
              {permission && !permission.granted && permission.canAskAgain ? (
                <Pressable
                  onPress={() => { hapticLight(); void requestPermission(); }}
                  style={({ pressed }) => [
                    s.permBtn,
                    { borderColor: VF_BORDER, opacity: pressed ? 0.7 : 1 },
                  ]}>
                  <Text style={{ fontFamily: fonts.uiSemi, fontSize: 12.5, color: VF_FG }}>
                    {tr('photoFeedback.allowCamera')}
                  </Text>
                </Pressable>
              ) : null}
              {permission && !permission.granted && !permission.canAskAgain ? (
                <Pressable
                  onPress={() => { hapticLight(); void Linking.openSettings(); }}
                  style={({ pressed }) => [
                    s.permBtn,
                    { borderColor: VF_BORDER, opacity: pressed ? 0.7 : 1 },
                  ]}>
                  <Text style={{ fontFamily: fonts.uiSemi, fontSize: 12.5, color: VF_FG }}>
                    {tr('photoFeedback.openSettings')}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        )}
        <View style={s.hintWrap} pointerEvents="none">
          <Text
            style={{
              fontFamily: fonts.uiSemi,
              fontSize: 10.5,
              letterSpacing: 1.6,
              textTransform: 'uppercase',
              color: VF_FG2,
              textAlign: 'center',
            }}>
            {tr('photoFeedback.hint')}
          </Text>
        </View>
      </View>
      {cameraReady ? (
        <View style={s.bottomBar}>
          <View style={[s.lastThumb, { borderColor: VF_BORDER }]} />
          <Pressable
            onPress={handleCapture}
            accessibilityRole="button"
            accessibilityLabel={tr('photoFeedback.captureCta')}
            style={({ pressed }) => [
              s.shutterRing,
              { borderColor: 'rgba(255,255,255,0.4)', transform: pressed ? [{ scale: 0.94 }] : [] },
            ]}>
            <View style={s.shutterCore} />
          </Pressable>
          <Pressable
            onPress={handleSwitchCamera}
            accessibilityRole="button"
            accessibilityLabel={tr('photoFeedback.switchCamera')}
            style={s.headerBtn}>
            <RotateIcon color={VF_FG} size={20} />
          </Pressable>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

// ─── Feedback view ────────────────────────────────────────────────────
// Light-themed result card — shown after `submitFeedback` resolves.
// Hierarchy: Eyebrow ("Fit notes") → italic PageTitle (summary or
// fallback) → Caption with full commentary → optional color-callout
// chips → optional swap-suggestion garment cards.

function FeedbackView({
  feedback,
  onRetake,
  onDone,
}: {
  feedback: PhotoFeedback;
  onRetake: () => void;
  onDone: () => void;
}) {
  const t = useTokens();
  const summary = feedback.summary ?? null;
  const fitNotes = feedback.fit_notes ?? '';
  const callouts = feedback.color_callouts ?? [];
  const swaps = feedback.swap_suggestions ?? [];
  const overall = feedback.overall_score ?? null;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={[s.lightHeader, { borderBottomColor: t.border }]}>
        <IconBtn ariaLabel="Close" onPress={onDone} variant="ghost">
          <CloseIcon color={t.fg} />
        </IconBtn>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Eyebrow>{tr('photoFeedback.eyebrow')}</Eyebrow>
        </View>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 40, gap: 18 }}
        showsVerticalScrollIndicator={false}>
        <View style={{ gap: 6 }}>
          <Eyebrow>{tr('photoFeedback.fitNotes')}</Eyebrow>
          <PageTitle>{summary && summary.length > 0 ? summary : tr('photoFeedback.title')}</PageTitle>
          {typeof overall === 'number' && Number.isFinite(overall) ? (
            <Text
              style={{
                marginTop: 4,
                fontFamily: fonts.uiSemi,
                fontSize: 10,
                color: t.fg2,
                letterSpacing: 1.4,
                textTransform: 'uppercase',
              }}>
              {tr('photoFeedback.overallTemplate', { score: overall.toFixed(1) })}
            </Text>
          ) : null}
        </View>

        {fitNotes && fitNotes.length > 0 ? (
          <Caption style={{ lineHeight: 19.5 }}>{fitNotes}</Caption>
        ) : null}

        {callouts.length > 0 ? (
          <View style={{ gap: 8 }}>
            <Eyebrow>{tr('photoFeedback.colorCallouts')}</Eyebrow>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {callouts.map((label, idx) => (
                <View
                  key={`${label}-${idx}`}
                  style={[s.calloutChip, { borderColor: t.border, backgroundColor: t.bg2 }]}>
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
              ))}
            </View>
          </View>
        ) : null}

        {swaps.length > 0 ? (
          <View style={{ gap: 8 }}>
            <Eyebrow>{tr('photoFeedback.swapSuggestions')}</Eyebrow>
            <View style={{ gap: 10 }}>
              {swaps.map((swap, idx) => (
                <SwapSuggestionRow
                  key={`${swap.garment_id ?? 'no-id'}-${idx}`}
                  garmentId={swap.garment_id}
                  reason={swap.reason}
                />
              ))}
            </View>
          </View>
        ) : null}

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
          <Button label={tr('photoFeedback.retake')} variant="outline" onPress={onRetake} block style={{ flex: 1 }} />
          <Button label={tr('photoFeedback.done')} onPress={onDone} block style={{ flex: 1 }} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SwapSuggestionRow({
  garmentId,
  reason,
}: {
  garmentId: string | undefined;
  reason: string;
}) {
  const t = useTokens();
  // Hydrate the garment row when the AI returned an explicit id so the
  // suggestion can render with the user's actual garment thumbnail +
  // title. When there's no id, fall back to a reason-only chip.
  const garmentQ = useGarment(garmentId);
  if (!garmentId || !garmentQ.data) {
    return (
      <View style={[s.swapReasonRow, { borderColor: t.border, backgroundColor: t.card }]}>
        <Text style={{ fontFamily: fonts.ui, fontSize: 13, color: t.fg, lineHeight: 19 }}>
          {reason}
        </Text>
      </View>
    );
  }
  const garment = garmentQ.data;
  return (
    <View style={{ gap: 6 }}>
      <View style={{ width: 150 }}>
        <GarmentCard
          garment={{
            id: garment.id,
            title: garment.title ?? 'Garment',
            category: garment.category ?? null,
            color_primary: garment.color_primary ?? null,
            wear_count: garment.wear_count ?? null,
            in_laundry: garment.in_laundry ?? null,
            rendered_image_path: garment.rendered_image_path ?? null,
            original_image_path: garment.original_image_path ?? null,
            created_at: garment.created_at ?? null,
          }}
        />
      </View>
      <Text style={{ fontFamily: fonts.ui, fontSize: 12, color: t.fg2, lineHeight: 17 }}>
        {reason}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 8,
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewfinder: {
    flex: 1,
    margin: 16,
    borderRadius: radii.xl,
    overflow: 'hidden',
    backgroundColor: '#1a1916',
  },
  placeholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  placeholderInner: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 24,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  permBtn: {
    marginTop: 16,
    height: 36,
    paddingHorizontal: 16,
    borderRadius: radii.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hintWrap: {
    position: 'absolute',
    bottom: 24,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  busyOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(12,12,12,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorRow: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderTopWidth: 1,
  },
  confirmBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14,
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 32,
    paddingTop: 12,
    paddingBottom: 8,
  },
  lastThumb: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  shutterRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterCore: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
  },
  lightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  calloutChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  swapReasonRow: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: radii.lg,
    borderWidth: 1,
  },
});
