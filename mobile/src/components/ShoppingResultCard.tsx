// M23 — Shopping Chat result card primitive.
//
// Renders one product suggestion returned by the `shopping_chat` edge
// function (or, today, would be returned — the deployed function streams
// text-only output and the typed envelope is forward-compat). Surfaces
// inside StyleChatScreen beneath the assistant text bubble when the
// message's `stylistMeta.shopping_results` is non-empty.
//
// Layout (compact horizontal row, 64x64 image, mid-column title +
// merchant + price, trailing Open button):
//
//   ┌────────┬──────────────────────────┬────────┐
//   │ image  │ Title                    │ Open ▶ │
//   │ 64×64  │ Merchant · Reason        │        │
//   │        │ 199 SEK                  │        │
//   └────────┴──────────────────────────┴────────┘
//
// Open button delegates to the parent via `onOpen(card.product_url)` so
// the URL allowlist enforcement (https-only, M19 precedent) lives at the
// surface boundary instead of hidden inside this primitive. The card
// itself trusts `card.product_url` because `parseShoppingResultCards`
// (styleChatContract.ts) already rejected non-https values during
// envelope normalization.

import React, { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { useTokens } from '../theme/ThemeProvider';
import { fonts, radii } from '../theme/tokens';
import { Caption } from './Caption';
import { t as tr } from '../lib/i18n';
import { Sentry } from '../lib/sentry';
import type { ShoppingResultCard as ShoppingResultCardType } from '../lib/styleChatContract';

const IMAGE_SIZE = 64;

export function ShoppingResultCard({
  card,
  onOpen,
}: {
  card: ShoppingResultCardType;
  onOpen: (url: string) => void;
}) {
  const t = useTokens();

  // Track image-load failure so we can swap to the same neutral placeholder
  // we render when `image_url` is null. CDN 404s are common and low-signal,
  // so we leave a Sentry breadcrumb (NOT a captureException). State resets
  // when `card.id` changes so a list-item recycle doesn't preserve the
  // broken flag for a different card.
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => {
    setImageFailed(false);
  }, [card.id]);

  const priceLabel =
    card.price && Number.isFinite(card.price.amount) && card.price.currency
      ? tr('shoppingChat.cardPriceTemplate', {
          amount: card.price.amount,
          currency: card.price.currency,
        })
      : null;

  const subtitleParts: string[] = [];
  if (card.merchant) subtitleParts.push(card.merchant);
  if (card.reason) subtitleParts.push(card.reason);
  const subtitle = subtitleParts.join(' · ') || null;

  const handleOpen = () => onOpen(card.product_url);

  return (
    <View
      style={[
        s.row,
        {
          backgroundColor: t.card,
          borderColor: t.border,
        },
      ]}>
      {/* Image column. Fall back to a neutral placeholder block when the
          server omitted an image so the row layout stays stable. */}
      <View
        style={[
          s.imageBox,
          { backgroundColor: t.bg2, borderColor: t.border },
        ]}>
        {card.image_url && !imageFailed ? (
          <Image
            source={{ uri: card.image_url }}
            style={s.image}
            resizeMode="cover"
            accessibilityIgnoresInvertColors
            onError={() => {
              setImageFailed(true);
              Sentry.addBreadcrumb({
                category: 'shopping_card.image',
                level: 'info',
                message: 'product image failed to load',
                data: { card_id: card.id, image_url: card.image_url },
              });
            }}
          />
        ) : null}
      </View>

      {/* Mid column — title, merchant/reason, price. */}
      <View style={s.midColumn}>
        <Text
          numberOfLines={2}
          style={{
            fontFamily: fonts.uiSemi,
            fontSize: 13,
            lineHeight: 17,
            color: t.fg,
            letterSpacing: -0.13,
          }}>
          {card.title}
        </Text>
        {subtitle ? (
          <Caption numberOfLines={2} style={{ marginTop: 2 }}>
            {subtitle}
          </Caption>
        ) : null}
        {priceLabel ? (
          <Text
            style={{
              fontFamily: fonts.uiMed,
              fontSize: 12,
              lineHeight: 15,
              color: t.fg2,
              marginTop: 4,
              letterSpacing: -0.1,
            }}>
            {priceLabel}
          </Text>
        ) : null}
      </View>

      {/* Open button — accent-fill pill. The parent enforces the URL
          allowlist before invoking Linking.openURL. */}
      <Pressable
        onPress={handleOpen}
        accessibilityRole="button"
        accessibilityLabel={tr('shoppingChat.cardOpen')}
        accessibilityHint={tr('shoppingChat.cardOpenHint')}
        // The pill is 32pt tall; iOS HIG mandates ≥44pt hit area. Expand the
        // pressable region without enlarging the visual control. 6+32+6=44.
        hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
        style={({ pressed }) => [
          s.openBtn,
          {
            backgroundColor: t.accent,
            opacity: pressed ? 0.85 : 1,
          },
        ]}>
        <Text
          style={{
            fontFamily: fonts.uiSemi,
            fontSize: 12,
            color: t.accentFg,
            letterSpacing: -0.1,
          }}>
          {tr('shoppingChat.cardOpen')}
        </Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  imageBox: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
    borderRadius: radii.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  midColumn: {
    flex: 1,
    minWidth: 0,
  },
  openBtn: {
    height: 32,
    paddingHorizontal: 14,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
