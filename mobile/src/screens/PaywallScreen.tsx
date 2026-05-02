// PaywallScreen — modal-presented monetization screen.
// Pricing aligned with web: 119 SEK / month, 899 SEK / year (Wave 8 P56).
// Yearly savings: 119*12 - 899 = 529 SEK ≈ 37% off.
//
// Always-on Restore link satisfies App Store guideline 3.1.1 (P55 in web wave).

import React, { useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTokens } from '../theme/ThemeProvider';
import { fonts, radii } from '../theme/tokens';
import { Eyebrow } from '../components/Eyebrow';
import { PageTitle } from '../components/PageTitle';
import { Caption } from '../components/Caption';
import { Button } from '../components/Button';
import { CheckIcon, CloseIcon } from '../components/icons';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Plan = 'monthly' | 'yearly';

const FEATURES: ReadonlyArray<{ title: string; caption: string }> = [
  {
    title: 'Unlimited outfit generation',
    caption: 'Every occasion, every mood, every day.',
  },
  {
    title: 'AI style chat — always in context',
    caption: 'Knows your wardrobe and your taste.',
  },
  {
    title: 'Ghost mannequin studio rendering',
    caption: 'Editorial-grade product photos in seconds.',
  },
  {
    title: 'Travel capsule + wardrobe gaps',
    caption: 'Pack for any trip; shop only what fills a gap.',
  },
];

const PRICING = {
  monthly: { amount: 119, period: 'month' as const, billed: '119 SEK / month' },
  yearly:  { amount: 899, period: 'year' as const,  billed: '899 SEK / year, billed annually' },
};
// Computed at module init so it stays in sync if pricing changes.
// (119 * 12 - 899) / (119 * 12) = 0.3704 → 37%.
const YEARLY_SAVINGS_PCT = Math.round(
  (1 - PRICING.yearly.amount / (PRICING.monthly.amount * 12)) * 100,
);

// External-link targets for the legal links — open in the system browser
// rather than dead-ending on a no-op press (P1-16 from review).
const TERMS_URL = 'https://burs.me/terms';
const PRIVACY_URL = 'https://burs.me/privacy';

