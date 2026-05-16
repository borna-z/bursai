// Results section for VisualSearchScreen — extracted in Phase 3.
//
// Owns the two horizontal-scroll rows:
//   • Wardrobe matches → GarmentCard tiles (hydrated via useGarment).
//   • Web matches → product cards with image + title + price + merchant.
//
// Web-match tap launches an alert + best-effort https-only Linking
// open. The wardrobe-match tap calls back to the orchestrator so the
// orchestrator stays the sole owner of navigation. The URL parsing /
// alerting / Linking call all stay co-located here because they're pure
// child concerns — keeping `useNavigation` and `useTranslation()` calls
// scoped to where the strings render (Phase 3 modularization risk #3).

import React from 'react';
import { Alert, FlatList, Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { useTokens } from '../../theme/ThemeProvider';
import { fonts, radii } from '../../theme/tokens';
import { Caption } from '../../components/Caption';
import { Eyebrow } from '../../components/Eyebrow';
import { GarmentCard } from '../../components/GarmentCard';
import { useGarment } from '../../hooks/useGarments';
import type {
  VisualSearchResult,
  VisualSearchWardrobeMatch,
  VisualSearchWebMatch,
} from '../../hooks/useVisualSearch';
import { hapticLight } from '../../lib/haptics';
import { t as tr } from '../../lib/i18n';

export interface VisualSearchResultsProps {
  result: VisualSearchResult;
  // Orchestrator owns navigation — see screen orchestrator.
  onGarmentPress: (garmentId: string) => void;
}

export function VisualSearchResults({ result, onGarmentPress }: VisualSearchResultsProps) {
  // M19 Codex round 1 P2.4 — only allow https:// product URLs through
  // to `Linking.openURL`. URL parsing failure or a non-https protocol
  // surfaces an inline alert and short-circuits without navigating.
  const handleWebMatchTap = React.useCallback((match: VisualSearchWebMatch) => {
    hapticLight();
    let safeUrl: string | null = null;
    try {
      const parsed = new URL(match.product_url);
      if (parsed.protocol === 'https:') {
        safeUrl = parsed.toString();
      }
    } catch {
      safeUrl = null;
    }
    if (!safeUrl) {
      Alert.alert(tr('visualSearch.webRow'), tr('visualSearch.invalidWebUrl'));
      return;
    }
    Alert.alert(
      tr('visualSearch.webRow'),
      tr('visualSearch.webComingSoon'),
      [
        { text: tr('visualSearch.cancel'), style: 'cancel' },
        // Best-effort open of the product URL in the system browser so
        // the user can still discover the product manually until the
        // M20 import flow lands.
        {
          text: tr('visualSearch.webMatchOpenAction'),
          onPress: () => {
            void Linking.openURL(safeUrl).catch(() => {
              // Swallow — the URL might be malformed; we don't want
              // an unhandled rejection to crash the alert.
            });
          },
        },
      ],
    );
  }, []);

  return (
    <>
      <ResultsRow
        title={tr('visualSearch.wardrobeRow')}
        emptyLabel={tr('visualSearch.wardrobeEmpty')}
        count={result.wardrobeMatches.length}>
        {result.wardrobeMatches.length === 0 ? null : (
          <FlatList
            data={result.wardrobeMatches}
            keyExtractor={(item) => item.garment_id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 20, gap: 10 }}
            renderItem={({ item }) => (
              <WardrobeMatchTile
                match={item}
                onPress={(garmentId) => {
                  hapticLight();
                  onGarmentPress(garmentId);
                }}
              />
            )}
          />
        )}
      </ResultsRow>

      <ResultsRow
        title={tr('visualSearch.webRow')}
        emptyLabel={tr('visualSearch.webComingSoonInline')}
        count={result.webMatches.length}>
        {result.webMatches.length === 0 ? null : (
          <FlatList
            data={result.webMatches}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 20, gap: 10 }}
            renderItem={({ item }) => (
              <WebMatchTile match={item} onPress={handleWebMatchTap} />
            )}
          />
        )}
      </ResultsRow>
    </>
  );
}

// ─── Local subcomponents ───────────────────────────────────────────────

function ResultsRow({
  title,
  emptyLabel,
  count,
  children,
}: {
  title: string;
  emptyLabel: string;
  count: number;
  children: React.ReactNode;
}) {
  const t = useTokens();
  return (
    <View style={{ gap: 10 }}>
      <View style={{ paddingHorizontal: 4 }}>
        <Eyebrow>{title}</Eyebrow>
      </View>
      {count === 0 ? (
        <View
          style={[
            s.emptyRow,
            { borderColor: t.border, backgroundColor: t.bg2 },
          ]}>
          <Caption style={{ opacity: 0.7 }}>{emptyLabel}</Caption>
        </View>
      ) : (
        children
      )}
    </View>
  );
}

