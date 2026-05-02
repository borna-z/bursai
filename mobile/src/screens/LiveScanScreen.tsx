// Live single-piece scan — full-screen dark camera UI with viewfinder + shutter.
// Source: design_handoff_burs_rn/source/more-screens.jsx LiveScanScreen (lines 833-932).
//
// Always-dark background — `#0c0c0c` is intentional regardless of system theme. Camera UI
// reads as a "system camera" mode; switching to light bg when OS is light would feel wrong.
// Documented exemption to the token rule (only this screen + the always-light ShareOutfit card).
//
// expo-camera (v17) is wired via useCameraPermissions + CameraView. In Expo Go the native
// module isn't fully available — we fall back to the dark placeholder rect with a copy line
// telling the user a device build is required. In a dev build the live preview renders.
//
// Capture is simulated (button press toggles `captured` + records a hue) — writing a real
// photo to disk requires media-library access, deferred to a follow-up dep update.

import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CameraView, useCameraPermissions, type CameraType } from 'expo-camera';

import { useTokens } from '../theme/ThemeProvider';
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
  const t = useTokens();
  const nav = useNavigation<Nav>();

  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  const [flash, setFlash] = useState(false);
  const [captured, setCaptured] = useState(false);
  const [lastHue, setLastHue] = useState<number | null>(null);

  const handleCapture = () => {
    hapticMedium();
    // Simulated capture — pick a hue so the post-capture preview has something to show.
    setLastHue(Math.floor(Math.random() * 360));
    setCaptured(true);
  };

  const handleRetake = () => {
    hapticLight();
    setCaptured(false);
  };

  const handleUsePhoto = () => {
    hapticLight();
    nav.navigate('AddPieceStep2');
  };

  const handleSwitchCamera = () => {
    hapticLight();
    setFacing((f) => (f === 'back' ? 'front' : 'back'));
  };

  const handleToggleFlash = () => {
    hapticLight();
    setFlash((f) => !f);
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
                  onPress={() => { hapticLight(); requestPermission(); }}
                  style={({ pressed }) => [
                    s.permBtn,
                    { borderColor: VF_BORDER, opacity: pressed ? 0.7 : 1 },
                  ]}>
                  <Text
                    style={{
                      fontFamily: fonts.uiSemi,
                      fontSize: 12.5,
                      color: VF_FG,
                    }}>
                    Allow camera
                  </Text>
                </Pressable>
              ) : null}
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

        {/* Post-capture overlay */}
        {captured ? (
          <View style={s.postCaptureOverlay}>
            <View
              style={[
                s.postCapturePreview,
                {
                  backgroundColor:
                    lastHue !== null ? `hsl(${lastHue}, 22%, 78%)` : '#3A3833',
                  borderColor: VF_BORDER,
                },
              ]}
            />
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
                <Text
                  style={{
                    fontFamily: fonts.uiSemi,
                    fontSize: 13,
                    color: VF_FG,
                  }}>
                  Retake
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>

      {/* Bottom controls — hide when post-capture overlay is up */}
      {!captured ? (
        <View style={s.bottomBar}>
          {/* Last photo thumbnail */}
          <View
            style={[
              s.lastThumb,
              {
                backgroundColor:
                  lastHue !== null ? `hsl(${lastHue}, 22%, 78%)` : 'transparent',
                borderColor: VF_BORDER,
              },
            ]}
          />
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
