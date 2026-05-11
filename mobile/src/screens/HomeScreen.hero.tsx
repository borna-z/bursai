// HomeScreen — today's look hero card (N13 split).
//
// Encapsulates the Card<hero> rendering, including the 4-tile garment row
// (OutfitThumbRow + OutfitThumb), worn-today CTA + restyle + view buttons,
// the loading skeleton, and the empty state. State derivation lives in the
// parent (HomeScreen); this file is presentational.

import React from 'react';
import { Image, Pressable, Text, View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { useTokens } from '../theme/ThemeProvider';
import { fonts } from '../theme/tokens';
import { Eyebrow } from '../components/Eyebrow';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { PlanCardSkeleton } from '../components/skeletons';
import { ChevronIcon } from '../components/icons';
import { useGarmentImage } from '../hooks/useSignedUrl';
import { t as tr } from '../lib/i18n';
import { outfitDisplayName, outfitGradientHue } from '../lib/outfitDisplay';
import type { OutfitItemWithGarment, OutfitWithItems } from '../types/outfit';

export type TodaysLookHeroProps = {
  heroRef: React.MutableRefObject<View | null>;
  heroLoading: boolean;
  todayOutfit: OutfitWithItems | null;
  wornToday: boolean;
  markWornPending: boolean;
  onWearToday: () => void;
  onRestyle: () => void;
  onView: () => void;
  onEmptyCta: () => void;
};

export function TodaysLookHero({
  heroRef,
  heroLoading,
  todayOutfit,
  wornToday,
  markWornPending,
  onWearToday,
  onRestyle,
  onView,
  onEmptyCta,
}: TodaysLookHeroProps) {
  const t = useTokens();
  return (
    // Wrapped in a measurable View so M27's first-run coach overlay can
    // highlight the hero card via measureInWindow. The wrapper is a no-op
    // visually (no padding / borders) — it exists purely as a ref target.
    <View ref={heroRef} collapsable={false}>
      <Card hero padding={18}>
        {heroLoading ? (
          <PlanCardSkeleton />
        ) : todayOutfit ? (
          <>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Eyebrow style={{ marginBottom: 3 }}>{tr('home.todaysLook.eyebrow')}</Eyebrow>
                <Text
                  numberOfLines={1}
                  style={{ fontFamily: fonts.displayMedium, fontStyle: 'italic', fontSize: 22, lineHeight: 24, fontWeight: '500', color: t.fg, letterSpacing: -0.22 }}>
                  {outfitDisplayName(todayOutfit)}
                </Text>
              </View>
              <Pressable onPress={onView} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={{ color: t.accent, fontSize: 12, fontWeight: '500', fontFamily: fonts.uiMed }}>{tr('home.todaysLook.view')}</Text>
                <ChevronIcon color={t.accent} />
              </Pressable>
            </View>
            <OutfitThumbRow outfit={todayOutfit} />
            {todayOutfit.explanation ? (
              <Text style={{ fontSize: 12.5, color: t.fg2, marginVertical: 14, lineHeight: 18, fontFamily: fonts.ui }} numberOfLines={3}>
                {todayOutfit.explanation}
              </Text>
            ) : (
              <View style={{ height: 14 }} />
            )}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button
                label={wornToday ? tr('home.todaysLook.wornToday') : tr('home.todaysLook.wearThis')}
                onPress={onWearToday}
                block
                style={{ flex: 1 }}
                disabled={wornToday || markWornPending}
              />
              <Button label={tr('home.todaysLook.restyle')} variant="outline" onPress={onRestyle} />
              <Button label={tr('home.todaysLook.view')} variant="quiet" onPress={onView} />
            </View>
          </>
        ) : (
          <>
            <Eyebrow style={{ marginBottom: 6 }}>{tr('home.todaysLook.eyebrow')}</Eyebrow>
            <Text
              style={{
                fontFamily: fonts.displayMedium,
                fontStyle: 'italic',
                fontSize: 22,
                lineHeight: 26,
                fontWeight: '500',
                color: t.fg,
                letterSpacing: -0.22,
                marginBottom: 6,
              }}>
              {tr('home.todaysLook.empty.title')}
            </Text>
            <Text
              style={{
                fontSize: 12.5,
                color: t.fg2,
                marginBottom: 14,
                lineHeight: 18,
                fontFamily: fonts.ui,
              }}>
              {tr('home.todaysLook.empty.body')}
            </Text>
            <Button label={tr('home.todaysLook.empty.cta')} onPress={onEmptyCta} block />
          </>
        )}
      </Card>
    </View>
  );
}

// Builds the 4-tile garment row inside Today's Look. Up to 4 of the
// outfit_items render as signed-URL <Image>s; remaining slots fall through
// to gradient placeholders so the row's visual rhythm holds even on a
// 2-piece outfit.
function OutfitThumbRow({ outfit }: { outfit: OutfitWithItems }) {
  const items = (outfit.outfit_items ?? []).slice(0, 4);
  const fillerCount = Math.max(0, 4 - items.length);
  const fallbackHue = outfitGradientHue(outfit.id);
  return (
    <View style={s.outfitRow}>
      {items.map((item) => (
        <OutfitThumb key={item.id} item={item} fallbackHue={fallbackHue} />
      ))}
      {Array.from({ length: fillerCount }).map((_, i) => (
        <OutfitThumb key={`filler-${i}`} item={null} fallbackHue={fallbackHue} />
      ))}
    </View>
  );
}

function OutfitThumb({
  item,
  fallbackHue,
}: {
  item: OutfitItemWithGarment | null;
  fallbackHue: number;
}) {
  const t = useTokens();
  const garment = item?.garment ?? null;
  const imagePath =
    garment?.rendered_image_path ??
    garment?.original_image_path ??
    garment?.image_path ??
    null;
  const { uri: imageUri, onError: onImageError } = useGarmentImage(imagePath);
  const showImage = imageUri != null;
  // Truthy fallback (`||` not `??`) — legacy outfit_items rows have `slot`
  // as the empty string `''` rather than null, and `??` would still pick
  // that empty value over the garment's category. Codex P2 on PR #738.
  const label = (item?.slot || garment?.category || '').toString().toUpperCase();
  const hue = garment?.id ? outfitGradientHue(garment.id) : fallbackHue;

  return (
    <View style={[s.thumb, { borderColor: t.border, backgroundColor: t.bg2 }]}>
      <LinearGradient
        colors={[`hsl(${hue}, 38%, 78%)`, `hsl(${(hue + 30) % 360}, 30%, 62%)`]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />
      {showImage ? (
        <Image
          source={{ uri: imageUri }}
          onError={onImageError}
          style={{ width: '100%', height: '100%' }}
          resizeMode="cover"
        />
      ) : null}
      {label && !showImage ? (
        <Text style={[s.thumbLabel, { color: t.scrimFg }]}>{label}</Text>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  outfitRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 0,
  },
  thumb: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbLabel: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    fontSize: 9,
    fontFamily: fonts.uiSemi,
    letterSpacing: 1.1,
    // `color` set inline via `t.scrimFg` — the foreground token designed
    // to be readable on top of dark/scrim surfaces (here, the colored
    // gradient backdrop). N8 a11y sweep replaced a hardcoded '#fff'.
    opacity: 0.85,
    textTransform: 'uppercase',
  },
});