// Wardrobe match tile — wraps GarmentCard with a row-sized container
// (160 px wide) so it fits the horizontal scroll. Hydrates the underlying
// garment row via `useGarment(id)` so the card sees the user's actual
// title / category / image_path / wear_count instead of a synthetic
// placeholder. While the row is loading, falls back to a synthetic
// gradient-only placeholder using the garment_id-derived hue so the row
// doesn't pop in.
function WardrobeMatchTile({
  match,
  onPress,
}: {
  match: VisualSearchWardrobeMatch;
  onPress: (garmentId: string) => void;
}) {
  const t = useTokens();
  const { data: garment } = useGarment(match.garment_id);

  // While the garment row is loading or the lookup returned null
  // (race between the function's match list and the user's wardrobe
  // sync), render a synthetic placeholder card with just the id so the
  // tile keeps the row rhythm. M19 Codex round 1 P2.3 — the placeholder
  // stays tappable so the user can navigate to GarmentDetail (which can
  // hydrate the row independently); GarmentCard's `onPress` propagates
  // through the wrapper Pressable. M19 Codex round 1 P3.1 — `image_path`
  // dropped from the match shape; the `useGarment` lookup feeds the
  // real image once the row hydrates, and the placeholder leans on
  // GarmentCard's id-derived hue gradient.
  if (!garment) {
    return (
      <Pressable
        onPress={() => onPress(match.garment_id)}
        accessibilityRole="button"
        accessibilityLabel={tr('visualSearch.wardrobeRow')}
        accessibilityHint={tr('visualSearch.wardrobeMatchLoadingHint')}
        style={{ width: 160 }}>
        <GarmentCard
          garment={{
            id: match.garment_id,
            title: '…',
            category: null,
          }}
        />
        <View style={{ marginTop: 4, paddingHorizontal: 4 }}>
          <Caption style={{ opacity: 0.6, fontSize: 10 }}>
            {Math.round(match.score * 100)}%
          </Caption>
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={() => onPress(garment.id)}
      accessibilityRole="button"
      accessibilityLabel={garment.title ?? tr('visualSearch.wardrobeRow')}
      accessibilityHint={tr('visualSearch.wardrobeMatchHint')}
      style={{ width: 160 }}>
      <GarmentCard
        garment={{
          id: garment.id,
          title: garment.title ?? '',
          category: garment.category ?? null,
          color_primary: garment.color_primary ?? null,
          wear_count: garment.wear_count ?? null,
          in_laundry: garment.in_laundry ?? null,
          rendered_image_path: garment.rendered_image_path ?? null,
          original_image_path: garment.original_image_path ?? null,
          created_at: garment.created_at ?? null,
        }}
        onPress={() => onPress(garment.id)}
      />
      <View style={{ marginTop: 4, paddingHorizontal: 4 }}>
        <Text
          style={{
            fontFamily: fonts.uiSemi,
            fontSize: 10,
            color: t.fg2,
            letterSpacing: 1.2,
            textTransform: 'uppercase',
          }}>
          {Math.round(match.score * 100)}% match
        </Text>
      </View>
    </Pressable>
  );
}

// Web product match tile — compact 160px-wide card with image, title,
// price, merchant. Tap surfaces the "online import coming soon" alert
// (M20 owns the real import flow).
function WebMatchTile({
  match,
  onPress,
}: {
  match: VisualSearchWebMatch;
  onPress: (m: VisualSearchWebMatch) => void;
}) {
  const t = useTokens();
  const priceLabel = match.price
    ? `${match.price.amount} ${match.price.currency}`
    : null;
  return (
    <Pressable
      onPress={() => onPress(match)}
      accessibilityRole="button"
      accessibilityLabel={match.title}
      accessibilityHint={tr('visualSearch.webMatchHint')}
      style={({ pressed }) => [
        {
          width: 160,
          borderRadius: radii.lg,
          borderWidth: 1,
          borderColor: t.border,
          backgroundColor: t.card,
          overflow: 'hidden',
          transform: pressed ? [{ scale: 0.98 }] : [],
        },
      ]}>
      <View style={{ aspectRatio: 1, width: '100%', backgroundColor: t.bg2 }}>
        <Image
          source={{ uri: match.image_url }}
          style={StyleSheet.absoluteFillObject}
          resizeMode="cover"
        />
      </View>
      <View style={{ padding: 10, gap: 2 }}>
        <Text
          numberOfLines={1}
          style={{
            fontFamily: fonts.uiSemi,
            fontSize: 12.5,
            fontWeight: '600',
            color: t.fg,
            letterSpacing: -0.13,
          }}>
          {match.title}
        </Text>
        {priceLabel ? (
          <Text
            numberOfLines={1}
            style={{
              fontFamily: fonts.uiSemi,
              fontSize: 11,
              color: t.fg,
              letterSpacing: -0.1,
            }}>
            {priceLabel}
          </Text>
        ) : null}
        {match.merchant ? (
          <Text
            numberOfLines={1}
            style={{
              fontFamily: fonts.uiSemi,
              fontSize: 9.5,
              color: t.fg2,
              letterSpacing: 1.3,
              textTransform: 'uppercase',
            }}>
            {match.merchant}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  emptyRow: {
    marginHorizontal: 4,
    paddingVertical: 16,
    paddingHorizontal: 14,
    borderRadius: radii.lg,
    borderWidth: 1,
    alignItems: 'center',
  },
});
