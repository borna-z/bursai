// Live single-piece scan — full-screen dark camera UI with viewfinder + shutter.
// Source: design_handoff_burs_rn/source/more-screens.jsx LiveScanScreen (lines 833-932).
//
// Always-dark background — `#0c0c0c` is intentional regardless of system theme. Camera UI
// reads as a "system camera" mode; switching to light bg when OS is light would feel wrong.
// Documented exemption to the token rule (only this screen).
//
// W5 wiring:
//   • Real CameraView capture via takePictureAsync — no more simulated hue placeholder.
//   • "Use this photo" deep-links into AddPieceStep2 with the captured local URI; Step 2
//     handles the upload + analyze hand-off.
//   • Expo Go fallback: native camera isn't fully available there, so the placeholder
//     stays AND we add a "Pick from gallery" escape hatch using expo-image-picker so the
//     LiveScan entry point isn't a dead-end during dev.

import React, { useEffect, useRef, useState } from 'react';
import { Alert, Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CameraView, useCameraPermissions, type CameraType } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';

import { fonts, radii } from '../theme/tokens';
import { Button } from '../components/Button';
import { CloseIcon, RotateIcon, SunIcon, CameraIcon } from '../components/icons';
import { hapticLight, hapticMedium } from '../lib/haptics';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// Always-dark palette. Documented exemption — see file header.
const VF_BG = '#0c0c0c';
const VF_FG = '#FFFFFF';
const VF_FG2 = 'rgba(255,255,255,0.65)';
const VF_BORDER = 'rgba(255,255,255,0.12)';

