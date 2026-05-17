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
import { BackIcon, CameraIcon, ImageIcon, LinkIcon, SearchIcon } from '../components/icons';
import { useAuth } from '../contexts/AuthContext';
import { useAnalyzeGarment, type AnalysisResult } from '../hooks/useAnalyzeGarment';
import { hapticLight } from '../lib/haptics';
import { startBatch } from '../lib/batchPipeline';
import { setAnalyzePrefetch } from '../lib/analyzePrefetch';
import { trackEvent, markAddPieceCheckpoint } from '../lib/analytics';
import { resizeForGarment, GARMENT_IMAGE_MIME } from '../lib/imageUpload';
import { t as tr } from '../lib/i18n';
import { log } from '../lib/log';
import type { AddPiecePhoto, RootStackParamList } from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const MAX = 50;

// Same recipe as OutfitCard hue gradients — keeps the visual rhythm consistent across
// screens that show staged garment placeholders.
function hueGrad(h: number): [string, string] {
  return [`hsl(${h}, 38%, 78%)`, `hsl(${(h + 30) % 360}, 30%, 62%)`];
}

type Photo = AddPiecePhoto;

// Wave S-C.1 — kick off the same resize → base64 → analyze pipeline that
// Step 2 would otherwise wait on, the moment a single photo lands here.
// Promises are parked in the analyzePrefetch registry keyed by photo URI.
// Step 2's runAnalyzeAndUpload checks the registry on mount and awaits the
// cached promise if present, otherwise starts fresh. In the common case
// where the user spends a couple of seconds reviewing Step 1 before tapping
// Continue, analysis is already in-flight (often resolved) by the time
// Step 2 mounts — Step 3 lands almost immediately.
//
// Called from `openCameraSingle` (definitively single-photo) and from
// `pickFromGallery` ONLY when the picked count brings the staged total to
// exactly 1. Multi-photo selections fall through to batchPipeline which
// owns its own coordination — a stray prefetch entry would just sit unused
// until the 5-min TTL prunes it.
//
// Failure semantics: if analyze() rejects, the cached promise rejects
// identically; Step 2's awaiter falls through to its existing error UI.
function kickSinglePhotoPrefetch(
  uri: string,
  analyze: (input: { base64: string }) => Promise<AnalysisResult | null>,
): void {
  // Wave S-C.6 — first checkpoint in the perceived-speed funnel. We mark
  // t_capture the moment a single photo lands in Step 1 and the prefetch
  // fires. The `addpiece.analyze.timing` row (emitted by useAnalyzeGarment)
  // is joinable on session/user.
  trackEvent('addpiece.capture', { source: 'step1.single' });
  markAddPieceCheckpoint(uri, 'capture', { source: 'step1.single' });
  // Resize once; the resized result is itself cached on the entry so Step 2
  // can hand the SAME bytes to the upload path without re-running
  // ImageManipulator on a now-known-good source.
  const resized = resizeForGarment(uri, { wantBase64: true });
  const promise = resized.then((r) => {
    if (!r.base64) return null;
    const base64 = `data:${GARMENT_IMAGE_MIME};base64,${r.base64}`;
    return analyze({ base64 });
  });
  // Swallow rejections so the unobserved-promise warning doesn't fire — the
  // cached promise itself still rejects when Step 2 awaits it, surfacing
  // the error there.
  promise.catch((err) =>
    log.error(err, { context: 'AddPieceStep1.prefetch_analyze_failed' }),
  );
  setAnalyzePrefetch(uri, { promise, resized, createdAt: Date.now() });
}