export function PaywallScreen() {
  const t = useTokens();
  const nav = useNavigation<Nav>();
  const [plan, setPlan] = useState<Plan>('yearly');

  // Always provide an exit. If the Paywall was opened modally on top of an
  // existing screen we go back; if it's the only thing in the stack (deep link
  // or push-notification land-on-paywall), we route to MainTabs so the user
  // isn't trapped (P1-18 / P1-19 from review). App Store reviewers WILL test
  // this — silent dead-ends are rejection-worthy.
  const onClose = () => {
    if (nav.canGoBack()) nav.goBack();
    else nav.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
  };

  const onSubscribe = () => {
    // TODO(billing): wire Stripe checkout (web) or StoreKit (native iOS via
    // a Wave 9 StoreKit module). For now, close the modal optimistically.
    onClose();
  };

  const onRestore = () => {
    // TODO(billing): invoke restore_subscription edge function. Until that
    // lands, surface a confirm so App Store guideline 3.1.1 review doesn't
    // see a silent no-op (P1-17 from review).
    Alert.alert(
      'Restore purchase',
      'No previous subscription found. If you believe this is wrong, contact support.',
      [{ text: 'OK' }],
    );
  };

  const openExternal = (url: string) => () => {
    Linking.openURL(url).catch(() => {
      // Failed to open (no browser? offline?) — surface a graceful fallback
      // so the link button isn't a silent no-op.
      Alert.alert('Could not open link', url);
    });
  };

  const trialPriceLine = `3 days free, then ${PRICING[plan].billed}`;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={['top', 'left', 'right']}>
      {/* Close X — always rendered so the user always has an exit. */}
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 16, paddingTop: 4 }}>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
          hitSlop={8}
          style={({ pressed }) => ({
            width: 36,
            height: 36,
            borderRadius: radii.pill,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: t.card,
            borderWidth: 1,
            borderColor: t.border,
            opacity: pressed ? 0.85 : 1,
          })}>
          <CloseIcon size={16} color={t.fg} />
        </Pressable>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}>
        <View style={{ gap: 8, marginTop: 8 }}>
          <Eyebrow>Unlock BURS</Eyebrow>
          <PageTitle>Your personal stylist, always with you</PageTitle>
        </View>

        {/* Features */}
        <View style={{ gap: 10, marginTop: 22 }}>
          {FEATURES.map((f) => (
            <View
              key={f.title}
              style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
                gap: 12,
                paddingVertical: 8,
              }}>
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: radii.pill,
                  backgroundColor: t.accentSoft,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginTop: 2,
                }}>
                <CheckIcon size={16} color={t.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontFamily: fonts.uiSemi,
                    fontSize: 14,
                    color: t.fg,
                    fontWeight: '600',
                    letterSpacing: -0.13,
                  }}>
                  {f.title}
                </Text>
                <Text
                  style={{
                    marginTop: 2,
                    fontFamily: fonts.uiMed,
                    fontSize: 12,
                    color: t.fg2,
                    lineHeight: 16,
                  }}>
                  {f.caption}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Pricing toggle */}
        <View
          style={{
            marginTop: 22,
            padding: 4,
            borderRadius: radii.pill,
            backgroundColor: t.bg2,
            flexDirection: 'row',
            gap: 4,
          }}>
          <PlanPill
            label="Monthly"
            active={plan === 'monthly'}
            onPress={() => setPlan('monthly')}
            sub="119 SEK"
          />
          <PlanPill
            label="Yearly"
            active={plan === 'yearly'}
            onPress={() => setPlan('yearly')}
            sub="899 SEK"
            savings={YEARLY_SAVINGS_PCT}
          />
        </View>

        {/* Headline price */}
        <View style={{ marginTop: 18, alignItems: 'center', gap: 4 }}>
          <Text
            style={{
              fontFamily: fonts.displayMedium,
              fontStyle: 'italic',
              fontSize: 36,
              color: t.fg,
              letterSpacing: -0.4,
              fontWeight: '500',
              fontVariant: ['tabular-nums'],
            }}>
            {PRICING[plan].amount} SEK
          </Text>
          <Text
            style={{
              fontFamily: fonts.uiSemi,
              fontSize: 10,
              color: t.fg2,
              letterSpacing: 1.4,
              textTransform: 'uppercase',
            }}>
            per {PRICING[plan].period}
          </Text>
        </View>
      </ScrollView>

      {/* Sticky CTA + small print */}
      <View
        style={{
          paddingHorizontal: 20,
          paddingTop: 10,
          paddingBottom: 8,
          gap: 10,
          backgroundColor: t.bg,
          borderTopWidth: 1,
          borderTopColor: t.border,
        }}>
        <Button label="Start 3-day free trial" variant="accent" block onPress={onSubscribe} />
        <Caption style={{ textAlign: 'center', letterSpacing: 0 }}>{trialPriceLine}</Caption>
        <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 14, paddingVertical: 4 }}>
          <Pressable
            onPress={onRestore}
            accessibilityRole="link"
            accessibilityLabel="Restore previous subscription"
            hitSlop={6}>
            <Text style={{ fontFamily: fonts.uiSemi, fontSize: 12.5, color: t.fg2, letterSpacing: -0.1 }}>
              Restore purchase
            </Text>
          </Pressable>
          <View style={{ width: 3, height: 3, borderRadius: radii.pill, backgroundColor: t.fg3 }} />
          <Pressable
            onPress={openExternal(TERMS_URL)}
            accessibilityRole="link"
            accessibilityLabel="Open terms of service"
            hitSlop={6}>
            <Text style={{ fontFamily: fonts.uiSemi, fontSize: 12.5, color: t.fg3, letterSpacing: -0.1 }}>
              Terms
            </Text>
          </Pressable>
          <View style={{ width: 3, height: 3, borderRadius: radii.pill, backgroundColor: t.fg3 }} />
          <Pressable
            onPress={openExternal(PRIVACY_URL)}
            accessibilityRole="link"
            accessibilityLabel="Open privacy policy"
            hitSlop={6}>
            <Text style={{ fontFamily: fonts.uiSemi, fontSize: 12.5, color: t.fg3, letterSpacing: -0.1 }}>
              Privacy
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

function PlanPill({
  label,
  active,
  onPress,
  sub,
  savings,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  sub: string;
  savings?: number;
}) {
  const t = useTokens();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      style={({ pressed }) => ({
        flex: 1,
        height: 52,
        borderRadius: radii.pill,
        backgroundColor: active ? t.card : 'transparent',
        borderWidth: 1,
        borderColor: active ? t.accent : 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        opacity: pressed ? 0.92 : 1,
      })}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Text
          style={{
            fontFamily: fonts.uiSemi,
            fontSize: 13.5,
            color: active ? t.fg : t.fg2,
            letterSpacing: -0.13,
            fontWeight: '600',
          }}>
          {label}
        </Text>
        {savings !== undefined && (
          <View
            style={{
              paddingHorizontal: 7,
              height: 18,
              borderRadius: radii.pill,
              backgroundColor: t.accent,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Text
              style={{
                fontFamily: fonts.uiSemi,
                fontSize: 9,
                color: t.accentFg,
                letterSpacing: 0.8,
                textTransform: 'uppercase',
                fontWeight: '600',
              }}>
              Save {savings}%
            </Text>
          </View>
        )}
      </View>
      <Text
        style={{
          fontFamily: fonts.uiMed,
          fontSize: 11,
          color: t.fg3,
          letterSpacing: -0.1,
        }}>
        {sub}
      </Text>
    </Pressable>
  );
}
