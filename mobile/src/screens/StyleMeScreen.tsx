// Style Me — occasion-based outfit creator.
// W4: wired to the real `burs_style_engine` edge function via
// useGenerateOutfit. The grid + formality chips remain user inputs;
// "Generate outfit" passes the selections through to the hook and renders
// the returned outfit inline.

import React, { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTokens } from '../theme/ThemeProvider';
import { fonts, radii } from '../theme/tokens';
import { Eyebrow } from '../components/Eyebrow';
import { PageTitle } from '../components/PageTitle';
import { Caption } from '../components/Caption';
import { Button } from '../components/Button';
import { Chip } from '../components/Chip';
import { IconBtn } from '../components/IconBtn';
import { OutfitCard } from '../components/OutfitCard';
import { Spinner } from '../components/Spinner';
import { ErrorState } from '../components/ErrorState';
import {
  BackIcon,
  SunIcon,
  TshirtIcon,
  SuitcaseIcon,
  CalendarIcon,
  SparklesIcon,
  type IconProps,
} from '../components/icons';
import { useGenerateOutfit, formatGenerateOutfitError } from '../hooks/useGenerateOutfit';
import { useFlatGarments } from '../hooks/useGarments';
import { SUBSCRIPTION_SENTINEL } from '../lib/edgeFunctionClient';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

type Occasion = {
  id: string;
  label: string;
  sub: string;
  Icon: React.ComponentType<IconProps>;
};

const OCCASIONS: Occasion[] = [
  { id: 'work',     label: 'Work',     sub: 'Office, meetings',  Icon: TshirtIcon  },
  { id: 'dinner',   label: 'Dinner',   sub: 'Refined evenings',  Icon: SparklesIcon },
  { id: 'casual',   label: 'Casual',   sub: 'Errands, weekends', Icon: TshirtIcon  },
  { id: 'date',     label: 'Date',     sub: 'A bit considered',  Icon: SparklesIcon },
  { id: 'travel',   label: 'Travel',   sub: 'Light, layered',    Icon: SuitcaseIcon },
  { id: 'wedding',  label: 'Wedding',  sub: 'Sharp, soft',       Icon: SparklesIcon },
  { id: 'sport',    label: 'Sport',    sub: 'Move-friendly',     Icon: SunIcon     },
  { id: 'evening',  label: 'Evening',  sub: 'Out late',          Icon: CalendarIcon },
];

const FORMALITY = ['Casual', 'Smart casual', 'Business', 'Formal'] as const;
type Formality = typeof FORMALITY[number];

const PLACEHOLDER_HUES = [32, 38, 200, 28];

