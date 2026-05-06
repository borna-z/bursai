// ValuePropositionStep — onboarding step 2.
// 3-slide carousel with auto-advance + manual swipe + dot indicators.
// Slide content (eyebrow / italic title / caption / illustration) lives in SLIDES below.
// The illustrations are abstract gradient/shape placeholders so we don't ship
// unsourced photography — they communicate the *kind* of preview, not a specific outfit.

import React, { useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { useTokens } from '../../theme/ThemeProvider';
import { fonts, radii } from '../../theme/tokens';
import { Eyebrow } from '../../components/Eyebrow';
import { PageTitle } from '../../components/PageTitle';
import { Caption } from '../../components/Caption';
import { Button } from '../../components/Button';
import {
  ChatIcon,
  SparklesIcon,
  SunIcon,
  TshirtIcon,
} from '../../components/icons';
import { t as tr } from '../../lib/i18n';
import { hapticLight } from '../../lib/haptics';

type SlideId = 'wardrobe' | 'styling' | 'stylist';

const AUTO_ADVANCE_MS = 4000;

// Decorative gradient palette for the wardrobe-grid + outfit-card illustrations.
// Named so they don't read as "hardcoded color in a screen" — they're not
// theme tokens, they're illustration palette seeds (the same way the
// production wardrobe shows real garment thumbnails). Tuned to feel like
// natural fabric tones across the cream/charcoal app palette.
const WARDROBE_HUES = [10, 48, 86, 124, 162, 200, 238, 276, 314] as const;
const STYLING_HUES = [180, 30, 200, 60] as const;

export function ValuePropositionStep({ onComplete }: { onComplete: () => void }) {
  const t = useTokens();
  const [index, setIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const [width, setWidth] = useState(Dimensions.get('window').width);
  // Auto-advance disables itself the first time the user manually swipes — we
  // shouldn't be fighting a user who explicitly went back. (P1-1 / P1-2.)
  const userInteractedRef = useRef(false);

  // Listen for rotation / split-screen width changes so the carousel stays in
  // sync with the actual layout width. (P2-7.) The `onLayout` below also sets
  // width, but `onLayout` doesn't always fire on iPad rotation if the wrapping
  // View's bounds don't change in the right axis — Dimensions.change is the
  // reliable signal.
  useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ window }) => {
      setWidth(window.width);
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (index >= 2) return;
    if (userInteractedRef.current) return;
    const id = setTimeout(() => {
      // Re-check the interaction flag inside the callback in case the user
      // started a swipe after the timer was scheduled.
      if (userInteractedRef.current) return;
      const next = index + 1;
      setIndex(next);
      scrollRef.current?.scrollTo({ x: next * width, animated: true });
    }, AUTO_ADVANCE_MS);
    return () => clearTimeout(id);
  }, [index, width]);

  const onScrollBeginDrag = () => {
    userInteractedRef.current = true;
  };

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / Math.max(width, 1));
    if (i !== index) setIndex(i);
  };

  return (
    <View
      style={{ flex: 1 }}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScrollBeginDrag={onScrollBeginDrag}
        onMomentumScrollEnd={onScrollEnd}
        style={{ flex: 1 }}>
        {SLIDES.map((s) => (
          <View key={s.id} style={{ width, paddingHorizontal: 20 }}>
            <View style={{ flex: 1, justifyContent: 'space-between', paddingVertical: 8 }}>
              <View style={{ gap: 10, marginTop: 4 }}>
                <Eyebrow>{tr(s.eyebrowKey)}</Eyebrow>
                <PageTitle>{tr(s.titleKey)}</PageTitle>
                <Caption style={{ marginTop: 4, lineHeight: 19 }}>{tr(s.bodyKey)}</Caption>
              </View>

              <View style={{ flex: 1, justifyContent: 'center', paddingVertical: 24 }}>
                {s.id === 'wardrobe' && <WardrobeIllustration />}
                {s.id === 'styling' && <StylingIllustration />}
                {s.id === 'stylist' && <StylistIllustration />}
              </View>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Dots */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'center',
          gap: 6,
          paddingVertical: 12,
        }}>
        {SLIDES.map((s, i) => (
          <View
            key={s.id}
            style={{
              width: i === index ? 18 : 6,
              height: 6,
              borderRadius: radii.pill,
              backgroundColor: i === index ? t.accent : t.border2,
            }}
          />
        ))}
      </View>

      <View style={{ paddingHorizontal: 20, paddingTop: 6 }}>
        <Button
          label={index < 2 ? tr('value.cta.continue') : tr('value.cta.begin')}
          variant="accent"
          block
          onPress={() => {
            hapticLight();
            if (index < 2) {
              const next = index + 1;
              scrollRef.current?.scrollTo({ x: next * width, animated: true });
              setIndex(next);
            } else {
              onComplete();
            }
          }}
        />
      </View>
    </View>
  );
}

