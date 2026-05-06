// Add piece — Step 1 of 3 (multi-photo staging).
// Pixel-faithful port of design_handoff_burs_rn/source/screens.jsx AddGarmentStep1,
// W5-wired to real camera + gallery sources.
//
// Layout: top header (back · eyebrow + title · Cancel) → live-scan hero card →
// 2-col source row (Camera / Gallery) → counter + progress → 3-col photo grid →
// sticky bottom CTA "Analyze".
//
// State: a `photos` array of `{ id, hue, uri }` — capped at MAX. The Camera tile
// jumps into LiveScan (camera capture lives there). The Gallery tile uses
// expo-image-picker (multi-select). Each picked URI is a local file:// path that
// Step 2 uploads + analyzes. Hue is generated for the placeholder gradient that
// shows behind the real image (and remains the fallback if a thumb fails to load).

import React, { useState, useCallback, useRef } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTokens } from '../theme/ThemeProvider';
import { fonts, radii } from '../theme/tokens';
import { Eyebrow } from '../components/Eyebrow';
import { PageTitle } from '../components/PageTitle';
import { Caption } from '../components/Caption';
import { Button } from '../components/Button';
import { IconBtn } from '../components/IconBtn';
import { BackIcon, CameraIcon, ImageIcon } from '../components/icons';
import { hapticLight } from '../lib/haptics';
import type { AddPiecePhoto, RootStackParamList } from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const MAX = 50;

// Same recipe as OutfitCard hue gradients — keeps the visual rhythm consistent across
// screens that show staged garment placeholders.
function hueGrad(h: number): [string, string] {
  return [`hsl(${h}, 38%, 78%)`, `hsl(${(h + 30) % 360}, 30%, 62%)`];
}

type Photo = AddPiecePhoto;

