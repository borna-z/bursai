// Live single-piece scan — rapid-fire auto-detect / auto-snap experience.
//
// Architecture: see docs/superpowers/specs/2026-05-12-livescan-v2-design.md.
//
// Vision Camera v5 (Nitro) replaces the v4 worklet API. The native object
// output (created in `./LiveScan/frameProcessor.ts` via
// `VisionCamera.createObjectOutput`) emits scanned objects on the JS thread,
// where the hook writes a per-frame score + quality enum into shared values.
// UI overlays read those shared values via useAnimatedStyle / useDerivedValue;
// the stability lock runs on the JS thread off a `useDerivedValue + runOnJS`
// bridge and fires `capturePhotoToFile` on lock.
//
// Capture path: v5 does not expose a `takePhoto()` on the Camera ref any
// more — captures go through a `CameraPhotoOutput` returned by
// `usePhotoOutput()`. The photo output is attached to the camera via the
// `outputs` prop, alongside the object output from the frame processor hook.
//
// Always-dark palette is intentional (mirrors the original LiveScanScreen);
// camera UI reads as a "system camera" mode regardless of theme.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQueryClient } from '@tanstack/react-query';
import Animated, {
  Easing,
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  usePhotoOutput,
  type CameraRef,
} from 'react-native-vision-camera';
import * as ImagePicker from 'expo-image-picker';
import * as Crypto from 'expo-crypto';

import { useAuth } from '../contexts/AuthContext';
import { CACHE_KEYS } from '../hooks/cacheKeys';
import { fonts, radii } from '../theme/tokens';
import { CloseIcon } from '../components/icons';
import { hapticLight, hapticMedium } from '../lib/haptics';
import { showToast } from '../lib/toast';
import { t as tr } from '../lib/i18n';
import { log } from '../lib/log';
import type { RootStackParamList } from '../navigation/RootNavigator';

import { BracketOverlay } from './LiveScan/BracketOverlay';
import { QualityHint } from './LiveScan/QualityHint';
import { Filmstrip } from './LiveScan/Filmstrip';
import { LiveScanEvents, type AnalyzedScan } from './LiveScan/events';
import { useLiveScanFrameProcessor } from './LiveScan/frameProcessor';
import {
  analyzeFromCapture,
  persistAnalyzedScan,
  discardAnalyzedScan,
} from './LiveScan/pipeline';
import { ReviewCard, type ReviewCardState } from './LiveScan/ReviewCard';
import { createScanQueue } from './LiveScan/scanQueue';
import { createStabilityLock } from './LiveScan/stabilityLock';
import type { Quality, ScanTileState } from './LiveScan/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// Always-dark palette. Documented exemption to the token rule — camera UI
// is a "system camera" mode regardless of OS theme.
const VF_BG = '#0c0c0c';
const VF_FG = '#FFFFFF';
const VF_FG2 = 'rgba(255,255,255,0.65)';
const ACCENT_GOLD = '#FFD96B';
const VF_BORDER = 'rgba(255,255,255,0.18)';

// Manual-shutter reveal: when the auto-detect score has stayed below
// SCORE_REVEAL_FLOOR for this long, fade up the manual shutter so the user
// has an escape hatch.
//
// Wave S-C.5 — dropped from 3000 → 1500 ms. On stubborn lighting / awkward
// garments, three seconds of empty viewfinder before any escape hatch reads
// as "the camera is broken." Halving the threshold gets the user to a usable
// shutter faster without competing with the auto-detect path (which still
// fires sub-500 ms on a well-framed garment).
const SHUTTER_REVEAL_AFTER_MS = 1_500;
const SCORE_REVEAL_FLOOR = 0.6;
// Wave S-C.5 — "Captured ✓" confirmation overlay shown briefly after every
// shutter tap (manual + auto). The existing white flash signals "snap" but
// users on slow devices have reported uncertainty about whether the tap
// registered; a 200 ms labelled flash removes the doubt without delaying
// the analyze pipeline (the overlay is decorative and async to capture work).
const CAPTURED_FLASH_DURATION_MS = 200;

