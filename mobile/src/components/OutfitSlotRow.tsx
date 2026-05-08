// OutfitSlotRow — one slot in the OutfitDetail slotted layout (M37).
// Mirrors the visual rhythm of web's `src/components/outfit/OutfitDetailSlots.tsx`
// SlotRow: eyebrow + thumb + name/category, with per-slot Swap / Anchor /
// Remove actions revealed under the row. The anchored slot gets a lock pill
// rendered next to the eyebrow so the user always knows which piece carries
// over to the next regeneration.

import React from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { useTokens } from '../theme/ThemeProvider';
import { fonts, radii } from '../theme/tokens';
import { Eyebrow } from './Eyebrow';
import { Button } from './Button';
import { useGarmentImage } from '../hooks/useSignedUrl';
import { outfitGradientHue } from '../lib/outfitDisplay';
import { t as tr } from '../lib/i18n';
import type { OutfitItemWithGarment } from '../types/outfit';

const SLOT_LABEL_KEYS: Record<string, string> = {
  top: 'outfitDetail.slot.top',
  layer: 'outfitDetail.slot.layer',
  bottom: 'outfitDetail.slot.bottom',
  dress: 'outfitDetail.slot.dress',
  shoes: 'outfitDetail.slot.shoes',
  outerwear: 'outfitDetail.slot.outerwear',
  accessory: 'outfitDetail.slot.accessory',
};

function slotLabel(slot: string): string {
  const key = SLOT_LABEL_KEYS[slot];
  if (!key) return slot.toUpperCase();
  const translated = tr(key);
  // Fall back to the raw slot (uppercased) when the translation key is
  // missing — `tr` echoes the key verbatim if unmatched, which would
  // surface "outfitDetail.slot.layer" in the eyebrow.
  return translated && translated !== key ? translated : slot.toUpperCase();
}

export interface OutfitSlotRowProps {
  /** Display slot (top / layer / bottom / dress / shoes / outerwear / accessory). */
  slot: string;
  item: OutfitItemWithGarment;
  /** True when this slot currently holds the outfit's anchor — renders the
   *  lock pill and disables the Anchor action ("locked"). */
  isAnchored: boolean;
  onPress?: () => void;
  onSwap: () => void;
  onAnchor: () => void;
  onRemove: () => void;
  /** Disable the Swap button while a sibling swap is mid-flight, or while the
   *  candidate sheet is opening for another slot. */
  swapDisabled?: boolean;
}

export function OutfitSlotRow({
  slot,
  item,
  isAnchored,
  onPress,
  onSwap,
  onAnchor,
  onRemove,
  swapDisabled,
}: OutfitSlotRowProps) {
  const t = useTokens();
  const garment = item.garment;
  const imagePath =
    garment?.rendered_image_path ?? garment?.original_image_path ?? null;
  const { uri: imageUri, onError: onImageError } = useGarmentImage(imagePath);
  const showImage = imageUri != null;
  const hue = garment?.id
    ? outfitGradientHue(garment.id)
    : outfitGradientHue(item.id);

  const isOrphan = !garment?.id;
  const title = isOrphan
    ? tr('outfitDetail.removedPiece')
    : (garment?.title ?? slot).toString();
  const subtitleParts = [garment?.color_primary, garment?.category].filter(
    Boolean,
  );

  return (
    <View
      style={[
        s.row,
        {
          backgroundColor: t.card,
          borderColor: isAnchored ? t.accent : t.border,
        },
      ]}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${title}, ${slotLabel(slot)}`}
        disabled={!onPress || isOrphan}
        style={({ pressed }) => [
          s.headerRow,
          { opacity: pressed && onPress ? 0.85 : 1 },
        ]}>
        <View style={[s.thumb, { borderColor: t.border }]}>
          <LinearGradient
            colors={[
              `hsl(${hue}, 38%, 78%)`,
              `hsl(${(hue + 30) % 360}, 30%, 62%)`,
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          {showImage ? (
            <Image
              source={{ uri: imageUri }}
              onError={onImageError}
              style={{ width: '100%', height: '100%' }}
              resizeMode="cover"
            />
          ) : null}
        </View>

        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={s.eyebrowRow}>
            <Eyebrow>{slotLabel(slot)}</Eyebrow>
            {isAnchored ? (
              <View
                style={[
                  s.lockPill,
                  { backgroundColor: t.accent, borderColor: t.accent },
                ]}>
                <Text
                  style={{
                    fontFamily: fonts.uiSemi,
                    fontSize: 9,
                    color: t.bg,
                    letterSpacing: 1.2,
                    textTransform: 'uppercase',
                  }}>
                  {tr('anchor.locked.eyebrow')}
                </Text>
              </View>
            ) : null}
          </View>
          <Text
            numberOfLines={1}
            style={{
              fontFamily: fonts.uiSemi,
              fontSize: 13,
              color: t.fg,
              letterSpacing: -0.13,
              marginTop: 2,
            }}>
            {title}
          </Text>
          {subtitleParts.length > 0 ? (
            <Text
              numberOfLines={1}
              style={{
                fontFamily: fonts.uiSemi,
                fontSize: 9.5,
                color: t.fg2,
                letterSpacing: 1.4,
                textTransform: 'uppercase',
                marginTop: 2,
              }}>
              {subtitleParts.join(' · ')}
            </Text>
          ) : null}
        </View>
      </Pressable>

      <View style={s.actionRow}>
        <Button
          label={tr('outfitDetail.slotAction.swap')}
          size="sm"
          variant="outline"
          onPress={onSwap}
          disabled={swapDisabled || isOrphan}
          accessibilityHint="Swap this piece for another from your wardrobe"
        />
        <Button
          label={
            isAnchored
              ? tr('outfitDetail.slotAction.anchored')
              : tr('outfitDetail.slotAction.makeAnchor')
          }
          size="sm"
          variant={isAnchored ? 'accent' : 'quiet'}
          onPress={onAnchor}
          disabled={isOrphan}
          accessibilityHint="Lock this piece across regenerations"
        />
        <Button
          label={tr('outfitDetail.slotAction.remove')}
          size="sm"
          variant="quiet"
          onPress={onRemove}
          accessibilityHint="Remove this piece from the outfit"
        />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: 12,
    gap: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  thumb: {
    width: 64,
    height: 80,
    borderRadius: radii.md,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  lockPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
});