export function AddPieceStep1() {
  const t = useTokens();
  const nav = useNavigation<Nav>();
  const [photos, setPhotos] = useState<Photo[]>([]);
  // Monotonic counter so two photos added in the same millisecond don't collide on `id`
  // (Date.now() + index would dupe across batches added in rapid succession). Audit
  // round 2, finding B7.
  const photoIdRef = useRef(1);

  // Gallery picker — multi-select, capped at MAX after merge.
  const pickFromGallery = useCallback(async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission needed', 'Grant photo access to import from your gallery.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        // SDK 51+ accepts a string array; the legacy MediaTypeOptions enum is deprecated.
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        quality: 0.8,
      });
      if (result.canceled) return;
      const newPhotos: Photo[] = result.assets.map((a) => ({
        id: photoIdRef.current++,
        hue: Math.floor(Math.random() * 360),
        uri: a.uri,
      }));
      setPhotos((prev) => [...prev, ...newPhotos].slice(0, MAX));
    } catch {
      Alert.alert('Gallery unavailable', 'Could not open the photo library.');
    }
  }, []);

  // Camera tile → LiveScan handles permission + capture, then deep-links into Step 2 itself.
  // No need to add anything to the staged grid here — LiveScan owns the single-piece path.
  const openLiveScan = useCallback(() => {
    hapticLight();
    nav.navigate('LiveScan');
  }, [nav]);

  const removePhoto = (id: number) => {
    hapticLight();
    setPhotos((prev) => prev.filter((p) => p.id !== id));
  };

  // Continue → upload + analyze the FIRST photo. Multi-photo batch processing is W9 work
  // (track in Findings as "Wave 9 — multi-photo Add flow"); this PR ships single-photo
  // end-to-end so the AI + render pipelines can land cleanly first. allUris is threaded
  // through anyway so the Step 2 → 3 → re-enter Step 2 loop can wire up later without
  // another nav-types change.
  const onContinue = () => {
    const first = photos[0];
    if (!first) return;
    hapticLight();
    nav.navigate('AddPieceStep2', {
      photoUri: first.uri,
      allUris: photos.map((p) => p.uri),
      source: 'add_photo',
    });
  };

  const ready = photos.length;
  const pct = (photos.length / MAX) * 100;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={['top']}>
      {/* ============ HEADER ============ */}
      <View style={[s.header, { borderBottomColor: t.border }]}>
        <IconBtn variant="ghost" onPress={() => nav.goBack()} ariaLabel="Back">
          <BackIcon color={t.fg} />
        </IconBtn>
        <View style={{ flex: 1 }}>
          <Eyebrow style={{ marginBottom: 2 }}>New garment</Eyebrow>
          <PageTitle size={26}>Add pieces</PageTitle>
        </View>
        <Pressable onPress={() => nav.goBack()} style={{ paddingHorizontal: 6, paddingVertical: 8 }}>
          <Text style={{ fontFamily: fonts.uiMed, fontSize: 13, color: t.fg2, fontWeight: '500' }}>Cancel</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 24, gap: 16 }}
        showsVerticalScrollIndicator={false}>
        {/* ============ LIVE SCAN HERO ============ */}
        <Pressable
          onPress={openLiveScan}
          accessibilityRole="button"
          style={({ pressed }) => [
            s.heroCard,
            { borderColor: t.border, backgroundColor: t.card, transform: pressed ? [{ scale: 0.99 }] : [] },
          ]}>
          {/* Soft accent radial in the corner — matches Card hero pattern */}
          <LinearGradient
            colors={[t.accentSoft, 'rgba(0,0,0,0)']}
            start={{ x: 1, y: 0 }}
            end={{ x: 0.3, y: 0.6 }}
            style={{ position: 'absolute', top: 0, right: 0, width: '70%', height: '60%' }}
            pointerEvents="none"
          />
          <View style={{ flex: 1, gap: 4 }}>
            <Eyebrow>Recommended · single piece</Eyebrow>
            <Text style={{ fontFamily: fonts.uiSemi, fontSize: 16, fontWeight: '600', letterSpacing: -0.32, color: t.fg, marginTop: 2 }}>
              Live scan
            </Text>
            <Text style={{ fontFamily: fonts.ui, fontSize: 12, color: t.fg2, lineHeight: 17 }}>
              Place the garment on a flat surface — we'll auto-crop and tag.
            </Text>
          </View>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: radii.md,
              backgroundColor: t.accentSoft,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <CameraIcon color={t.accent} />
          </View>
        </Pressable>

        {/* ============ SOURCE ROW ============ */}
        <View>
          <Eyebrow style={{ marginBottom: 8 }}>Or add photos</Eyebrow>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <SourcePill
              label="Camera"
              sub="Shoot now"
              icon={<CameraIcon color={t.accent} />}
              onPress={openLiveScan}
            />
            <SourcePill
              label="Gallery"
              sub="Pick photos"
              icon={<ImageIcon color={t.accent} />}
              onPress={pickFromGallery}
            />
          </View>
        </View>

        {/* ============ COUNTER + PROGRESS ============ */}
        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Text style={{ fontFamily: fonts.displayMedium, fontStyle: 'italic', fontSize: 22, fontWeight: '500', color: t.fg }}>
              {photos.length}
              <Text style={{ color: t.fg3 }}> / {MAX}</Text>
            </Text>
            <Text style={{ fontFamily: fonts.uiSemi, fontSize: 10, letterSpacing: 1.7, color: t.fg2, textTransform: 'uppercase' }}>
              Photos staged
            </Text>
          </View>
          <View style={{ height: 3, borderRadius: 2, backgroundColor: t.bg2, overflow: 'hidden' }}>
            <View style={{ width: `${pct}%`, height: '100%', backgroundColor: t.accent }} />
          </View>
        </View>

        {/* ============ PHOTO GRID — 3 col ============ */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {photos.map((p, i) => (
            <View key={p.id} style={s.photoTile}>
              {/* Hue gradient sits behind the real image so the tile has a visible
                  surface while the file:// URI loads (and as a fallback if it fails). */}
              <LinearGradient
                colors={hueGrad(p.hue)}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFillObject}
              />
              <Image
                source={{ uri: p.uri }}
                style={StyleSheet.absoluteFillObject}
                resizeMode="cover"
              />
              <View
                style={{
                  position: 'absolute',
                  top: 6,
                  left: 6,
                  paddingHorizontal: 6,
                  paddingVertical: 1,
                  borderRadius: radii.pill,
                  backgroundColor: t.scrimBg,
                }}>
                <Text style={{ fontFamily: fonts.uiBold, fontSize: 9, color: t.scrimFg, letterSpacing: 0.2 }}>
                  {String(i + 1).padStart(2, '0')}
                </Text>
              </View>
              <Pressable
                onPress={() => removePhoto(p.id)}
                accessibilityLabel="Remove photo"
                style={({ pressed }) => [
                  s.photoX,
                  { backgroundColor: t.scrimBg, opacity: pressed ? 0.7 : 1 },
                ]}>
                <Text style={{ color: t.scrimFg, fontSize: 14, lineHeight: 14, fontWeight: '600' }}>×</Text>
              </Pressable>
            </View>
          ))}
          {photos.length < MAX ? (
            <Pressable
              onPress={pickFromGallery}
              accessibilityLabel="Add photo"
              style={({ pressed }) => [
                s.photoTile,
                {
                  borderWidth: 1.4,
                  borderStyle: 'dashed',
                  borderColor: t.accent,
                  backgroundColor: t.accentSoft,
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                  transform: pressed ? [{ scale: 0.97 }] : [],
                },
              ]}>
              <Text style={{ fontFamily: fonts.ui, fontSize: 22, color: t.accent, fontWeight: '300', lineHeight: 24 }}>+</Text>
              <Text style={{ fontFamily: fonts.uiSemi, fontSize: 10, color: t.accent, letterSpacing: 1.4, textTransform: 'uppercase' }}>
                Add
              </Text>
            </Pressable>
          ) : null}
        </View>

        <Caption style={{ textAlign: 'center', opacity: 0.7 }}>
          Up to {MAX} photos · Private to your wardrobe
        </Caption>
      </ScrollView>

      {/* ============ STICKY CTA ============ */}
      <View style={[s.stickyBar, { borderTopColor: t.border, backgroundColor: t.bg }]}>
        <View style={{ flex: 1 }}>
          <Eyebrow style={{ marginBottom: 2 }}>{ready} ready</Eyebrow>
          <Text style={{ fontFamily: fonts.ui, fontSize: 11, color: t.fg2, letterSpacing: -0.11 }}>
            We'll tag each one automatically
          </Text>
        </View>
        <Button
          label={ready > 1 ? 'Analyze first' : 'Analyze piece'}
          onPress={onContinue}
          disabled={ready === 0}
        />
      </View>
    </SafeAreaView>
  );
}