export function StyleMeScreen() {
  const t = useTokens();
  const nav = useNavigation<Nav>();
  const [occId, setOccId] = useState<string>('work');
  const [formality, setFormality] = useState<Formality>('Smart casual');

  const { result, isLoading, error, generate, reset } = useGenerateOutfit();
  const paywallShownRef = useRef(false);

  // burs_style_engine returns `image_path` per item but it's the legacy
  // `garments.image_path` column — null for any garment that was uploaded
  // through the modern (rendered_image_path / original_image_path) pipeline.
  // Pull the wardrobe and resolve image paths against the modern columns
  // so OutfitCard tiles render real thumbnails for newer garments too.
  // Same fallback story as MoodFlowScreen / OutfitDetailScreen.
  const wardrobe = useFlatGarments();
  const wardrobeImageMap = React.useMemo(() => {
    const m = new Map<string, string | null>();
    for (const g of wardrobe.data) {
      m.set(g.id, g.rendered_image_path ?? g.original_image_path ?? null);
    }
    return m;
  }, [wardrobe.data]);

  const occ = OCCASIONS.find((o) => o.id === occId) ?? OCCASIONS[0];

  useEffect(() => {
    return () => {
      reset();
    };
  }, [reset]);

  useEffect(() => {
    // Route to the real PaywallScreen instead of popping an Alert each time
    // the engine returns `subscription_required`. The previous version
    // re-popped the alert every time the user tapped Generate after a
    // dismiss + reset() — App Store reviewers flag this as harassing UX
    // (and screen-reviewer P1 caught it). The ref stays sticky for the
    // screen's lifetime so we don't re-route on every retry attempt; the
    // user navigates back to StyleMe explicitly when they want to retry.
    if (error === SUBSCRIPTION_SENTINEL && !paywallShownRef.current) {
      paywallShownRef.current = true;
      nav.navigate('Paywall');
    }
  }, [error, nav]);

  const onGenerate = () => {
    void generate({ occasion: occ.label, formality });
  };

  const onRestyle = () => {
    reset();
  };

  const itemCount = result?.items.length ?? 0;
  const subLine = result
    ? `${occ.sub.toUpperCase()} · ${itemCount} PIECE${itemCount === 1 ? '' : 'S'}`
    : '';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={['top']}>
      {/* ============ HEADER ============ */}
      <View style={[s.header, { borderBottomColor: t.border }]}>
        <IconBtn variant="ghost" onPress={() => nav.goBack()} ariaLabel="Back">
          <BackIcon color={t.fg} />
        </IconBtn>
        <View style={{ flex: 1 }}>
          <Eyebrow style={{ marginBottom: 2 }}>Occasion</Eyebrow>
          <PageTitle size={26}>Style Me</PageTitle>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 24, gap: 18 }}
        showsVerticalScrollIndicator={false}>

        {/* ============ OCCASION GRID 2-col ============ */}
        <View>
          <Eyebrow style={{ marginBottom: 10 }}>Pick an occasion</Eyebrow>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {OCCASIONS.map((o) => {
              const Icon = o.Icon;
              const isActive = o.id === occId;
              return (
                <Pressable
                  key={o.id}
                  onPress={() => setOccId(o.id)}
                  style={({ pressed }) => [
                    s.occTile,
                    {
                      borderColor: isActive ? t.accent : t.border,
                      borderWidth: isActive ? 2 : 1,
                      backgroundColor: isActive ? t.accentSoft : t.card,
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
                    <Icon color={t.accent} />
                  </View>
                  <View style={{ gap: 1 }}>
                    <Text style={{ fontFamily: fonts.uiSemi, fontSize: 14, fontWeight: '600', color: t.fg, letterSpacing: -0.14 }}>
                      {o.label}
                    </Text>
                    <Text style={{ fontFamily: fonts.ui, fontSize: 11, color: t.fg2 }} numberOfLines={1}>
                      {o.sub}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* ============ WEATHER CONTEXT ============ */}
        <View
          style={[
            s.weatherRow,
            { borderColor: t.border, backgroundColor: t.card },
          ]}>
          <View style={{ width: 36, height: 36, borderRadius: radii.md, backgroundColor: t.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
            <SunIcon color={t.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Eyebrow style={{ marginBottom: 1 }}>Weather</Eyebrow>
            <Text style={{ fontFamily: fonts.uiSemi, fontSize: 13, color: t.fg, fontWeight: '600', letterSpacing: -0.13 }}>
              14° clear · light breeze
            </Text>
          </View>
          <Pressable
            onPress={() =>
              Alert.alert('Weather', 'Weather customisation coming soon.')
            }
            accessibilityRole="button"
            accessibilityLabel="Adjust weather context"
            style={{ paddingHorizontal: 6, paddingVertical: 6 }}>
            <Text style={{ fontFamily: fonts.uiMed, fontSize: 12, color: t.accent }}>Adjust</Text>
          </Pressable>
        </View>

        {/* ============ FORMALITY ============ */}
        <View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
            <Eyebrow>Formality</Eyebrow>
            <Caption style={{ color: t.accent }}>{formality}</Caption>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {FORMALITY.map((label) => (
              <Chip
                key={label}
                label={label}
                active={label === formality}
                onPress={() => setFormality(label)}
              />
            ))}
          </View>
        </View>

        {/* ============ GENERATE / RESULT ============ */}
        {error && error !== SUBSCRIPTION_SENTINEL ? (
          <ErrorState
            title="Couldn't generate"
            body={formatGenerateOutfitError(error) ?? error}
            onRetry={onGenerate}
          />
        ) : isLoading ? (
          <View style={s.loadingWrap}>
            <Spinner size={36} />
            <Caption style={{ marginTop: 14, textAlign: 'center' }}>
              Building your look…
            </Caption>
          </View>
        ) : !result ? (
          <Button label="Generate outfit" onPress={onGenerate} block />
        ) : itemCount === 0 ? (
          // Engine returned a non-error response with no garments — wardrobe
          // doesn't cover this occasion+formality combo. Surface a soft empty
          // state instead of rendering a "0 PIECES" OutfitCard. Codex audit
          // P2-1 (audit 3).
          <View style={{ gap: 14 }}>
            <View style={s.emptyResult}>
              <Eyebrow>No matching pieces</Eyebrow>
              <Caption style={{ marginTop: 6, textAlign: 'center', maxWidth: 260 }}>
                {result.description || 'Try a different occasion or formality — your wardrobe doesn’t yet cover this combo.'}
              </Caption>
            </View>
            <Button label="Restyle" variant="outline" onPress={onRestyle} block />
          </View>
        ) : (
          <View style={{ gap: 14 }}>
            <View>
              <Eyebrow style={{ marginBottom: 8 }}>Styled for you</Eyebrow>
              <OutfitCard
                name={result.outfit_name}
                sub={subLine}
                hues={PLACEHOLDER_HUES}
                items={result.items.map((it, i) => ({
                  id: it.garment_id ?? `style-me-slot-${i}`,
                  // Prefer the engine's response (legacy `image_path` from
                  // burs_style_engine's SELECT) and fall back to the wardrobe
                  // lookup against modern `rendered_image_path` /
                  // `original_image_path` columns. Either yields a real
                  // thumbnail for at least one of the two garment generations
                  // we have on record; null on both leaves the gradient.
                  imagePath:
                    it.image_path
                    ?? (it.garment_id ? wardrobeImageMap.get(it.garment_id) ?? null : null),
                }))}
                onUse={() => {
                  if (result.outfit_id) {
                    nav.navigate('OutfitDetail', { id: result.outfit_id });
                  } else {
                    Alert.alert(
                      'Saved as preview',
                      'Persistent saving lands in a future update. For now this is a preview.',
                    );
                  }
                }}
                onSave={() =>
                  Alert.alert(
                    'Saved as preview',
                    'Persistent saving lands in a future update. For now this is a preview.',
                  )
                }
              />
              {result.description ? (
                <Caption style={{ marginTop: 8, lineHeight: 18 }}>{result.description}</Caption>
              ) : null}
            </View>
            <Button label="Restyle" variant="outline" onPress={onRestyle} block />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  occTile: {
    width: '48%',
    flexGrow: 1,
    flexBasis: '48%',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: radii.xl,
    gap: 10,
  },
  weatherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  loadingWrap: {
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyResult: {
    paddingVertical: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
