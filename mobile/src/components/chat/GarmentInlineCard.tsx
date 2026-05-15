// GarmentInlineCard — pill-shaped chip rendered inline below assistant
// chat bubbles when the stylist references a specific garment from the
// user's wardrobe (either via a [[garment:uuid|label]] token in prose,
// or via the envelope's `garment_mentions[]` field).
//
// Mirrors web's `src/components/chat/GarmentInlineCard.tsx`. The pill:
//   • shows a 32×32 round thumbnail on the left,
//   • the garment title on the right (clipped at ~140 px),
//   • is pressable — tapping navigates to the GarmentDetail screen so
//     the user can open the piece and edit it (the user's explicit
//     ask: "the context window where you can open and edit").
//
// Render rules match web: empty title → render nothing; missing image
// path → the shared GarmentImageTile fallback (Tshirt icon over neutral
// bg) handles the gap. The card is layout-stable: a fixed 36 px height
// keeps the wrap rhythm sane in a multi-mention bubble.

import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { useTokens } from '../../theme/ThemeProvider';
import { fonts, radii } from '../../theme/tokens';
import { GarmentImageTile } from '../GarmentImageTile';
import type { GarmentBasic } from '../../hooks/useGarmentsByIds';

export interface GarmentInlineCardProps {
  garment: GarmentBasic;
  onPress: (garmentId: string) => void;
  /** Optional override label — used when the [[garment:uuid|label]]
   *  token supplies a label distinct from the row's title (rare; lets
   *  the stylist describe the piece in its own words). */
  label?: string;
}

export function GarmentInlineCard({ garment, onPress, label }: GarmentInlineCardProps) {
  const t = useTokens();
  const title = label?.trim() || garment.title?.trim() || '';
  if (!title) return null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={() => onPress(garment.id)}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingLeft: 4,
        paddingRight: 12,
        paddingVertical: 4,
        backgroundColor: t.bg2,
        borderRadius: radii.xl,
        borderWidth: 1,
        borderColor: t.border,
        opacity: pressed ? 0.7 : 1,
        maxWidth: 200,
      })}>
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          overflow: 'hidden',
          backgroundColor: t.bg,
        }}>
        <GarmentImageTile garment={garment} iconSize={14} />
      </View>
      <Text
        numberOfLines={1}
        style={{
          fontFamily: fonts.uiMed,
          fontSize: 12.5,
          color: t.fg,
          letterSpacing: -0.1,
          flexShrink: 1,
        }}>
        {title}
      </Text>
    </Pressable>
  );
}
