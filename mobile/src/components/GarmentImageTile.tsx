// GarmentImageTile — canonical garment photo tile.
//
// Matches web's `WardrobeGarmentImage` (src/components/wardrobe/GarmentCardSystem.tsx)
// recipe exactly: neutral `bg2` background, signed-URL <Image> on top, faded
// Tshirt icon as the fallback when no path resolves. The colored hsl-gradient
// placeholder that used to back every garment thumb is gone — colored cards
// were the most-reported "looks unfinished" defect during dogfooding.
//
// Caller responsibility: own the outer wrapper (borderRadius, borderWidth,
// aspectRatio, size). This component fills its parent (`flex: 1` by default)
// so a caller can just drop it into a sized View. Pass `style` to override.
//
// Image resolution chain lives in `lib/garmentImage.ts` — same priority as web
// (`render_status === 'ready'` ? rendered : original ?? image_path).

import React from 'react';
import { Image, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTokens } from '../theme/ThemeProvider';
import { useGarmentImage } from '../hooks/useSignedUrl';
import { getPreferredGarmentImagePath, type GarmentImageLike } from '../lib/garmentImage';
import { TshirtIcon } from './icons';

export type GarmentImageTileProps = {
  /** Garment row shape. Pass `null` for filler/empty slots — the tile still
   *  renders the neutral background + Tshirt icon so the row's rhythm holds. */
  garment: GarmentImageLike | null;
  /** Override the default `flex: 1` fill — pass width/height/aspectRatio here
   *  if the tile needs explicit sizing. */
  style?: StyleProp<ViewStyle>;
  /** Tshirt icon size in px. Defaults to 26 — readable at the ~64–120 px tile
   *  sizes used across the app. Drop to ~18 for compact mosaic cells. */
  iconSize?: number;
};

export function GarmentImageTile({ garment, style, iconSize = 26 }: GarmentImageTileProps) {
  const t = useTokens();
  const imagePath = garment ? getPreferredGarmentImagePath(garment) ?? null : null;
  const { uri, onError } = useGarmentImage(imagePath);
  return (
    <View
      style={[
        {
          flex: 1,
          overflow: 'hidden',
          backgroundColor: t.bg2,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}>
      {uri ? (
        <Image
          source={{ uri }}
          // `useGarmentImage` logs a Sentry breadcrumb + busts the signed-URL
          // cache once before giving up; after that `uri` settles to null and
          // the Tshirt fallback takes over.
          onError={onError}
          style={{ width: '100%', height: '100%' }}
          resizeMode="cover"
        />
      ) : (
        // Mirrors web's `text-muted-foreground/35` — subtle, recognisably a
        // garment slot, not loud. Wrapped in an opaque View because the
        // TshirtIcon Svg's `opacity` prop isn't honoured on Android.
        <View style={{ opacity: 0.35 }}>
          <TshirtIcon size={iconSize} color={t.fg2} />
        </View>
      )}
    </View>
  );
}