export function LiveScanScreen() {
  const nav = useNavigation<Nav>();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const cameraRef = useRef<CameraRef>(null);

  // Auto-request once on first mount; the fallback UI handles hard-deny.
  useEffect(() => {
    if (!hasPermission) void requestPermission();
  }, [hasPermission, requestPermission]);

  // Event bus, scan queue and stability lock are screen-scoped — one per
  // mount, GC'd on unmount. `useMemo` (rather than `useRef`) so that the
  // values are stable across renders without the lazy-init dance.
  const events = useMemo(() => new LiveScanEvents(), []);
  // Wave R-D Bug C — review card serializes per-capture, so the queue's
  // legacy `maxConcurrent: 3` setting is no longer correct. Auto-snap can
  // fire a follow-up capture during the small window between
  // `tickLock`-fires-capture and the 'analyzed' event landing, but tickLock
  // gates further fires on `reviewPayloadRef` so only one stale capture
  // can squeak through. Capping at 1 closes the multi-in-flight race
  // surface; the defensive cleanup in the 'analyzed' listener handles any
  // residual stale payloads that still arrive.
  const queue = useMemo(() => createScanQueue({ maxConcurrent: 1 }), []);
  const lock = useMemo(() => createStabilityLock(), []);
  // `scanCount` tracks every capture attempt (header badge — instant feedback
  // so users know rapid-fire snaps fired). `savedCount` only increments when
  // the pipeline emits `saved` or `queued`, so the exit toast reports the
  // truthful count and a pre-save failure doesn't claim a piece was added.
  const [scanCount, setScanCount] = useState(0);
  const [savedCount, setSavedCount] = useState(0);

  // Wave R-D Bug C — per-garment review card state machine. After the
  // analyze phase emits `'analyzed'`, the screen shows the review card and
  // PAUSES scanning until the user picks Save Original / Save Studio /
  // Skip. The pipeline never auto-saves; persist runs only after a tap.
  const [reviewState, setReviewState] = useState<ReviewCardState | null>(null);
  // Latest payload kept in a ref so the 'saved' / 'queued' / 'failed'
  // listeners can match incoming events against the in-flight session
  // without stale-closure churn on every state transition.
  const reviewPayloadRef = useRef<AnalyzedScan | null>(null);

  // Subscribe to pipeline lifecycle events for accurate save accounting +
  // review-card state transitions. The `queued` event covers offline
  // retries (treated as "we'll save it") and `saved` covers the happy
  // path. Both should bump the exit-toast count.
  useEffect(() => {
    const offSaved = events.on('saved', (p) => {
      setSavedCount((c) => c + 1);
      // If the in-flight review session matches the saved event, advance
      // the card to the saved-confirmation state. Stale events from
      // earlier sessions are ignored.
      const current = reviewPayloadRef.current;
      if (current && current.sessionId === p.sessionId) {
        setReviewState((prev) =>
          prev && prev.kind === 'saving'
            ? { kind: 'saved', payload: prev.payload, choice: prev.choice }
            : prev,
        );
      }
    });
    const offQueued = events.on('queued', (p) => {
      setSavedCount((c) => c + 1);
      const current = reviewPayloadRef.current;
      if (current && current.sessionId === p.sessionId) {
        // Offline-queued reads as "saved" to the user — the row will land
        // when the queue replays. The review card's saved confirmation
        // copy works for both paths.
        setReviewState((prev) =>
          prev && prev.kind === 'saving'
            ? { kind: 'saved', payload: prev.payload, choice: prev.choice }
            : prev,
        );
      }
    });
    const offFailed = events.on('failed', (p) => {
      const current = reviewPayloadRef.current;
      if (current && current.sessionId === p.sessionId) {
        setReviewState((prev) =>
          prev && prev.kind === 'saving'
            ? { kind: 'failed', payload: prev.payload, errorClass: p.errorClass }
            : prev,
        );
      }
    });
    const offAnalyzed = events.on('analyzed', (payload) => {
      // First analyzed event arms the review card; subsequent captures
      // while the card is up are gated by the paused tickLock above so
      // we should never see overlapping sessions in practice. But the
      // capture-fires-before-'analyzed'-lands race (auto-snap fires
      // capture 2 ~100 ms before capture 1 emits 'analyzed') CAN squeak
      // a second analyze through with `maxConcurrent: 1` serializing
      // the queue. When that happens the late payload carries
      // already-uploaded raw + masked storage paths — silently dropping
      // it would orphan those objects forever, so route through
      // `discardAnalyzedScan` to clean them up.
      if (reviewPayloadRef.current) {
        void discardAnalyzedScan(payload, events);
        return;
      }
      reviewPayloadRef.current = payload;
      setReviewState({ kind: 'reviewing', payload });
    });
    return () => {
      offSaved();
      offQueued();
      offFailed();
      offAnalyzed();
    };
  }, [events]);

  // Stable React Query invalidation callback passed directly into the pipeline
  // so cache invalidation runs even after this screen has unmounted (the user
  // closed LiveScan with scans still in-flight). The queryClient is the
  // app-root singleton — it stays valid long after the screen is gone.
  // Mirrors the invalidation set from `useAddGarment.onSuccess`.
  const invalidateWardrobe = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['garments'] });
    queryClient.invalidateQueries({ queryKey: ['garments-count'] });
    queryClient.invalidateQueries({ queryKey: ['garments-smart-counts'] });
    queryClient.invalidateQueries({ queryKey: CACHE_KEYS.wardrobeStats(user?.id) });
    queryClient.invalidateQueries({ queryKey: ['insights_dashboard'] });
  }, [queryClient, user?.id]);

  // Shared values driving the overlays + the JS-thread stability lock.
  const score = useSharedValue(0);
  const quality = useSharedValue<Quality>('searching');
  const hasDetectorPlugin = useSharedValue(true);
  const lockProgress = useSharedValue(0);
  const flashOpacity = useSharedValue(0);
  const shutterOpacity = useSharedValue(0);
  // Wave S-C.5 — Captured ✓ confirmation overlay. Drives both the
  // background pill opacity and a subtle upward translation so the badge
  // reads as a positive ack rather than a stuck label. Lives on the worklet
  // runtime so a slow JS thread doesn't delay the feedback.
  const capturedOpacity = useSharedValue(0);

  // Tracks how long the score has been below `SCORE_REVEAL_FLOOR`. Used to
  // fade the manual shutter in after `SHUTTER_REVEAL_AFTER_MS`. Plain ref —
  // no React render dependency.
  const lowScoreSinceRef = useRef<number>(Date.now());

  const { output: detectorOutput, markStaleIfNoRecentScan } =
    useLiveScanFrameProcessor({
      score,
      quality,
      hasDetectorPlugin,
    });
  // `qualityPrioritization: 'speed'` throws on devices that don't support
  // it (older iPhones and many mid-tier Androids). Gate on the device flag
  // and fall back to 'balanced' when unsupported.
  const photoOutput = usePhotoOutput({
    qualityPrioritization: device?.supportsSpeedQualityPrioritization
      ? 'speed'
      : 'balanced',
    quality: 0.85,
  });
  const outputs = useMemo(
    () => (detectorOutput ? [photoOutput, detectorOutput] : [photoOutput]),
    [photoOutput, detectorOutput],
  );

  // Mirror the worklet-driven quality enum into React state so we can drive
  // the QualityHint component and the shutter `pointerEvents` toggle.
  const [qualityState, setQualityState] = useState<Quality>('searching');
  useDerivedValue(() => {
    runOnJS(setQualityState)(quality.value);
  }, [quality]);

  // Mirror shutterOpacity into React state so `pointerEvents` is only 'auto'
  // when the shutter is actually visible. The invisible wrapper (opacity 0)
  // would otherwise intercept taps during the 3-second detector warm-up.
  const [shutterVisible, setShutterVisible] = useState(false);
  useDerivedValue(() => {
    runOnJS(setShutterVisible)(shutterOpacity.value > 0.3);
  }, [shutterOpacity]);

  // Mirror `hasDetectorPlugin` into React state. On platforms / builds where
  // the native object output is unavailable (e.g. Android v5 today, or a
  // failed `CameraObjectOutput` init), the frame processor pins `score` to 0
  // and never publishes again. The shutter-reveal timer downstream is driven
  // by score changes via `useDerivedValue`, so without this signal the
  // manual shutter would never fade in and the user would be stuck with a
  // camera preview and no way to capture.
  const [detectorAvailable, setDetectorAvailable] = useState(true);
  useDerivedValue(() => {
    runOnJS(setDetectorAvailable)(hasDetectorPlugin.value);
  }, [hasDetectorPlugin]);

  // When the detector is unavailable, reveal the manual shutter immediately
  // (no 3 s wait — that timer never fires without score updates) and keep
  // any in-flight progress animation parked at 0.
  useEffect(() => {
    if (detectorAvailable) return;
    shutterOpacity.value = withTiming(1, { duration: 240 });
    lockProgress.value = withTiming(0, { duration: 120 });
  }, [detectorAvailable, shutterOpacity, lockProgress]);

  // capture() is declared before `tickLock` because `tickLock` calls it via
  // `void capture()` on lock fire. Hoisting it via function declarations
  // would also work, but ordering keeps the read-once flow explicit.
  const capture = useCallback(async () => {
    const cam = cameraRef.current;
    if (!cam || !user) return;
    try {
      const photo = await photoOutput.capturePhotoToFile(
        { flashMode: 'off', enableShutterSound: false },
        {},
      );
      // v5 returns `{ filePath }`. RN file URIs need the `file://` scheme;
      // the native side already returns an absolute path, so we just prefix
      // if missing.
      const uri = photo.filePath.startsWith('file://')
        ? photo.filePath
        : `file://${photo.filePath}`;

      // Flash animation — quick fade-up then a slightly slower fade-down so
      // the user perceives a definite "snap" without the overlay lingering.
      flashOpacity.value = withTiming(
        0.6,
        { duration: 80, easing: Easing.out(Easing.cubic) },
        () => {
          flashOpacity.value = withTiming(0, { duration: 130 });
        },
      );
      // Wave S-C.5 — Captured ✓ overlay. Fades in, sits for the bulk of
      // the 200 ms window, then fades back out. Total ~280 ms — short
      // enough not to feel sticky on rapid captures but long enough to
      // register on the slowest devices we ship to.
      capturedOpacity.value = withTiming(
        1,
        { duration: 80, easing: Easing.out(Easing.cubic) },
        () => {
          capturedOpacity.value = withTiming(0, {
            duration: CAPTURED_FLASH_DURATION_MS,
          });
        },
      );

      setScanCount((c) => c + 1);
      const sessionId = Crypto.randomUUID();
      // Wave R-D Bug C — analyze only. Persist runs after the user's
      // review-card tap. The pipeline emits 'analyzed' which the screen's
      // event listener catches to surface the card.
      void queue.enqueue(() => analyzeFromCapture(uri, sessionId, user.id, events));
    } catch (err) {
      log.error(err, { context: 'LiveScanScreen.capture_loop_failed' });
      // Capture-loop errors must never crash the screen. The next stable
      // window will retry automatically.
    }
  }, [user, photoOutput, flashOpacity, capturedOpacity, queue, events]);

  // JS-thread tick driven by the worklet `score` shared value. Drives the
  // stability-lock fire, the shutter reveal timer, and the lock-progress
  // animation that BracketOverlay reads.
  //
  // No-op when the detector is unavailable: without object callbacks the
  // score is pinned to 0 and the score-driven timer below would incorrectly
  // accumulate "low-score" time. The detectorAvailable effect above handles
  // the shutter reveal directly in that case.
  const tickLock = useCallback(
    (s: number) => {
      if (!detectorAvailable) return;
      // Pause auto-snap while the review card is showing. The lock's
      // internal disarmed-until-reset state re-arms on the next below-
      // floor frame, so a tap of Next + the natural empty-frame between
      // garments naturally re-arms detection without further wiring.
      if (reviewPayloadRef.current) return;
      // Lock progress is a soft visual cue; it only animates once the score
      // crosses the "stable enough to be locking" threshold.
      if (s >= 0.7) {
        lockProgress.value = withTiming(Math.min(1, s), { duration: 80 });
      } else {
        lockProgress.value = withTiming(0, { duration: 120 });
      }
      const now = Date.now();
      if (s < SCORE_REVEAL_FLOOR) {
        if (now - lowScoreSinceRef.current > SHUTTER_REVEAL_AFTER_MS) {
          shutterOpacity.value = withTiming(1, { duration: 240 });
        }
      } else {
        lowScoreSinceRef.current = now;
        shutterOpacity.value = withTiming(0, { duration: 200 });
      }
      if (lock.update(s)) {
        hapticMedium();
        void capture();
      }
    },
    [detectorAvailable, lock, capture, lockProgress, shutterOpacity],
  );

  useDerivedValue(() => {
    runOnJS(tickLock)(score.value);
  }, [score, tickLock]);

  // VisionCamera's `onObjectsScanned` callback only fires when the detector
  // reports one or more objects, so on an empty viewfinder `score` never
  // changes and the score-driven `useDerivedValue` above never re-runs. Two
  // problems flow from that:
  //   1. Users would be stranded with no manual shutter when the detector
  //      sees nothing.
  //   2. After an auto-snap, the previous garment's high `score.value`
  //      lingers — the stability lock's "disarmed-until-reset" gate
  //      requires a below-floor sample before re-arming, so the next
  //      well-framed garment never auto-snaps.
  //
  // Heartbeat the lock with the current shared value every 250 ms while the
  // detector is available. Each tick first calls `markStaleIfNoRecentScan`,
  // which resets `score.value` (and `quality`) when the detector has been
  // silent for >500 ms — that synthesises the empty-frame state the lock
  // needs to re-arm. Reading `.value` afterwards picks up the latest
  // worklet write (no stale-closure risk) and `tickLock` is stable via
  // useCallback.
  useEffect(() => {
    if (!detectorAvailable) return;
    const id = setInterval(() => {
      markStaleIfNoRecentScan();
      tickLock(score.value);
    }, 250);
    return () => clearInterval(id);
  }, [detectorAvailable, tickLock, score, markStaleIfNoRecentScan]);

  const handleManualShutter = useCallback(() => {
    // Pause the manual shutter while the review card is up — Wave R-D Bug C
    // gates auto-snap on the same condition.
    if (reviewPayloadRef.current) return;
    hapticMedium();
    void capture();
  }, [capture]);

  // Wave R-D Bug C — review-card handlers. Each transitions the state
  // machine and dispatches the appropriate pipeline phase 2 call.
  const handleSaveOriginal = useCallback(() => {
    const payload = reviewPayloadRef.current;
    if (!payload) return;
    hapticLight();
    setReviewState({ kind: 'saving', payload, choice: 'original' });
    void persistAnalyzedScan(payload, false, events, invalidateWardrobe);
  }, [events, invalidateWardrobe]);

  const handleSaveStudio = useCallback(() => {
    const payload = reviewPayloadRef.current;
    if (!payload) return;
    hapticLight();
    setReviewState({ kind: 'saving', payload, choice: 'studio' });
    void persistAnalyzedScan(payload, true, events, invalidateWardrobe);
  }, [events, invalidateWardrobe]);

  const handleSkip = useCallback(() => {
    const payload = reviewPayloadRef.current;
    if (!payload) return;
    hapticLight();
    setReviewState({ kind: 'skipped', payload });
    void discardAnalyzedScan(payload, events);
  }, [events]);

  const handleNext = useCallback(() => {
    hapticLight();
    reviewPayloadRef.current = null;
    setReviewState(null);
    // The next sub-floor frame re-arms the stability lock automatically
    // via the 250 ms tickLock heartbeat. No manual reset needed.
  }, []);

  const handleTilePress = useCallback(
    (tile: ScanTileState) => {
      if (tile.stage !== 'failed') return;
      hapticLight();
      Alert.alert(tr(`livescan.error.${tile.errorClass ?? 'unknown'}`), undefined, [
        { text: tr('livescan.tile.discard'), style: 'destructive', onPress: () => {
            events.emit('discard', { sessionId: tile.sessionId });
          } },
        {
          text: tr('livescan.tile.retry'),
          onPress: () => {
            if (!user) return;
            const sessionId = Crypto.randomUUID();
            // Retry runs analyze again — the review card surfaces on
            // success exactly as for a fresh capture.
            void queue.enqueue(() =>
              analyzeFromCapture(tile.photoUri, sessionId, user.id, events),
            );
          },
        },
        { text: tr('livescan.tile.cancel'), style: 'cancel' },
      ]);
    },
    [user, queue, events],
  );

  const handleClose = useCallback(() => {
    hapticLight();
    // Report the truthful saved/queued count, not total captures — a 429 on
    // the first snap should not claim '1 pieces added'.
    if (savedCount > 0) {
      showToast('info', tr('livescan.toast.exit', { count: savedCount }));
    }
    nav.goBack();
  }, [nav, savedCount]);

  // Cancel any in-flight reanimated timings when the screen unmounts so the
  // worklet runtime doesn't keep ticking after we're gone.
  useEffect(() => {
    return () => {
      cancelAnimation(lockProgress);
      cancelAnimation(flashOpacity);
      cancelAnimation(shutterOpacity);
      cancelAnimation(capturedOpacity);
    };
  }, [lockProgress, flashOpacity, shutterOpacity, capturedOpacity]);

  const handleGalleryFallback = useCallback(async () => {
    hapticLight();
    if (!user) return;
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return;
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: false,
        quality: 0.8,
      });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      const sessionId = Crypto.randomUUID();
      setScanCount((c) => c + 1);
      // Same two-phase flow as auto-capture — analyze only; the review
      // card handles persist after the user's quality choice.
      void queue.enqueue(() => analyzeFromCapture(asset.uri, sessionId, user.id, events));
    } catch (err) {
      log.error(err, { context: 'LiveScanScreen.gallery_fallback_failed' });
      // Gallery fallback errors are non-fatal — user can retry.
    }
  }, [user, queue, events]);

  const flashStyle = useAnimatedStyle(() => ({ opacity: flashOpacity.value }));
  const shutterStyle = useAnimatedStyle(() => ({
    opacity: shutterOpacity.value,
    transform: [{ scale: 0.9 + 0.1 * shutterOpacity.value }],
  }));
  // Wave S-C.5 — Captured ✓ pill animated style. Opacity + upward drift so
  // the badge has a "received" trajectory rather than a static blink.
  const capturedStyle = useAnimatedStyle(() => ({
    opacity: capturedOpacity.value,
    transform: [{ translateY: 8 * (1 - capturedOpacity.value) }],
  }));

  const cameraReady = Boolean(hasPermission && device);

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: VF_BG }}>
      {/* Header */}
      <View style={s.header}>
        <Pressable
          onPress={handleClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
          style={s.headerBtn}>
          <CloseIcon color={VF_FG} />
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={s.eyebrow}>{tr('livescan.eyebrow')}</Text>
          <Text style={s.title}>{tr('livescan.title')}</Text>
        </View>
        <View style={s.counterBadge} accessibilityLabel={`${scanCount} scanned`}>
          <Text style={s.counterText}>{scanCount}</Text>
        </View>
      </View>

      {/* Viewfinder */}
      <View style={s.viewfinder}>
        {cameraReady && device ? (
          <Camera
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            device={device}
            isActive
            outputs={outputs}
          />
        ) : (
          <PermissionFallback
            onGallery={handleGalleryFallback}
            requestPermission={requestPermission}
          />
        )}

        <BracketOverlay score={score} lockProgress={lockProgress} />
        <QualityHint quality={qualityState} />
        <Animated.View pointerEvents="none" style={[s.flash, flashStyle]} />
        {/* Wave S-C.5 — Captured ✓ pill. Sits above the flash overlay so it
            stays legible even while the white flash is at peak opacity.
            pointerEvents: 'none' across both layers — the user keeps
            tapping the shutter underneath. */}
        <Animated.View pointerEvents="none" style={[s.capturedPill, capturedStyle]}>
          <Text style={s.capturedText}>{tr('livescan.captured.label')} ✓</Text>
        </Animated.View>
      </View>

      {/* Manual shutter — fades in after 3 s of low score. `pointerEvents`
          is 'auto' only when the shutter is actually visible (opacity > 0.3)
          AND not in the 'ready' state (auto-snap about to fire). This prevents
          the invisible wrapper from intercepting taps during the detector
          warm-up window. */}
      <Animated.View
        style={[s.shutterWrap, shutterStyle]}
        pointerEvents={shutterVisible && qualityState !== 'ready' ? 'auto' : 'none'}>
        <Pressable
          onPress={handleManualShutter}
          accessibilityRole="button"
          accessibilityLabel="Capture"
          style={s.shutterRing}>
          <View style={s.shutterCore} />
        </Pressable>
      </Animated.View>

      <Filmstrip events={events} onTilePress={handleTilePress} />

      {/* Wave R-D Bug C — per-garment review card. Mounts only while a
          payload is in-flight; presents Save Original / Save Studio /
          Skip then a Saved/Skipped/Failed → Next confirmation. */}
      <ReviewCard
        state={reviewState}
        onSaveOriginal={handleSaveOriginal}
        onSaveStudio={handleSaveStudio}
        onSkip={handleSkip}
        onNext={handleNext}
      />
    </SafeAreaView>
  );
}

