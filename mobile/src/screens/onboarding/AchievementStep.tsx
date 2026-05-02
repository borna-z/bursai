// AchievementStep — onboarding step 5.
// Full-screen celebration. The accent circle scales-in via Animated API.
//
// TODO(server-write): the web equivalent (P48) invokes `grant_trial_gift` exactly
// once on mount via fire-and-forget — wire that here when Supabase auth lands.
// Until then this is purely visual; no backend side-effects fire.

import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, Text, View } from 'react-native';

import { useTokens } from '../../theme/ThemeProvider';
import { fonts, radii } from '../../theme/tokens';
import { Eyebrow } from '../../components/Eyebrow';
import { PageTitle } from '../../components/PageTitle';
import { Caption } from '../../components/Caption';
import { Button } from '../../components/Button';
import { CheckIcon } from '../../components/icons';

const FEATURES = [
  'Unlimited outfit generation',
  'AI style chat — always in context',
  'Ghost mannequin studio rendering',
] as const;

export function AchievementStep({
  onComplete,
  onRestore,
}: {
  onComplete: () => void;
  onRestore?: () => void;
}) {
  const t = useTokens();
  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        friction: 6,
        tension: 80,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 320,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
    // Stop animations on unmount so Animated.spring doesn't keep ticking
    // if the user navigates back mid-animation. (P2-12 from review.)
    return () => {
      scale.stopAnimation();
      opacity.stopAnimation();
    };
  }, [opacity, scale]);

  return (
    <View style={{ flex: 1, paddingHorizontal: 20, justifyContent: 'space-between', paddingBottom: 12 }}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18 }}>
        <Animated.View
          style={{
            width: 120,
            height: 120,
            borderRadius: radii.pill,
            backgroundColor: t.accent,
            alignItems: 'center',
            justifyContent: 'center',
            transform: [{ scale }],
            shadowColor: t.shadow.color,
            shadowOffset: t.shadow.offset,
            shadowRadius: t.shadow.radius,
            shadowOpacity: t.shadow.opacity,
            elevation: 8,
          }}>
          <CheckIcon size={56} color={t.accentFg} />
        </Animated.View>

        <Animated.View style={{ alignItems: 'center', gap: 8, opacity }}>
          <Eyebrow>You're all set</Eyebrow>
          <PageTitle>Your 3-day trial starts now</PageTitle>
          <Caption style={{ textAlign: 'center' }}>Full access to every feature.</Caption>
        </Animated.View>

        <Animated.View style={{ alignSelf: 'stretch', gap: 10, marginTop: 8, opacity }}>
          {FEATURES.map((label) => (
            <View
              key={label}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                paddingHorizontal: 16,
                paddingVertical: 12,
                borderRadius: radii.lg,
                backgroundColor: t.card,
                borderWidth: 1,
                borderColor: t.border,
              }}>
              <View
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: radii.pill,
                  backgroundColor: t.accentSoft,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <CheckIcon size={14} color={t.accent} />
              </View>
              <Text
                style={{
                  flex: 1,
                  fontFamily: fonts.uiSemi,
                  fontSize: 13.5,
                  color: t.fg,
                  letterSpacing: -0.13,
                  fontWeight: '600',
                }}>
                {label}
              </Text>
            </View>
          ))}
        </Animated.View>
      </View>

      <View style={{ gap: 10 }}>
        <Button label="Start styling" variant="accent" block onPress={onComplete} />
        {onRestore && (
          <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, paddingVertical: 6 }}>
            <Caption>Already subscribed?</Caption>
            <Pressable
              onPress={onRestore}
              accessibilityRole="link"
              accessibilityLabel="Restore previous subscription"
              hitSlop={8}>
              <Text
                style={{
                  fontFamily: fonts.uiSemi,
                  fontSize: 12.5,
                  color: t.accent,
                  letterSpacing: -0.1,
                  fontWeight: '600',
                }}>
                Restore
              </Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}
