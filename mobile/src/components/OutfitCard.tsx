// Reusable outfit result card.
// Mirrors design_handoff_burs_rn/source/extra-screens.jsx OutfitCard + styles.css `.outfit-card`.
// Used in StyleChat (inline AI attachments), StyleMe results, MoodFlow result, Outfits list.
//
// Layout: a row of 3-4 thumb tiles, then a meta block with uppercase sub +
// italic Playfair name. Optional action row (Wear this / Save) when handlers
// are passed.
//
// Tile content:
//   • `garments` — array of garment row shapes. Each tile renders via the
//     shared `GarmentImageTile` (neutral bg + signed-URL Image + faded
//     Tshirt icon fallback). This is the preferred shape — pass it whenever
//     the outfit's garments are known.
//   • `hues` — legacy slot-count signal kept so callers without garment data
//     (MoodFlow placeholder, RevealStep onboarding mock, SmartDayBanner) keep
//     rendering. Hue values themselves are ignored as of the mobile parity
//     sweep — only the array length matters; tiles render neutral.
// When both are passed, `garments` wins. Empty `garments` falls back to `hues.length`
// (default 4) neutral tiles so the row's visual rhythm holds.

import React from 'react';
import { Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTokens } from '../theme/ThemeProvider';
import { fonts, radii } from '../theme/tokens';
import { GarmentImageTile } from './GarmentImageTile';
import { t as tr } from '../lib/i18n';
import { Button } from './Button';

export type OutfitCardGarment = {
  id: string;
  rendered_image_path?: string | null;
  original_image_path?: string | null;
  /** AI-generated catalog image for manual-entry garments — written by
   *  `generate_garment_images`. Distinct from the studio render and the
   *  user's original photo; resolution priority lives in
   *  `lib/garmentImage.ts` (mirrors web). */
  image_path?: string | null;
  render_status?: string | null;
};

export type OutfitCardProps = {
  name: string;
  sub: string;
  /** Real garment data — each tile shows the photo via signed-URL lookup,
   *  falling back to the shared neutral + Tshirt-icon placeholder. */
  garments?: OutfitCardGarment[];
  /** Legacy tile-count signal (0-359 values are no longer rendered as
   *  gradients — only `.length` is read). Used by callers that don't have
   *  garment data yet. */
  hues?: number[];
  onUse?: () => void;
  onSave?: () => void;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

// M42 — wrapped in `React.memo` for the same reason as GarmentCard:
// FlatList re-invokes `renderItem` on every parent re-render. Default
// shallow compare is correct here — `garments` and `hues` are arrays
// derived from server data and remain referentially stable across
// renders unless the underlying outfit changes. Callers passing inline
// arrays (e.g. `hues={[32, 28, 200, 18]}`) will defeat the memo; the
// default param above keeps the OutfitsScreen path stable.
export const OutfitCard = React.memo(OutfitCardInner);

function OutfitCardInner({
  name,
  sub,
  garments,
  hues = [0, 0, 0, 0],
  onUse,
  onSave,
  onPress,
  style,
}: OutfitCardProps) {
  const t = useTokens();
  const showActions = Boolean(onUse || onSave);
  const useGarments = garments && garments.length > 0;
  // Layout: 4 garments render as a 2×2 square grid (the canonical outfit
  // composition — top, bottom, layer, footwear — per the G6 acceptance
  // gate and the web reference at `src/components/outfits/OutfitComposition.tsx`).
  // 1-3 garments fall back to a single tall row of N square tiles since a
  // partial 2×2 would leave dead space. The hues-fallback path keeps the
  // single-row layout unchanged so existing callers don't shift visually.
  const tileCount = useGarments ? garments!.length : hues.length;
  const isGrid = useGarments && garments!.length === 4;
  // aspectRatio: row layout is N tiles wide × 1 tall (each tile square).
  // 2×2 is 2 tiles wide × 2 tiles tall, so the wrapper is square (ratio 1).
  const wrapperAspect = isGrid ? 1 : tileCount;

  const card = (
    <View
      style={[
        {
          borderWidth: 1,
          borderColor: t.border,
          backgroundColor: t.card,
          borderRadius: radii.xl,
          overflow: 'hidden',
        },
        style,
      ]}>
      {/* Top tile area — single row OR 2×2 grid depending on garment count */}
      {isGrid ? (
        // 2×2 grid via two stacked rows. flexWrap on a flex-row would also
        // work but rows give us deterministic row sizing without relying on
        // tile width to wrap correctly under different parent widths.
        <View style={{ aspectRatio: wrapperAspect, flexDirection: 'column' }}>
          {[0, 2].map((rowStart) => (
            <View key={`row-${rowStart}`} style={{ flex: 1, flexDirection: 'row' }}>
              {garments!.slice(rowStart, rowStart + 2).map((g, i) => (
                <GarmentImageTile key={g.id || `slot-${rowStart + i}`} garment={g} />
              ))}
            </View>
          ))}
        </View>
      ) : (
        <View
          style={{ flexDirection: 'row', aspectRatio: wrapperAspect, gap: 0 }}>
          {useGarments
            ? garments!.map((g, i) => (
                <GarmentImageTile key={g.id || `slot-${i}`} garment={g} />
              ))
            : hues.map((_, i) => (
                <GarmentImageTile key={`empty-${i}`} garment={null} />
              ))}
        </View>
      )}

      {/* Meta */}
      <View style={{ padding: 14, gap: 4 }}>
        <Text
          style={{
            fontFamily: fonts.uiSemi,
            fontSize: 10,
            letterSpacing: 1.8,
            color: t.fg2,
            textTransform: 'uppercase',
          }}>
          {sub}
        </Text>
        <Text
          style={{
            fontFamily: fonts.displayMedium,
            fontStyle: 'italic',
            fontWeight: '500',
            fontSize: 18,
            lineHeight: 22,
            letterSpacing: -0.18,
            color: t.fg,
          }}>
          {name}
        </Text>
        {showActions ? (
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
            {onUse ? <Button label="Wear this" size="sm" onPress={onUse} block style={{ flex: 1 }} /> : null}
            {onSave ? <Button label="Save" size="sm" variant="outline" onPress={onSave} /> : null}
          </View>
        ) : null}
      </View>
    </View>
  );

  if (onPress && !showActions) {
    // Synthesize a meaningful a11y label so VoiceOver/TalkBack announce
    // the outfit's identity instead of just "button". Falls back to the
    // bare name when piece count is unknown (legacy hues-only callers).
    const a11yPieces = useGarments ? garments!.length : 0;
    const a11yLabel =
      a11yPieces > 0
        ? tr('a11y.outfitCard', { name, pieceCount: a11yPieces })
        : tr('a11y.outfitCard.nameOnly', { name });
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={a11yLabel}
        style={({ pressed }) => [{ transform: pressed ? [{ scale: 0.98 }] : [] }]}>
        {card}
      </Pressable>
    );
  }
  return card;
}
