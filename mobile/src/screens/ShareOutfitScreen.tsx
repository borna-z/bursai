// Shareable outfit card + native share sheet.
// Source: design_handoff_burs_rn/source/audit-screens.jsx ShareOutfitScreen (lines 793-841).
//
// Card cream/charcoal palette is hardcoded — it's a designed-as-image artifact (renders the
// same regardless of system theme; the goal is "looks good on Instagram"), so it's a deliberate
// theme-bound exception. Other surfaces follow `useTokens()`.
//
// Save image is intentionally NOT wired in this PR — would require expo-media-library +
// react-native-view-shot. Renders as Alert until those deps are authorized.

import React from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTokens } from '../theme/ThemeProvider';
import { fonts, radii } from '../theme/tokens';
import { Eyebrow } from '../components/Eyebrow';
import { PageTitle } from '../components/PageTitle';
import { Button } from '../components/Button';
import { IconBtn } from '../components/IconBtn';
import { BackIcon, ShareIcon, FileIcon } from '../components/icons';
import { hapticLight, hapticSuccess } from '../lib/haptics';
import { useGenerateFlatlay } from '../hooks/useGenerateFlatlay';
import { useSignedUrl } from '../hooks/useSignedUrl';
import { t as tr } from '../lib/i18n';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'ShareOutfit'>;

// Always-light card palette. Documented exemption — see file header.
const CARD_BG = '#F4ECDD';
const CARD_FG = '#1D1916';
const CARD_FG2 = '#69625B';
const CARD_BORDER = '#DDD0BB';
const CARD_ACCENT = '#AD8137';

const SHARE_URL = 'https://burs.me/o/mock';
const SHARE_MESSAGE = 'Check out my BURS look';

