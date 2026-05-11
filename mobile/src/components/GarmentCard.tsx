// Garment grid card — used in 3-col Wardrobe / Search / TravelMustHaves grids and the
// 2-col similar/outfits tabs in GarmentDetail. Aspect ratio 1 (square) on the photo,
// meta row below.
//
// Data shape change (W2): the card now consumes the real Supabase garment row shape
// directly — title / category / color_primary / wear_count / in_laundry /
// rendered_image_path / original_image_path / created_at. The legacy
// `{ name, sub, hue }` placeholders are gone; mock callers (TravelMustHaves seed
// data, GarmentDetail similar/outfit fixtures) map their fixture into the new shape
// — no compat shim, no two-shape branching.
//
// Photo strategy: render the canonical `GarmentImageTile` — neutral background +
// signed-URL <Image> + faded Tshirt icon fallback. Mirrors web's
// `WardrobeGarmentImage` exactly. The previous hsl-gradient placeholder was
// retired in PR A of the mobile-parity sweep.
//
// Badges:
//   • Wear count (top-right, accent pill) when wear_count > 0
//   • NEW (top-left, accent pill) when created_at is within 7 days
//   • In laundry (bottom-left, neutral pill) when in_laundry
// Only one of NEW / wear-count is shown at a time — wear-count wins, since worn
// items are interesting longer than they're new.

import React from 'react';
import { Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTokens } from '../theme/ThemeProvider';
import { fonts, radii } from '../theme/tokens';
import { GarmentImageTile } from './GarmentImageTile';
import { t as tr } from '../lib/i18n';

export type GarmentCardData = {
  id: string;
  title: string;
  category: string | null;
  color_primary?: string | null;
  wear_count?: number | null;
  in_laundry?: boolean | null;
  rendered_image_path?: string | null;
  original_image_path?: string | null;
  /**
   * N12 — `image_path` is the column the `generate_garment_images` edge
   * function writes for AI-generated catalog images on manual-entry
   * garments. Distinct from the studio render's `rendered_image_path`
   * and the user's original photo `original_image_path`. Resolution
   * priority lives in `lib/garmentImage.ts` (mirrors web).
   */
  image_path?: string | null;
  /** Render state — drives whether the studio image is preferred. */
  render_status?: string | null;
  created_at?: string | null;
};

const NEW_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

function isRecent(createdAt: string | null | undefined): boolean {
  if (!createdAt) return false;
  const ms = new Date(createdAt).getTime();
  if (Number.isNaN(ms)) return false;
  return Date.now() - ms < NEW_WINDOW_MS;
}

// M42 — wrapped in `React.memo` so a parent re-render with stable
// `garment` + `onPress` props doesn't re-render every visible card.
// FlatList recycles items but still re-invokes `renderItem` on parent
// re-renders (filter chip toggles, refetches) — without memo each visible
// row pays the full layout/style cost. Caller responsibility: pass a
// stable `onPress` (use `useCallback` with `id`-keyed parent handler;
// see WardrobeScreen for the pattern).
export const GarmentCard = React.memo(GarmentCardInner);

function GarmentCardInner({
  garment,
  onPress,
  style,
}: {
  garment: GarmentCardData;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTokens();

  const wearCount = garment.wear_count ?? 0;
  const showWear = wearCount > 0;
  const showNew = !showWear && isRecent(garment.created_at);
  const showLaundry = Boolean(garment.in_laundry);

  // Build a locale-aware accessibility label so VoiceOver / TalkBack
  // announce a meaningful description (e.g. "Crew tee, navy Top") instead
  // of the truncated title alone. The four template variants cover the
  // missing-color / missing-category cases without leaving stray commas.
  const a11yColor = (garment.color_primary ?? '').toString().trim();
  const a11yCategory = (garment.category ?? '').toString().trim();
  const a11yLabel = (() => {
    if (a11yColor && a11yCategory) {
      return tr('a11y.garmentCard', {
        name: garment.title,
        color: a11yColor,
        category: a11yCategory,
      });
    }
    if (a11yColor) {
      return tr('a11y.garmentCard.noCategory', {
        name: garment.title,
        color: a11yColor,
      });
    }
    if (a11yCategory) {
      return tr('a11y.garmentCard.noColor', {
        name: garment.title,
        category: a11yCategory,
      });
    }
    return tr('a11y.garmentCard.nameOnly', { name: garment.title });
  })();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      onPress={onPress}
      style={({ pressed }) => [
        {
          borderRadius: radii.lg,
          borderWidth: 1,
          borderColor: t.border,
          backgroundColor: t.bg2,
          overflow: 'hidden',
          transform: pressed ? [{ scale: 0.98 }] : [],
        },
        style,
      ]}>
      {/* Image — square crop top of the card. Neutral background + Tshirt
          icon fallback live in GarmentImageTile; badges layer on top. */}
      <View style={{ aspectRatio: 1, width: '100%', overflow: 'hidden' }}>
        <GarmentImageTile garment={garment} iconSize={32} />

        {/* Top-left badge — NEW (only when wear-count badge isn't competing). */}
        {showNew ? (
          <View style={[s.badge, s.badgeTopLeft, { backgroundColor: t.accent }]}>
            <Text style={[s.badgeText, { color: t.accentFg }]}>New</Text>
          </View>
        ) : null}

        {/* Top-right badge — wear count. */}
        {showWear ? (
          <View
            style={[
              s.badge,
              s.badgeTopRight,
              { backgroundColor: t.card, borderColor: t.border, borderWidth: 1 },
            ]}>
            <Text
              style={{
                fontFamily: fonts.displayMedium,
                fontStyle: 'italic',
                fontSize: 11.5,
                color: t.fg,
                letterSpacing: -0.1,
              }}>
              {wearCount}
            </Text>
            <Text
              style={{
                fontFamily: fonts.uiSemi,
                fontSize: 8,
                color: t.fg2,
                letterSpacing: 1.2,
                textTransform: 'uppercase',
                marginLeft: 3,
              }}>
              wears
            </Text>
          </View>
        ) : null}

        {/* Bottom-left badge — laundry. */}
        {showLaundry ? (
          <View style={[s.badge, s.badgeBottomLeft, { backgroundColor: t.bg, borderColor: t.border, borderWidth: 1 }]}>
            <Text style={[s.badgeText, { color: t.fg2 }]}>{tr('garmentCard.badge.laundry')}</Text>
          </View>
        ) : null}
      </View>

      {/* Meta row — sits below the photo inside the bordered shell. */}
      <View style={{ paddingHorizontal: 10, paddingTop: 8, paddingBottom: 10, gap: 2 }}>
        <Text
          numberOfLines={1}
          style={{
            fontFamily: fonts.uiSemi,
            fontSize: 12.5,
            fontWeight: '600',
            color: t.fg,
            letterSpacing: -0.13,
          }}>
          {garment.title}
        </Text>
        {garment.category ? (
          <Text
            numberOfLines={1}
            style={{
              fontFamily: fonts.uiSemi,
              fontSize: 10,
              color: t.fg2,
              letterSpacing: 1.4,
              textTransform: 'uppercase',
            }}>
            {garment.category}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const s = {
  badge: {
    position: 'absolute' as const,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.pill,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
  },
  badgeTopLeft: { top: 8, left: 8 },
  badgeTopRight: { top: 8, right: 8 },
  badgeBottomLeft: { bottom: 8, left: 8 },
  badgeText: {
    fontFamily: fonts.uiSemi,
    fontSize: 9,
    letterSpacing: 1.2,
    textTransform: 'uppercase' as const,
  },
};
