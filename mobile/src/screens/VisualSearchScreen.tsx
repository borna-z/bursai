// Visual search — M19 entry surface.
//
// Flow: pick a reference photo (camera capture OR gallery pick) → preview +
// "Search this look" CTA → resize+base64 + edge function call via
// `useVisualSearch` → two horizontal-scroll result rows ("Your wardrobe"
// + "Found online").
//
// Layout decisions:
//   • Standard light surface (uses `useTokens()`) — this is a discovery
//     screen, not a camera UI, so the always-dark exemption from
//     LiveScanScreen does NOT apply.
//   • Two-step UI: pre-search dropzone → results display. The dropzone
//     stays visible above the results so the user can re-pick without
//     scrolling away (visually anchored at the top of the screen).
//   • Subscription-locked sentinel routes to PaywallScreen on first
//     occurrence per screen lifetime (sticky ref). Other errors render
//     inline with a Retry CTA above the results area.
//   • Wardrobe matches render as `GarmentCard`s in a horizontal
//     `FlatList`; tap → `GarmentDetail`. Web matches render as compact
//     product cards (image + title + price + merchant); tap → Alert
//     ("Online import coming soon" — M20 owns).
//
// Route: `VisualSearch` (registered in RootNavigator). No params.

import React from 'react';
import {
  Alert,
  FlatList,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { useCameraPermissions } from 'expo-camera';

import { useTokens } from '../theme/ThemeProvider';
import { fonts, radii } from '../theme/tokens';
import { Button } from '../components/Button';
import { Caption } from '../components/Caption';
import { Eyebrow } from '../components/Eyebrow';
import { GarmentCard } from '../components/GarmentCard';
import { IconBtn } from '../components/IconBtn';
import { PageTitle } from '../components/PageTitle';
import { Spinner } from '../components/Spinner';
import { BackIcon, CameraIcon, ImageIcon } from '../components/icons';
import { useGarment } from '../hooks/useGarments';
import {
  useVisualSearch,
  type VisualSearchWardrobeMatch,
  type VisualSearchWebMatch,
} from '../hooks/useVisualSearch';
import { hapticLight } from '../lib/haptics';
import { t as tr } from '../lib/i18n';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const SUBSCRIPTION_SENTINEL = 'subscription_required';

export function VisualSearchScreen() {
  const t = useTokens();
  const nav = useNavigation<Nav>();

  const [referenceUri, setReferenceUri] = React.useState<string | null>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  const visualSearch = useVisualSearch();
  const { result, isUploading, isSearching, error, submitSearch, reset } = visualSearch;

  // Sticky paywall redirect — the hook surfaces `'subscription_required'`
  // sentinel via the `error` field; first time we see it, route to Paywall
  // and clear the error so re-renders don't double-fire.
  const paywallRoutedRef = React.useRef(false);
  React.useEffect(() => {
    if (error === SUBSCRIPTION_SENTINEL && !paywallRoutedRef.current) {
      paywallRoutedRef.current = true;
      reset();
      nav.navigate('Paywall');
    }
  }, [error, nav, reset]);

  // Reset the paywall-routed sticky ref whenever the screen is re-entered
  // with no error (e.g. user came back from Paywall after subscribing).
  // Without this, a second 402 in the same mount cycle would silently
  // ignore the redirect.
  React.useEffect(() => {
    if (error === null) paywallRoutedRef.current = false;
  }, [error]);

  // Camera capture — uses expo-image-picker's `launchCameraAsync` for a
  // single-shot flow (LiveScan's full CameraView pattern is overkill for
  // a one-off reference photo). Permission is auto-requested via the
  // hook's first call; if the user has hard-denied it, surface the
  // standard alert.
  const handleTakePhoto = React.useCallback(async () => {
    hapticLight();
    try {
      // expo-image-picker handles its own camera permission prompt when
      // we call requestCameraPermissionsAsync — but we mirror the
      // LiveScan pattern of triggering useCameraPermissions first so
      // the screen's first interaction surfaces the OS dialog.
      if (cameraPermission && !cameraPermission.granted && cameraPermission.canAskAgain) {
        const granted = await requestCameraPermission();
        if (!granted.granted) {
          return;
        }
      }
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission needed', 'Grant camera access to take a reference photo.');
        return;
      }
      const cap = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: false,
        quality: 0.85,
      });
      if (cap.canceled || !cap.assets[0]) return;
      setReferenceUri(cap.assets[0].uri);
      // Reset any prior result so the screen flips back to the pre-search
      // state when the user picks a new reference.
      reset();
    } catch {
      Alert.alert('Camera unavailable', 'Could not open the camera.');
    }
  }, [cameraPermission, requestCameraPermission, reset]);

  const handleChooseFromLibrary = React.useCallback(async () => {
    hapticLight();
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission needed', 'Grant photo access to pick a reference image.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: false,
        quality: 0.85,
      });
      if (result.canceled || !result.assets[0]) return;
      setReferenceUri(result.assets[0].uri);
      reset();
    } catch {
      Alert.alert('Gallery unavailable', 'Could not open the photo library.');
    }
  }, [reset]);

  const handleSubmit = React.useCallback(() => {
    if (!referenceUri) return;
    hapticLight();
    void submitSearch({ referenceImageUri: referenceUri });
  }, [referenceUri, submitSearch]);

  const handleClearReference = React.useCallback(() => {
    hapticLight();
    setReferenceUri(null);
    reset();
  }, [reset]);

  const handleWebMatchTap = React.useCallback((match: VisualSearchWebMatch) => {
    hapticLight();
    Alert.alert(
      tr('visualSearch.webRow'),
      tr('visualSearch.webComingSoon'),
      [
        { text: 'Cancel', style: 'cancel' },
        // Best-effort open of the product URL in the system browser so
        // the user can still discover the product manually until the
        // M20 import flow lands.
        {
          text: 'Open',
          onPress: () => {
            void Linking.openURL(match.product_url).catch(() => {
              // Swallow — the URL might be malformed; we don't want
              // an unhandled rejection to crash the alert.
            });
          },
        },
      ],
    );
  }, []);

  // Hide the subscription sentinel from the inline error block — the
  // useEffect above already routes to Paywall.
  const visibleError = error && error !== SUBSCRIPTION_SENTINEL ? error : null;

  const showResults = result !== null;
  const showSearchingState = isSearching && !showResults;
  const showPreparingState = isUploading && !showResults;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={['top']}>
      {/* ============ HEADER ============ */}
      <View style={[s.header, { borderBottomColor: t.border }]}>
        <IconBtn variant="ghost" onPress={() => nav.goBack()} ariaLabel="Back">
          <BackIcon color={t.fg} />
        </IconBtn>
        <View style={{ flex: 1 }}>
          <Eyebrow style={{ marginBottom: 2 }}>{tr('visualSearch.eyebrow')}</Eyebrow>
          <PageTitle size={26}>{tr('visualSearch.title')}</PageTitle>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 32, gap: 18 }}
        showsVerticalScrollIndicator={false}>
        {/* ============ REFERENCE PICKER ============ */}
        {referenceUri ? (
          <View
            style={[
              s.previewCard,
              { borderColor: t.border, backgroundColor: t.card },
            ]}>
            <Image
              source={{ uri: referenceUri }}
              style={s.previewImage}
              resizeMode="cover"
            />
            <View style={{ padding: 12, gap: 10 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Button
                    label={tr('visualSearch.searchCta')}
                    onPress={handleSubmit}
                    disabled={isUploading || isSearching}
                  />
                </View>
                <Pressable
                  onPress={handleClearReference}
                  accessibilityRole="button"
                  accessibilityLabel="Clear reference"
                  style={({ pressed }) => [
                    s.clearBtn,
                    {
                      borderColor: t.border,
                      backgroundColor: t.bg2,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}>
                  <Text style={{ fontFamily: fonts.uiSemi, fontSize: 13, color: t.fg }}>×</Text>
                </Pressable>
              </View>
            </View>
          </View>
        ) : (
          <View
            style={[
              s.dropzone,
              { borderColor: t.border, backgroundColor: t.card },
            ]}>
            <View style={{ alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <View
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: radii.md,
                  backgroundColor: t.accentSoft,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <CameraIcon color={t.accent} size={26} />
              </View>
              <Text
                style={{
                  fontFamily: fonts.uiSemi,
                  fontSize: 14,
                  color: t.fg,
                  letterSpacing: -0.13,
                  textAlign: 'center',
                }}>
                {tr('visualSearch.title')}
              </Text>
              <Caption style={{ textAlign: 'center', opacity: 0.75, paddingHorizontal: 12 }}>
                {tr('visualSearch.eyebrow')}
              </Caption>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <SourcePill
                label={tr('visualSearch.takePhoto')}
                icon={<CameraIcon color={t.accent} />}
                onPress={handleTakePhoto}
              />
              <SourcePill
                label={tr('visualSearch.chooseFromLibrary')}
                icon={<ImageIcon color={t.accent} />}
                onPress={handleChooseFromLibrary}
              />
            </View>
          </View>
        )}

        {/* ============ INLINE ERROR ============ */}
        {visibleError ? (
          <View
            style={[
              s.errorCard,
              { borderColor: t.border, backgroundColor: t.bg2 },
            ]}>
            <Caption style={{ color: t.fg }}>{tr('visualSearch.error')}</Caption>
            <Caption style={{ opacity: 0.7, marginTop: 4 }}>{visibleError}</Caption>
          </View>
        ) : null}

        {/* ============ SEARCHING STATE ============ */}
        {showPreparingState || showSearchingState ? (
          <View style={[s.searchingCard, { borderColor: t.border, backgroundColor: t.card }]}>
            <Spinner />
            <Caption style={{ marginTop: 10, opacity: 0.75 }}>
              {tr('visualSearch.searching')}
            </Caption>
          </View>
        ) : null}

        {/* ============ RESULTS ============ */}
        {showResults ? (
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
                        nav.navigate('GarmentDetail', { id: garmentId });
                      }}
                    />
                  )}
                />
              )}
            </ResultsRow>

            <ResultsRow
              title={tr('visualSearch.webRow')}
              emptyLabel={tr('visualSearch.webEmpty')}
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
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Local subcomponents ───────────────────────────────────────────────

function SourcePill({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: React.ReactNode;
  onPress: () => void;
}) {
  const t = useTokens();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        {
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          padding: 12,
          borderRadius: radii.lg,
          borderWidth: 1,
          borderColor: t.border,
          backgroundColor: t.bg2,
          transform: pressed ? [{ scale: 0.98 }] : [],
        },
      ]}>
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: radii.md,
          backgroundColor: t.accentSoft,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        {icon}
      </View>
      <Text
        style={{
          flex: 1,
          fontFamily: fonts.uiSemi,
          fontSize: 13,
          color: t.fg,
          letterSpacing: -0.13,
          fontWeight: '600',
        }}>
        {label}
      </Text>
    </Pressable>
  );
}

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
  // tile keeps the row rhythm.
  if (!garment) {
    return (
      <View style={{ width: 160 }}>
        <GarmentCard
          garment={{
            id: match.garment_id,
            title: '…',
            category: null,
            // Defensive: prefer the function's `image_path` if it ever
            // surfaces one (today it never does); otherwise let
            // GarmentCard derive a hue from the garment_id so the
            // placeholder gradient is stable.
            original_image_path: match.image_path,
          }}
        />
        <View style={{ marginTop: 4, paddingHorizontal: 4 }}>
          <Caption style={{ opacity: 0.6, fontSize: 10 }}>
            {Math.round(match.score * 100)}%
          </Caption>
        </View>
      </View>
    );
  }

  return (
    <View style={{ width: 160 }}>
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
    </View>
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

// ─── Styles ────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  dropzone: {
    borderRadius: radii.xl,
    borderWidth: 1,
    borderStyle: 'dashed',
    padding: 20,
  },
  previewCard: {
    borderRadius: radii.xl,
    borderWidth: 1,
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    aspectRatio: 1,
  },
  clearBtn: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorCard: {
    padding: 12,
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  searchingCard: {
    paddingVertical: 28,
    paddingHorizontal: 16,
    borderRadius: radii.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyRow: {
    marginHorizontal: 4,
    paddingVertical: 16,
    paddingHorizontal: 14,
    borderRadius: radii.lg,
    borderWidth: 1,
    alignItems: 'center',
  },
});