interface PermissionFallbackProps {
  onGallery: () => void;
  requestPermission: () => Promise<boolean>;
}

function PermissionFallback({ onGallery, requestPermission }: PermissionFallbackProps) {
  return (
    <View style={s.permissionFallback}>
      <Text style={s.fallbackTitle}>{tr('livescan.permission.title')}</Text>
      <Pressable
        onPress={async () => {
          const ok = await requestPermission();
          if (!ok) void Linking.openSettings();
        }}
        style={s.permBtn}>
        <Text style={s.permBtnText}>{tr('livescan.permission.allow')}</Text>
      </Pressable>
      <Pressable onPress={onGallery} style={s.permBtn}>
        <Text style={s.permBtnText}>{tr('livescan.permission.gallery')}</Text>
      </Pressable>
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
  eyebrow: {
    fontFamily: fonts.uiSemi,
    fontSize: 10,
    letterSpacing: 1.8,
    color: VF_FG2,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: fonts.displayMedium,
    fontStyle: 'italic',
    fontSize: 22,
    color: VF_FG,
    marginTop: 2,
  },
  counterBadge: {
    minWidth: 36,
    height: 36,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,217,107,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  counterText: { fontFamily: fonts.uiSemi, fontSize: 13, color: ACCENT_GOLD },
  viewfinder: {
    flex: 1,
    margin: 16,
    borderRadius: radii.xl,
    overflow: 'hidden',
    backgroundColor: '#1a1916',
  },
  flash: { ...StyleSheet.absoluteFillObject, backgroundColor: '#FFFFFF' },
  capturedPill: {
    position: 'absolute',
    top: 24,
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(0,0,0,0.62)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  capturedText: {
    fontFamily: fonts.uiSemi,
    fontSize: 12,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: '#FFFFFF',
  },
  shutterWrap: {
    position: 'absolute',
    bottom: 120,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  shutterRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterCore: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#FFFFFF' },
  permissionFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 14,
  },
  fallbackTitle: {
    fontFamily: fonts.displayMedium,
    fontStyle: 'italic',
    fontSize: 20,
    color: VF_FG,
    textAlign: 'center',
    marginBottom: 6,
  },
  permBtn: {
    height: 44,
    paddingHorizontal: 20,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: VF_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permBtnText: { fontFamily: fonts.uiSemi, fontSize: 13, color: VF_FG },
});