export function ShareOutfitScreen() {
  const t = useTokens();
  const insets = useSafeAreaInsets();
  const nav = useNavigation<Nav>();
  const route = useRoute<Route>();
  const outfitId = route.params?.id;
  const flatlay = useGenerateFlatlay();
  // Cache the rendered path so re-tapping "Generate flatlay" doesn't burn
  // another image-gen call. M17 wave: "or allow re-generation if needed."
  // Same path → re-tap is cheap (the function upserts to a deterministic
  // storage path); we still skip the call when we already have the URL.
  const { data: flatlaySignedUrl } = useSignedUrl(flatlay.flatlayPath);
  const paywallShownRef = React.useRef(false);

  React.useEffect(() => {
    if (flatlay.error === 'subscription_required' && !paywallShownRef.current) {
      paywallShownRef.current = true;
      nav.navigate('Paywall');
    }
  }, [flatlay.error, nav]);

  const onGenerateFlatlay = React.useCallback(() => {
    if (!outfitId) {
      Alert.alert(tr('shareOutfit.flatlayError'));
      return;
    }
    if (flatlay.flatlayPath || flatlay.isGenerating) return;
    hapticLight();
    void flatlay.generate(outfitId);
  }, [outfitId, flatlay]);

  const onShare = async () => {
    hapticLight();
    try {
      await Share.share({ message: `${SHARE_MESSAGE} — ${SHARE_URL}`, url: SHARE_URL });
    } catch {
      // Native sheet errors aren't actionable for the user.
    }
  };

  const onCopyLink = () => {
    hapticSuccess();
    Alert.alert('Copied', 'Link copied. (Clipboard wiring lands with the next deps update.)');
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: 8,
          paddingHorizontal: 20,
          paddingBottom: insets.bottom + 32,
          gap: 24,
        }}
        showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={s.header}>
          <IconBtn ariaLabel="Back" onPress={() => { hapticLight(); nav.goBack(); }}>
            <BackIcon color={t.fg} />
          </IconBtn>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Eyebrow>Share</Eyebrow>
            <PageTitle style={{ marginTop: 4 }}>Share outfit</PageTitle>
          </View>
          <View style={{ width: 36 }} />
        </View>

        {/* Outfit card preview — always-light palette */}
        <View style={[s.card, { backgroundColor: CARD_BG, borderColor: CARD_BORDER }]}>
          <View style={s.cardWordmarkRow}>
            <View style={{ width: 44 }} />
            <Text
              style={{
                fontFamily: fonts.displayMedium,
                fontStyle: 'italic',
                fontSize: 13,
                color: CARD_ACCENT,
                letterSpacing: 0.4,
              }}>
              BURS
            </Text>
          </View>
          {flatlaySignedUrl ? (
            <View style={s.flatlayWrap}>
              <Image
                source={{ uri: flatlaySignedUrl }}
                style={s.flatlayImage}
                resizeMode="cover"
                accessibilityLabel="Generated flatlay preview"
              />
            </View>
          ) : flatlay.isGenerating ? (
            <View style={[s.flatlayWrap, s.flatlayLoading, { borderColor: CARD_BORDER }]}>
              <ActivityIndicator color={CARD_ACCENT} />
              <Text
                style={{
                  marginTop: 12,
                  fontFamily: fonts.uiSemi,
                  fontSize: 11,
                  letterSpacing: 1.4,
                  color: CARD_FG2,
                  textTransform: 'uppercase',
                }}>
                {tr('shareOutfit.generatingFlatlay')}
              </Text>
            </View>
          ) : (
            <View style={s.cardGrid}>
              {[32, 18, 200, 45].map((hue, i) => (
                <View
                  key={i}
                  style={[
                    s.cardCell,
                    {
                      backgroundColor: `hsl(${hue}, 22%, 78%)`,
                      borderColor: CARD_BORDER,
                    },
                  ]}
                />
              ))}
            </View>
          )}
          <Text
            style={{
              fontFamily: fonts.displayMedium,
              fontStyle: 'italic',
              fontSize: 24,
              color: CARD_FG,
              textAlign: 'center',
              letterSpacing: -0.24,
              marginTop: 18,
            }}>
            Cream and shadow
          </Text>
          <Text
            style={{
              fontFamily: fonts.uiMed,
              fontSize: 11,
              letterSpacing: 1.5,
              textTransform: 'uppercase',
              color: CARD_FG2,
              textAlign: 'center',
              marginTop: 12,
            }}>
            Styled with BURS
          </Text>
        </View>

        {/* Caption */}
        <Text
          style={{
            fontFamily: fonts.ui,
            fontSize: 13,
            lineHeight: 19.5,
            color: t.fg2,
            textAlign: 'center',
          }}>
          Share your look to Instagram, stories, and more.
        </Text>

        {/* M17 — Generate flatlay. Hidden once we have a rendered image
            (re-generation is allowed but cheap because the function upserts
            to a deterministic storage path; we show "Regenerate" so the
            user can intentionally re-run if they want a fresh roll). */}
        {outfitId ? (
          <Button
            label={
              flatlay.isGenerating
                ? tr('shareOutfit.generatingFlatlay')
                : flatlay.flatlayPath
                  ? tr('shareOutfit.generateFlatlay')
                  : tr('shareOutfit.generateFlatlay')
            }
            onPress={onGenerateFlatlay}
            block
            disabled={flatlay.isGenerating}
            variant={flatlay.flatlayPath ? 'outline' : 'primary'}
          />
        ) : null}

        {flatlay.error && flatlay.error !== 'subscription_required' ? (
          <Text
            style={{
              fontFamily: fonts.ui,
              fontSize: 12,
              color: t.fg2,
              textAlign: 'center',
            }}>
            {tr('shareOutfit.flatlayError')}
          </Text>
        ) : null}

        {/* Share options row — Save image is intentionally omitted until expo-media-library +
            react-native-view-shot are installed (deferred per "no new deps without asking" rule).
            Showing a "Coming soon" Alert on every tap trains users to ignore the row, so the
            button is hidden until it works. */}
        <View style={s.optionsRow}>
          <ShareOption
            label="Share"
            onPress={onShare}
            icon={<ShareIcon color={t.fg} size={20} />}
          />
          <ShareOption
            label="Copy link"
            onPress={onCopyLink}
            icon={<FileIcon color={t.fg} size={20} />}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ShareOption({
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
      style={({ pressed }) => [s.optionCol, { opacity: pressed ? 0.7 : 1 }]}>
      <View style={[s.optionTile, { backgroundColor: t.accentSoft, borderColor: t.border }]}>
        {icon}
      </View>
      <Text
        style={{
          marginTop: 8,
          fontFamily: fonts.uiSemi,
          fontSize: 11,
          letterSpacing: 1.4,
          textTransform: 'uppercase',
          color: t.fg,
        }}>
        {label}
      </Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  card: {
    borderRadius: radii.xl,
    borderWidth: 1,
    padding: 18,
    shadowColor: '#1C1917',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 4,
  },
  cardWordmarkRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  cardCell: {
    width: '48.5%',
    aspectRatio: 0.78,
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  flatlayWrap: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radii.lg,
    overflow: 'hidden',
  },
  flatlayImage: {
    width: '100%',
    height: '100%',
  },
  flatlayLoading: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  optionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  optionCol: {
    flex: 1,
    alignItems: 'center',
  },
  optionTile: {
    width: 56,
    height: 56,
    borderRadius: radii.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
