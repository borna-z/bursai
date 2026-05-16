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

import { useTokens } from '../theme/ThemeProvider';
import { fonts, radii } from '../theme/tokens';
import { Button } from '../components/Button';
import { Caption } from '../components/Caption';
import { Eyebrow } from '../components/Eyebrow';
import { IconBtn } from '../components/IconBtn';
import { PageTitle } from '../components/PageTitle';
import { Spinner } from '../components/Spinner';
import { BackIcon, CameraIcon, ImageIcon } from '../components/icons';
import { useVisualSearch } from '../hooks/useVisualSearch';
import { SUBSCRIPTION_SENTINEL } from '../lib/edgeFunctionClient';
import { hapticLight } from '../lib/haptics';
import { t as tr } from '../lib/i18n';
import { log } from '../lib/log';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { VisualSearchResults } from './VisualSearch/VisualSearchResults';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function VisualSearchScreen() {
  const t = useTokens();
  const nav = useNavigation<Nav>();

  const [referenceUri, setReferenceUri] = React.useState<string | null>(null);

  const visualSearch = useVisualSearch();
  const { result, isUploading, isSearching, error, submitSearch, reset } = visualSearch;

  // Sticky paywall redirect — the hook surfaces `'subscription_required'`
  // sentinel via the `error` field; first time we see it, route to Paywall
  // and clear the error so re-renders don't double-fire. M19 Codex round 1
  // P3.3 — single effect keyed on `error` covers both the route-on-set
  // and the reset-on-clear branches so the lifecycle has one source of
  // truth.
  const paywallRoutedRef = React.useRef(false);
  React.useEffect(() => {
    if (error === SUBSCRIPTION_SENTINEL) {
      if (!paywallRoutedRef.current) {
        paywallRoutedRef.current = true;
        reset();
        nav.navigate('Paywall');
      }
      return;
    }
    // Any other error transition (including null) clears the sticky ref
    // so a second 402 in the same mount cycle still redirects.
    paywallRoutedRef.current = false;
  }, [error, nav, reset]);

  // Camera capture — uses expo-image-picker's `launchCameraAsync` for a
  // single-shot flow (LiveScan's full CameraView pattern is overkill for
  // a one-off reference photo). M19 Codex round 1 P1.2 — relies on
  // ImagePicker's built-in permission prompt; the prior
  // `useCameraPermissions` pre-check double-asked on cold start because
  // ImagePicker also prompts internally. The screen does NOT render an
  // inline camera preview, so the expo-camera permission hook is not
  // needed here.
  const handleTakePhoto = React.useCallback(async () => {
    hapticLight();
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          tr('visualSearch.permission.cameraTitle'),
          tr('visualSearch.permission.cameraBody'),
          [
            {
              text: tr('visualSearch.permission.openSettings'),
              onPress: () => {
                void Linking.openSettings().catch((linkErr) => {
                  // F-020: don't silently swallow. The Settings app is
                  // installed on every iOS/Android device, so this catch
                  // implies an OS-level issue worth reporting (corrupted
                  // app links, locked-down enterprise device). Log via
                  // `log.error` so Sentry captures it.
                  log.error(linkErr, {
                    area: 'visual_search',
                    op: 'open_settings',
                  });
                });
              },
            },
            { text: tr('visualSearch.permission.cancel'), style: 'cancel' },
          ],
        );
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
      Alert.alert(
        tr('visualSearch.cameraUnavailableTitle'),
        tr('visualSearch.cameraUnavailableBody'),
      );
    }
  }, [reset]);

  const handleChooseFromLibrary = React.useCallback(async () => {
    hapticLight();
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          tr('visualSearch.permission.galleryTitle'),
          tr('visualSearch.permission.galleryBody'),
          [
            {
              text: tr('visualSearch.permission.openSettings'),
              onPress: () => {
                void Linking.openSettings().catch((linkErr) => {
                  // F-020: don't silently swallow. The Settings app is
                  // installed on every iOS/Android device, so this catch
                  // implies an OS-level issue worth reporting (corrupted
                  // app links, locked-down enterprise device). Log via
                  // `log.error` so Sentry captures it.
                  log.error(linkErr, {
                    area: 'visual_search',
                    op: 'open_settings',
                  });
                });
              },
            },
            { text: tr('visualSearch.permission.cancel'), style: 'cancel' },
          ],
        );
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
      Alert.alert(
        tr('visualSearch.galleryUnavailableTitle'),
        tr('visualSearch.galleryUnavailableBody'),
      );
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
                  accessibilityLabel={tr('visualSearch.clearReferenceLabel')}
                  accessibilityHint={tr('visualSearch.clearReferenceHint')}
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
                hint={tr('visualSearch.takePhotoHint')}
                icon={<CameraIcon color={t.accent} />}
                onPress={handleTakePhoto}
              />
              <SourcePill
                label={tr('visualSearch.chooseFromLibrary')}
                hint={tr('visualSearch.chooseFromLibraryHint')}
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
        {showResults && result ? (
          <VisualSearchResults
            result={result}
            onGarmentPress={(garmentId) =>
              nav.navigate('GarmentDetail', { id: garmentId })
            }
          />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Local subcomponents ───────────────────────────────────────────────

function SourcePill({
  label,
  hint,
  icon,
  onPress,
}: {
  label: string;
  hint: string;
  icon: React.ReactNode;
  onPress: () => void;
}) {
  const t = useTokens();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
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
});
