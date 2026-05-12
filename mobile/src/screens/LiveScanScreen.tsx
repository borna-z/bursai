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
import { fonts, radii } from '../theme/tokens';
import { CloseIcon } from '../components/icons';
import { hapticLight, hapticMedium } from '../lib/haptics';
import { showToast } from '../lib/toast';
import { t as tr } from '../lib/i18n';
import type { RootStackParamList } from '../navigation/RootNavigator';

import { BracketOverlay } from './LiveScan/BracketOverlay';
import { QualityHint } from './LiveScan/QualityHint';
import { Filmstrip } from './LiveScan/Filmstrip';
import { LiveScanEvents } from './LiveScan/events';
import { useLiveScanFrameProcessor } from './LiveScan/frameProcessor';
import { ingestScan } from './LiveScan/pipeline';
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
const SHUTTER_REVEAL_AFTER_MS = 3_000;
const SCORE_REVEAL_FLOOR = 0.6;

export function LiveScanScreen() {
  const nav = useNavigation<Nav>();
  const { user } = useAuth();

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
  const queue = useMemo(() => createScanQueue({ maxConcurrent: 3 }), []);
  const lock = useMemo(() => createStabilityLock(), []);
  const [scanCount, setScanCount] = useState(0);

  // Shared values driving the overlays + the JS-thread stability lock.
  const score = useSharedValue(0);
  const quality = useSharedValue<Quality>('searching');
  const hasDetectorPlugin = useSharedValue(true);
  const lockProgress = useSharedValue(0);
  const flashOpacity = useSharedValue(0);
  const shutterOpacity = useSharedValue(0);

  // Tracks how long the score has been below `SCORE_REVEAL_FLOOR`. Used to
  // fade the manual shutter in after `SHUTTER_REVEAL_AFTER_MS`. Plain ref —
  // no React render dependency.
  const lowScoreSinceRef = useRef<number>(Date.now());

  const { objectOutput } = useLiveScanFrameProcessor({
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
    () => (objectOutput ? [photoOutput, objectOutput] : [photoOutput]),
    [photoOutput, objectOutput],
  );

  // Mirror the worklet-driven quality enum into React state so we can drive
  // the QualityHint component and the shutter `pointerEvents` toggle.
  const [qualityState, setQualityState] = useState<Quality>('searching');
  useDerivedValue(() => {
    runOnJS(setQualityState)(quality.value);
  }, [quality]);

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

      setScanCount((c) => c + 1);
      const sessionId = Crypto.randomUUID();
      // Fire-and-forget — pipeline owns error classification and emits via
      // the events bus, which the Filmstrip subscribes to.
      void queue.enqueue(() => ingestScan(uri, sessionId, user.id, events));
    } catch {
      // Capture-loop errors must never crash the screen. The next stable
      // window will retry automatically.
    }
  }, [user, photoOutput, flashOpacity, queue, events]);

  // JS-thread tick driven by the worklet `score` shared value. Drives the
  // stability-lock fire, the shutter reveal timer, and the lock-progress
  // animation that BracketOverlay reads.
  const tickLock = useCallback(
    (s: number) => {
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
    [lock, capture, lockProgress, shutterOpacity],
  );

  useDerivedValue(() => {
    runOnJS(tickLock)(score.value);
  }, [score, tickLock]);

  const handleManualShutter = useCallback(() => {
    hapticMedium();
    void capture();
  }, [capture]);

  const handleTilePress = useCallback(
    (tile: ScanTileState) => {
      if (tile.stage !== 'failed') return;
      hapticLight();
      Alert.alert(tr(`livescan.error.${tile.errorClass ?? 'unknown'}`), undefined, [
        { text: tr('livescan.tile.discard'), style: 'destructive' },
        {
          text: tr('livescan.tile.retry'),
          onPress: () => {
            if (!user) return;
            const sessionId = Crypto.randomUUID();
            void queue.enqueue(() =>
              ingestScan(tile.photoUri, sessionId, user.id, events),
            );
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]);
    },
    [user, queue, events],
  );

  const handleClose = useCallback(() => {
    hapticLight();
    if (scanCount > 0) {
      showToast('info', tr('livescan.toast.exit', { count: scanCount }));
    }
    nav.goBack();
  }, [nav, scanCount]);

  // Cancel any in-flight reanimated timings when the screen unmounts so the
  // worklet runtime doesn't keep ticking after we're gone.
  useEffect(() => {
    return () => {
      cancelAnimation(lockProgress);
      cancelAnimation(flashOpacity);
      cancelAnimation(shutterOpacity);
    };
  }, [lockProgress, flashOpacity, shutterOpacity]);

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
      void queue.enqueue(() => ingestScan(asset.uri, sessionId, user.id, events));
    } catch {
      // Gallery fallback errors are non-fatal — user can retry.
    }
  }, [user, queue, events]);

  const flashStyle = useAnimatedStyle(() => ({ opacity: flashOpacity.value }));
  const shutterStyle = useAnimatedStyle(() => ({
    opacity: shutterOpacity.value,
    transform: [{ scale: 0.9 + 0.1 * shutterOpacity.value }],
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
      </View>

      {/* Manual shutter — fades in after 3 s of low score. `pointerEvents`
          toggles off in the 'ready' state because the auto-snap is about
          to fire; we don't want a double-tap to capture twice. */}
      <Animated.View
        style={[s.shutterWrap, shutterStyle]}
        pointerEvents={qualityState === 'ready' ? 'none' : 'auto'}>
        <Pressable
          onPress={handleManualShutter}
          accessibilityRole="button"
          accessibilityLabel="Capture"
          style={s.shutterRing}>
          <View style={s.shutterCore} />
        </Pressable>
      </Animated.View>

      <Filmstrip events={events} onTilePress={handleTilePress} />
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
      <Text style={s.fallbackTitle}>Camera access needed</Text>
      <Pressable
        onPress={async () => {
          const ok = await requestPermission();
          if (!ok) void Linking.openSettings();
        }}
        style={s.permBtn}>
        <Text style={s.permBtnText}>Allow camera</Text>
      </Pressable>
      <Pressable onPress={onGallery} style={s.permBtn}>
        <Text style={s.permBtnText}>Pick from gallery</Text>
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
