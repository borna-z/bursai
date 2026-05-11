// HomeScreen — today's look hero card (N13 split).
//
// Encapsulates the Card<hero> rendering, including the 4-tile garment row
// (OutfitThumbRow + OutfitThumb), worn-today CTA + restyle + view buttons,
// the loading skeleton, and the empty state. State derivation lives in the
// parent (HomeScreen); this file is presentational.

import React from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';

import { useTokens } from '../theme/ThemeProvider';
import { fonts } from '../theme/tokens';
import { Eyebrow } from '../components/Eyebrow';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { GarmentImageTile } from '../components/GarmentImageTile';
import { PlanCardSkeleton } from '../components/skeletons';
import { ChevronIcon } from '../components/icons';
import { t as tr } from '../lib/i18n';
import { outfitDisplayName } from '../lib/outfitDisplay';
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
// outfit_items render via the shared GarmentImageTile (neutral bg + signed-URL
// photo + faded Tshirt icon fallback). Remaining slots get an empty tile so
// the row's visual rhythm holds even on a 2-piece outfit.
function OutfitThumbRow({ outfit }: { outfit: OutfitWithItems }) {
  const items = (outfit.outfit_items ?? []).slice(0, 4);
  const fillerCount = Math.max(0, 4 - items.length);
  return (
    <View style={s.outfitRow}>
      {items.map((item) => (
        <OutfitThumb key={item.id} item={item} />
      ))}
      {Array.from({ length: fillerCount }).map((_, i) => (
        <OutfitThumb key={`filler-${i}`} item={null} />
      ))}
    </View>
  );
}

function OutfitThumb({ item }: { item: OutfitItemWithGarment | null }) {
  const t = useTokens();
  const garment = item?.garment ?? null;

  return (
    <View style={[s.thumb, { borderColor: t.border }]}>
      <GarmentImageTile garment={garment} iconSize={22} />
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
  },
});
