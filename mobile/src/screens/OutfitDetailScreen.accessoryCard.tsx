// OutfitDetailScreen — AccessoryCard tile (N13 split).
//
// Rendered inside the accessories collapsible section. Shows a 110×150 neutral
// thumbnail (signed-URL photo or faded Tshirt fallback — same recipe as the
// shared GarmentImageTile), title, subtitle (eyebrow-style fallback OR AI
// reason narrative), and an Add button.

import React from 'react';
import { Image, Text, View } from 'react-native';

import { useTokens } from '../theme/ThemeProvider';
import { fonts, radii } from '../theme/tokens';
import { Button } from '../components/Button';
import { TshirtIcon } from '../components/icons';
import { useGarmentImage } from '../hooks/useSignedUrl';
import { t as tr } from '../lib/i18n';

export function AccessoryCard({
  title,
  subtitle,
  subtitleUppercase = true,
  imagePath,
  added,
  adding,
  onAdd,
}: {
  title: string;
  subtitle: string;
  /** True for the eyebrow-style color · category fallback (uppercase,
   *  tracked) — false for the AI's `reason` narrative (sentence case,
   *  natural reading). M17 Codex P1.1 on PR #743. */
  subtitleUppercase?: boolean;
  imagePath: string | null;
  added: boolean;
  adding: boolean;
  onAdd: () => void;
}) {
  const t = useTokens();
  const { uri: imageUri, onError: onImageError } = useGarmentImage(imagePath);
  const showImage = imageUri != null;

  return (
    <View
      style={{
        width: 150,
        borderWidth: 1,
        borderColor: t.border,
        borderRadius: radii.lg,
        backgroundColor: t.card,
        overflow: 'hidden',
      }}>
      <View
        style={{
          width: '100%',
          height: 110,
          backgroundColor: t.bg2,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}>
        {showImage ? (
          <Image
            source={{ uri: imageUri }}
            onError={onImageError}
            style={{ width: '100%', height: '100%' }}
            resizeMode="cover"
          />
        ) : (
          <View style={{ opacity: 0.35 }}>
            <TshirtIcon size={28} color={t.fg2} />
          </View>
        )}
      </View>
      <View style={{ padding: 10, gap: 4 }}>
        <Text
          numberOfLines={1}
          style={{
            fontFamily: fonts.uiSemi,
            fontSize: 12.5,
            color: t.fg,
            letterSpacing: -0.13,
          }}>
          {title}
        </Text>
        {subtitle ? (
          <Text
            numberOfLines={subtitleUppercase ? 1 : 3}
            style={
              subtitleUppercase
                ? {
                    fontFamily: fonts.uiSemi,
                    fontSize: 9.5,
                    color: t.fg2,
                    letterSpacing: 1.4,
                    textTransform: 'uppercase',
                  }
                : {
                    fontFamily: fonts.ui,
                    fontSize: 11,
                    lineHeight: 15,
                    color: t.fg2,
                  }
            }>
            {subtitle}
          </Text>
        ) : null}
        <Button
          label={added ? 'Added' : tr('outfitDetail.accessories.addAction')}
          size="sm"
          variant={added ? 'accent' : 'outline'}
          onPress={onAdd}
          disabled={added || adding}
        />
      </View>
    </View>
  );
}