// Local SourcePill — extracted so the JSX above stays readable. Not promoted to /components/
// because it's only used in Step 1 of this flow; if it appears elsewhere it'll move.
function SourcePill({
  label,
  sub,
  icon,
  onPress,
}: {
  label: string;
  sub: string;
  icon: React.ReactNode;
  onPress: () => void;
}) {
  const t = useTokens();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        {
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          padding: 12,
          borderRadius: radii.lg,
          borderWidth: 1,
          borderColor: t.border,
          backgroundColor: t.card,
          transform: pressed ? [{ scale: 0.98 }] : [],
        },
      ]}>
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: radii.md,
          backgroundColor: t.accentSoft,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        {icon}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonts.uiSemi, fontSize: 13, color: t.fg, letterSpacing: -0.13, fontWeight: '600' }}>
          {label}
        </Text>
        <Text style={{ fontFamily: fonts.uiSemi, fontSize: 9.5, color: t.fg2, letterSpacing: 1.3, textTransform: 'uppercase', marginTop: 2 }}>
          {sub}
        </Text>
      </View>
    </Pressable>
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
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: radii.xl,
    borderWidth: 1,
    overflow: 'hidden',
  },
  photoTile: {
    width: '31.5%',
    aspectRatio: 1,
    borderRadius: radii.sm,
    overflow: 'hidden',
    position: 'relative',
  },
  photoX: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
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
});