export function AddPieceStep1() {
  const t = useTokens();
  const nav = useNavigation<Nav>();
  const { user } = useAuth();
  const { analyze } = useAnalyzeGarment();
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
        Alert.alert(tr('addpiece.step1.permission.title'), tr('addpiece.step1.permission.body'));
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
      // Wave S-C.1 — prefetch analyze when the merged staged total is
      // exactly 1 photo (single picked AND the grid was empty). Multi-photo
      // selections fall through to batchPipeline.
      //
      // Read-before-update so the prefetch decision is based on the live
      // photo count, not the state-updater closure (StrictMode in dev fires
      // the updater twice; firing prefetch inside it would double-resize +
      // double-analyze).
      const shouldPrefetch = photos.length === 0 && newPhotos.length === 1;
      setPhotos((prev) => [...prev, ...newPhotos].slice(0, MAX));
      if (shouldPrefetch) {
        const uri = newPhotos[0]?.uri;
        if (uri) kickSinglePhotoPrefetch(uri, analyze);
      }
    } catch (err) {
      log.error(err, { context: 'AddPieceStep1.pick_from_gallery_failed' });
      Alert.alert(tr('addpiece.step1.galleryError.title'), tr('addpiece.step1.galleryError.body'));
    }
  }, [analyze, photos.length]);

  // Hero card → LiveScan (continuous detection + per-garment review card).
  const openLiveScan = useCallback(() => {
    hapticLight();
    nav.navigate('LiveScan');
  }, [nav]);

  // Camera SourcePill → single-shot system camera, distinct from LiveScan.
  // Wave R-D Bug A — device-test session 2026-05-15 surfaced that the Camera
  // tile routed to LiveScan (rapid-fire continuous mode), so users who wanted
  // to "just take one photo" got the auto-detect filmstrip UI instead of a
  // simple snap-review-save. This handler hands off to the platform camera
  // (which gives the user the native Retake/Use-Photo review), then routes
  // straight into Step 2 with a single-item batch so the existing analyze +
  // upload + BG-removal pipeline runs identically to a one-photo gallery
  // pick. The Step 1 grid is intentionally skipped — the user explicitly
  // wants a one-shot, no-staging flow on this entry mode.
  const openCameraSingle = useCallback(async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          tr('addpiece.step1.cameraPermission.title'),
          tr('addpiece.step1.cameraPermission.body'),
        );
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.85,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset || !user) return;
      hapticLight();
      // Wave S-C.1 — camera-single-shot routes through batchPipeline below
      // (single-item batch), so the batch pipeline starts the same
      // resize+upload+analyze work the prefetch would duplicate. We DO NOT
      // call kickSinglePhotoPrefetch here — Step 2 takes the batch branch
      // for this entry and awaits the batch item, never reading the
      // prefetch registry. Adding a parallel prefetch would burn a second
      // analyze quota slot for no UX gain.
      const batchId = startBatch({
        uris: [asset.uri],
        userId: user.id,
        source: 'add_photo',
        analyzeFn: analyze,
      });
      nav.navigate('AddPieceStep2', {
        photoUri: asset.uri,
        allUris: [asset.uri],
        source: 'add_photo',
        batch: { batchId, index: 0, total: 1 },
      });
    } catch (err) {
      log.error(err, { context: 'AddPieceStep1.open_camera_single_failed' });
      Alert.alert(
        tr('addpiece.step1.cameraError.title'),
        tr('addpiece.step1.cameraError.body'),
      );
    }
  }, [analyze, nav, user]);

  // M19 — third entry mode. Visual Search routes to its own screen rather than
  // staging a photo into the grid: the user supplies a reference image (camera
  // or gallery) and the screen surfaces wardrobe + online matches via the
  // `visual_search` edge function. Tap a wardrobe match → GarmentDetail; tap
  // an online match → "import coming soon" alert (M20 owns the real import).
  const openVisualSearch = useCallback(() => {
    hapticLight();
    nav.navigate('VisualSearch');
  }, [nav]);

  // M20 — fourth entry mode. Import from link routes to a paste-URL
  // surface that calls `import_garments_from_links` and lands the
  // scraped garment in the wardrobe with default category/color the
  // user can refine from GarmentDetail.
  const openImportFromLink = useCallback(() => {
    hapticLight();
    nav.navigate('ImportFromLink');
  }, [nav]);

  const removePhoto = (id: number) => {
    hapticLight();
    setPhotos((prev) => prev.filter((p) => p.id !== id));
  };

  // Continue → start the batch pipeline and forward to Step 2 for the first
  // item. The pipeline kicks off resize+upload+analyze for the first
  // MAX_PARALLEL items immediately so subsequent reviews are typically
  // ready by the time the user lands on Step 2 for them.
  //
  // Single-photo case (photos.length === 1) still uses the batch path —
  // tagging `source: 'add_photo'` keeps the existing render-queue mapping;
  // the user-visible UX is identical to the legacy single-photo flow because
  // there's no "next item" hop after Save.
  //
  // LiveScan continues to bypass this and post directly to Step 2 with no
  // batch param, preserving its single-photo deep-link behaviour.
  const onContinue = () => {
    const first = photos[0];
    if (!first) return;
    if (!user) {
      // Defensive guard — every signed-in path lands here, but a token rotation
      // mid-flow could leave user null momentarily. Step 2 has its own
      // not-signed-in error path; failing here would lose the user's
      // staging work.
      return;
    }
    hapticLight();
    const allUris = photos.map((p) => p.uri);
    const source = allUris.length > 1 ? 'batch_add' : 'add_photo';
    const batchId = startBatch({
      uris: allUris,
      userId: user.id,
      source,
      analyzeFn: analyze,
    });
    nav.navigate('AddPieceStep2', {
      photoUri: first.uri,
      allUris,
      source,
      batch: { batchId, index: 0, total: allUris.length },
    });
  };

  const ready = photos.length;
  const pct = (photos.length / MAX) * 100;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={['top']}>
      {/* ============ HEADER ============ */}
      <View style={[s.header, { borderBottomColor: t.border }]}>
        <IconBtn variant="ghost" onPress={() => nav.goBack()} ariaLabel={tr('common.back')}>
          <BackIcon color={t.fg} />
        </IconBtn>
        <View style={{ flex: 1 }}>
          <Eyebrow style={{ marginBottom: 2 }}>{tr('addpiece.step1.headerEyebrow')}</Eyebrow>
          <PageTitle size={26}>{tr('addpiece.step1.headerTitle')}</PageTitle>
        </View>
        <Pressable onPress={() => nav.goBack()} style={{ paddingHorizontal: 6, paddingVertical: 8 }}>
          <Text style={{ fontFamily: fonts.uiMed, fontSize: 13, color: t.fg2, fontWeight: '500' }}>{tr('common.cancel')}</Text>
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
            <Eyebrow>{tr('addpiece.step1.hero.eyebrow')}</Eyebrow>
            <Text style={{ fontFamily: fonts.uiSemi, fontSize: 16, fontWeight: '600', letterSpacing: -0.32, color: t.fg, marginTop: 2 }}>
              {tr('addpiece.step1.hero.title')}
            </Text>
            <Text style={{ fontFamily: fonts.ui, fontSize: 12, color: t.fg2, lineHeight: 17 }}>
              {tr('addpiece.step1.hero.body')}
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
        {/* M20 Codex round 1 P2.6 — 2x2 grid. Camera + Gallery on row 1;
            Visual Search + Import-from-link on row 2 as half-width pills
            so all four entries stay equally weighted and the section
            doesn't outgrow the viewport on narrow devices. Supersedes
            the M19 stacked layout (which left two full-width entries
            below the Camera/Gallery row). */}
        <View>
          <Eyebrow style={{ marginBottom: 8 }}>{tr('addpiece.step1.sourceEyebrow')}</Eyebrow>
          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <SourcePill
                label={tr('addpiece.step1.source.camera.label')}
                sub={tr('addpiece.step1.source.camera.sub')}
                icon={<CameraIcon color={t.accent} />}
                onPress={openCameraSingle}
              />
              <SourcePill
                label={tr('addpiece.step1.source.gallery.label')}
                sub={tr('addpiece.step1.source.gallery.sub')}
                icon={<ImageIcon color={t.accent} />}
                onPress={pickFromGallery}
              />
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <SourcePill
                label={tr('addpiece.step1.source.visualSearch.label')}
                sub={tr('addpiece.step1.source.visualSearch.sub')}
                icon={<SearchIcon color={t.accent} />}
                onPress={openVisualSearch}
              />
              <SourcePill
                label={tr('addpiece.step1.source.importLink.label')}
                sub={tr('addpiece.step1.source.importLink.sub')}
                icon={<LinkIcon color={t.accent} />}
                onPress={openImportFromLink}
              />
            </View>
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
              {tr('addpiece.step1.counterEyebrow')}
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
                accessibilityLabel={tr('addpiece.step1.removePhoto')}
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
              accessibilityLabel={tr('addpiece.step1.addPhoto')}
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
                {tr('addpiece.step1.addLabel')}
              </Text>
            </Pressable>
          ) : null}
        </View>

        <Caption style={{ textAlign: 'center', opacity: 0.7 }}>
          {tr('addpiece.step1.maxCaption', { max: MAX })}
        </Caption>
      </ScrollView>

      {/* ============ STICKY CTA ============ */}
      <View style={[s.stickyBar, { borderTopColor: t.border, backgroundColor: t.bg }]}>
        <View style={{ flex: 1 }}>
          <Eyebrow style={{ marginBottom: 2 }}>{tr('addpiece.step1.readyEyebrow', { count: ready })}</Eyebrow>
          <Text style={{ fontFamily: fonts.ui, fontSize: 11, color: t.fg2, letterSpacing: -0.11 }}>
            {tr('addpiece.step1.readyCaption')}
          </Text>
        </View>
        <Button
          label={ready > 1 ? tr('addpiece.step1.cta.first') : tr('addpiece.step1.cta.single')}
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