export function LiveScanScreen() {
  const nav = useNavigation<Nav>();

  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  const [flash, setFlash] = useState(false);
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const cameraRef = useRef<CameraView | null>(null);

  // Auto-request permission once on first mount when the user hasn't been asked yet.
  // If they've already denied with `canAskAgain === false`, the placeholder UI offers
  // a Settings link instead.
  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      void requestPermission();
    }
  }, [permission, requestPermission]);

  const handleCapture = async () => {
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
        Alert.alert('Capture failed', 'Try again.');
      }
    } catch {
      Alert.alert('Capture failed', 'Try again.');
    }
  };

  const handleRetake = () => {
    hapticLight();
    setCapturedUri(null);
  };

  const handleUsePhoto = () => {
    if (!capturedUri) return;
    hapticLight();
    nav.navigate('AddPieceStep2', {
      photoUri: capturedUri,
      allUris: [capturedUri],
      source: 'live_scan',
    });
  };

  const handleSwitchCamera = () => {
    hapticLight();
    setFacing((f) => (f === 'back' ? 'front' : 'back'));
  };

  const handleToggleFlash = () => {
    hapticLight();
    setFlash((f) => !f);
  };

  // Expo Go / permission-denied fallback — opens the gallery so the entry point still
  // produces a result. Same flow as Step 1's Gallery tile but contained here so the
  // user doesn't have to back out and restart.
  const handleGalleryFallback = async () => {
    hapticLight();
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission needed', 'Grant photo access to import from your gallery.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: false,
        quality: 0.8,
      });
      if (result.canceled || !result.assets[0]) return;
      const uri = result.assets[0].uri;
      // Gallery escape from LiveScan still tags as 'live_scan' since the user came in via
      // the LiveScan entry — the render queue's `source` is for entry-point provenance,
      // not the underlying capture mechanism.
      nav.navigate('AddPieceStep2', { photoUri: uri, allUris: [uri], source: 'live_scan' });
    } catch {
      Alert.alert('Gallery unavailable', 'Could not open the photo library.');
    }
  };

  const cameraReady = Boolean(permission?.granted);

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: VF_BG }}>
      {/* Header */}
      <View style={s.header}>
        <Pressable
          onPress={() => { hapticLight(); nav.goBack(); }}
          accessibilityRole="button"
          accessibilityLabel="Close"
          style={s.headerBtn}>
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
            Live scan
          </Text>
          <Text
            style={{
              fontFamily: fonts.displayMedium,
              fontStyle: 'italic',
              fontSize: 22,
              color: VF_FG,
              marginTop: 2,
            }}>
            Scan piece
          </Text>
        </View>
        <Pressable
          onPress={handleToggleFlash}
          accessibilityRole="button"
          accessibilityLabel={flash ? 'Flash on' : 'Flash off'}
          style={[
            s.headerBtn,
            flash ? { backgroundColor: 'rgba(255,255,255,0.18)' } : null,
          ]}>
          <SunIcon color={flash ? '#FFD96B' : VF_FG} size={18} />
        </Pressable>
      </View>

      {/* Viewfinder */}
      <View style={s.viewfinder}>
        {cameraReady ? (
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            facing={facing}
            flash={flash ? 'on' : 'off'}
          />
        ) : (
          <View style={s.placeholder}>
            <View style={[s.placeholderInner, { borderColor: VF_BORDER }]}>
              <CameraIcon color={VF_FG2} size={36} />
              <Text
                style={{
                  marginTop: 14,
                  fontFamily: fonts.displayMedium,
                  fontStyle: 'italic',
                  fontSize: 18,
                  color: VF_FG,
                  textAlign: 'center',
                  paddingHorizontal: 24,
                }}>
                Camera available in device build
              </Text>
              {permission && !permission.granted && permission.canAskAgain ? (
                <Pressable
                  onPress={() => { hapticLight(); void requestPermission(); }}
                  style={({ pressed }) => [
                    s.permBtn,
                    { borderColor: VF_BORDER, opacity: pressed ? 0.7 : 1 },
                  ]}>
                  <Text style={{ fontFamily: fonts.uiSemi, fontSize: 12.5, color: VF_FG }}>
                    Allow camera
                  </Text>
                </Pressable>
              ) : null}
              {/* Hard-deny path — `requestPermission` would silently no-op, so the only way
                  to recover is to flip the switch in system Settings. Linking.openSettings()
                  is the cross-platform deep link Expo + RN both expose. Audit round 2 (C). */}
              {permission && !permission.granted && !permission.canAskAgain ? (
                <Pressable
                  onPress={() => { hapticLight(); void Linking.openSettings(); }}
                  style={({ pressed }) => [
                    s.permBtn,
                    { borderColor: VF_BORDER, opacity: pressed ? 0.7 : 1 },
                  ]}>
                  <Text style={{ fontFamily: fonts.uiSemi, fontSize: 12.5, color: VF_FG }}>
                    Open Settings
                  </Text>
                </Pressable>
              ) : null}
              {/* Gallery escape hatch so LiveScan isn't a dead-end in Expo Go or after a
                  hard-deny. Same destination as the camera path (Step 2 with a single URI). */}
              <Pressable
                onPress={handleGalleryFallback}
                style={({ pressed }) => [
                  s.permBtn,
                  { borderColor: VF_BORDER, opacity: pressed ? 0.7 : 1, marginTop: 10 },
                ]}>
                <Text style={{ fontFamily: fonts.uiSemi, fontSize: 12.5, color: VF_FG }}>
                  Pick from gallery
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Corner brackets */}
        <View style={[s.bracket, s.bracketTL, { borderColor: VF_FG }]} />
        <View style={[s.bracket, s.bracketTR, { borderColor: VF_FG }]} />
        <View style={[s.bracket, s.bracketBL, { borderColor: VF_FG }]} />
        <View style={[s.bracket, s.bracketBR, { borderColor: VF_FG }]} />

        {/* Hint */}
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
            Place garment on flat surface
          </Text>
        </View>

        {/* Post-capture overlay — shows the actual captured photo, not a hue placeholder */}
        {capturedUri ? (
          <View style={s.postCaptureOverlay}>
            <View style={[s.postCapturePreview, { borderColor: VF_BORDER }]}>
              <Image
                source={{ uri: capturedUri }}
                style={StyleSheet.absoluteFillObject}
                resizeMode="cover"
              />
            </View>
            <View style={s.postCaptureActions}>
              <Button label="Use this photo" onPress={handleUsePhoto} block />
              <Pressable
                onPress={handleRetake}
                accessibilityRole="button"
                accessibilityLabel="Retake"
                style={({ pressed }) => [
                  s.retakeBtn,
                  { borderColor: VF_BORDER, opacity: pressed ? 0.7 : 1 },
                ]}>
                <Text style={{ fontFamily: fonts.uiSemi, fontSize: 13, color: VF_FG }}>
                  Retake
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>

      {/* Bottom controls — hide when post-capture overlay is up or when we're showing
          the placeholder fallback (no shutter to fire if the camera isn't mounted) */}
      {!capturedUri && cameraReady ? (
        <View style={s.bottomBar}>
          {/* Last photo placeholder — empty in W5; can be wired to a recents reel later */}
          <View style={[s.lastThumb, { backgroundColor: 'transparent', borderColor: VF_BORDER }]} />
          {/* Shutter */}
          <Pressable
            onPress={handleCapture}
            accessibilityRole="button"
            accessibilityLabel="Capture"
            style={({ pressed }) => [
              s.shutterRing,
              { borderColor: 'rgba(255,255,255,0.4)', transform: pressed ? [{ scale: 0.94 }] : [] },
            ]}>
            <View style={s.shutterCore} />
          </Pressable>
          {/* Switch camera */}
          <Pressable
            onPress={handleSwitchCamera}
            accessibilityRole="button"
            accessibilityLabel="Switch camera"
            style={s.headerBtn}>
            <RotateIcon color={VF_FG} size={20} />
          </Pressable>
        </View>
      ) : null}
    </SafeAreaView>
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
  bracket: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderColor: '#fff',
    borderRadius: 4,
  },
  bracketTL: { top: 24, left: 24, borderTopWidth: 2, borderLeftWidth: 2 },
  bracketTR: { top: 24, right: 24, borderTopWidth: 2, borderRightWidth: 2 },
  bracketBL: { bottom: 24, left: 24, borderBottomWidth: 2, borderLeftWidth: 2 },
  bracketBR: { bottom: 24, right: 24, borderBottomWidth: 2, borderRightWidth: 2 },
  hintWrap: {
    position: 'absolute',
    bottom: 24,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  postCaptureOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(12,12,12,0.92)',
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 28,
    justifyContent: 'space-between',
  },
  postCapturePreview: {
    flex: 1,
    borderRadius: radii.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  postCaptureActions: {
    marginTop: 20,
    gap: 10,
  },
  retakeBtn: {
    height: 44,
    borderRadius: radii.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
});