// Slide content keyed off i18n. Eyebrow / title / body all flow through tr()
// at render time so the LanguageStep selection actually changes copy here.
const SLIDES: readonly { id: SlideId; eyebrowKey: string; titleKey: string; bodyKey: string }[] = [
  { id: 'wardrobe', eyebrowKey: 'value.slide.wardrobe.eyebrow', titleKey: 'value.slide.wardrobe.title', bodyKey: 'value.slide.wardrobe.body' },
  { id: 'styling',  eyebrowKey: 'value.slide.styling.eyebrow',  titleKey: 'value.slide.styling.title',  bodyKey: 'value.slide.styling.body' },
  { id: 'stylist',  eyebrowKey: 'value.slide.stylist.eyebrow',  titleKey: 'value.slide.stylist.title',  bodyKey: 'value.slide.stylist.body' },
];

// ─── Illustrations ───────────────────────────────────────────────────────────
// Pure gradient + token compositions. No real photography ships in onboarding.

function WardrobeIllustration() {
  const t = useTokens();
  // 3×3 grid of gradient placeholders with a small AI badge on a couple of cells.
  return (
    <View style={{ alignItems: 'center' }}>
      <View
        style={{
          width: 240,
          aspectRatio: 1,
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 8,
        }}>
        {WARDROBE_HUES.map((hue, i) => {
          return (
            <View
              key={i}
              style={{
                width: (240 - 16) / 3,
                aspectRatio: 1,
                borderRadius: radii.md,
                overflow: 'hidden',
                borderWidth: 1,
                borderColor: t.border,
              }}>
              <LinearGradient
                colors={[`hsl(${hue}, 22%, 78%)`, `hsl(${hue + 18}, 18%, 62%)`]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ flex: 1 }}
              />
              {(i === 1 || i === 5) && (
                <View
                  style={{
                    position: 'absolute',
                    top: 4,
                    right: 4,
                    width: 18,
                    height: 18,
                    borderRadius: radii.pill,
                    backgroundColor: t.accent,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  <SparklesIcon size={10} color={t.accentFg} />
                </View>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

function StylingIllustration() {
  const t = useTokens();
  return (
    <View style={{ alignItems: 'center' }}>
      <View
        style={{
          width: 260,
          padding: 14,
          borderRadius: radii.xl,
          backgroundColor: t.card,
          borderWidth: 1,
          borderColor: t.border,
          gap: 10,
        }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              paddingHorizontal: 10,
              height: 24,
              borderRadius: radii.pill,
              backgroundColor: t.bg2,
            }}>
            <SunIcon size={11} color={t.fg2} />
            <Text style={{ fontFamily: fonts.uiSemi, fontSize: 11, color: t.fg2 }}>{tr('value.styling.weatherChip')}</Text>
          </View>
          <View
            style={{
              paddingHorizontal: 10,
              height: 24,
              borderRadius: radii.pill,
              borderWidth: 1,
              borderColor: t.border,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Text
              style={{
                fontFamily: fonts.uiSemi,
                fontSize: 9.5,
                letterSpacing: 1.4,
                color: t.fg2,
                textTransform: 'uppercase',
              }}>
              {tr('value.styling.occasionChip')}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          {STYLING_HUES.map((hue, i) => (
            <View
              key={i}
              style={{
                flex: 1,
                aspectRatio: 0.9,
                borderRadius: radii.md,
                overflow: 'hidden',
                borderWidth: 1,
                borderColor: t.border,
              }}>
              <LinearGradient
                colors={[`hsl(${hue}, 18%, 80%)`, `hsl(${hue + 20}, 14%, 56%)`]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ flex: 1 }}
              />
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

function StylistIllustration() {
  const t = useTokens();
  return (
    <View style={{ alignItems: 'center', gap: 12 }}>
      <View
        style={{
          maxWidth: 240,
          alignSelf: 'flex-start',
          padding: 14,
          borderTopLeftRadius: radii.lg,
          borderTopRightRadius: radii.lg,
          borderBottomRightRadius: radii.lg,
          borderBottomLeftRadius: 4,
          backgroundColor: t.card,
          borderWidth: 1,
          borderColor: t.border,
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: 10,
        }}>
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: radii.pill,
            backgroundColor: t.accentSoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <ChatIcon size={14} color={t.accent} />
        </View>
        <Text
          style={{
            flex: 1,
            fontFamily: fonts.uiMed,
            fontSize: 12.5,
            lineHeight: 18,
            color: t.fg,
          }}>
          {tr('value.stylist.chatExample')}
        </Text>
      </View>

      <View
        style={{
          alignSelf: 'flex-end',
          paddingHorizontal: 14,
          paddingVertical: 10,
          borderTopLeftRadius: radii.lg,
          borderTopRightRadius: radii.lg,
          borderBottomLeftRadius: radii.lg,
          borderBottomRightRadius: 4,
          backgroundColor: t.fg,
          maxWidth: 200,
        }}>
        <Text style={{ fontFamily: fonts.uiMed, fontSize: 12.5, color: t.bg }}>
          {tr('value.stylist.userExample')}
        </Text>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, opacity: 0.7 }}>
        <TshirtIcon size={14} color={t.fg3} />
        <Text style={{ fontFamily: fonts.uiMed, fontSize: 11, color: t.fg3 }}>
          {tr('value.stylist.knowsCount')}
        </Text>
      </View>
    </View>
  );
}
