// PaywallScreen — modal-presented monetization screen.
// Pricing aligned with web: 119 SEK / month, 899 SEK / year (Wave 8 P56).
// Yearly savings: 119*12 - 899 = 529 SEK ≈ 37% off.
//
// Always-on Restore link satisfies App Store guideline 3.1.1 (P55 in web wave).
//
// M31 PR A — wired to RevenueCat. Tap on Subscribe runs the StoreKit
// purchase via `usePurchaseSubscription`. Three terminal UX paths:
//   * `'success'`     → toast "Subscription active" + nav.goBack()
//   * `'pending'`     → alert "Activating… you'll see it within a minute"
//                       (webhook lag) + nav.goBack()
//   * `'cancelled'`   → silent dismiss (user closed the StoreKit sheet)
// Any other failure surfaces as a generic error alert and Sentry capture
// (handled inside the mutation hook).
//
// Restore Purchases is wired via `restorePurchases()` from the SDK
// wrapper. Apple guideline 3.1.1 mandates this affordance — the wave file
// didn't explicitly call it out, but it ships in PR A so the screen is
// review-ready by the time M44 runs sandbox verification.

import React, { useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQueryClient } from '@tanstack/react-query';

import { useTokens } from '../theme/ThemeProvider';
import { fonts, radii } from '../theme/tokens';
import { Eyebrow } from '../components/Eyebrow';
import { PageTitle } from '../components/PageTitle';
import { Caption } from '../components/Caption';
import { Button } from '../components/Button';
import { CheckIcon, CloseIcon } from '../components/icons';
import { t as tr } from '../lib/i18n';
import { hapticLight, hapticSelection } from '../lib/haptics';
import { restorePurchases } from '../lib/revenuecat';
import { usePurchaseSubscription } from '../hooks/usePurchaseSubscription';
import { useAuth } from '../contexts/AuthContext';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Plan = 'monthly' | 'yearly';

const FEATURES: readonly { titleKey: string; captionKey: string }[] = [
  { titleKey: 'paywall.feature.unlimited.title', captionKey: 'paywall.feature.unlimited.caption' },
  { titleKey: 'paywall.feature.chat.title',      captionKey: 'paywall.feature.chat.caption' },
  { titleKey: 'paywall.feature.studio.title',    captionKey: 'paywall.feature.studio.caption' },
  { titleKey: 'paywall.feature.travel.title',    captionKey: 'paywall.feature.travel.caption' },
];

const PRICING = {
  monthly: { amount: 119, periodKey: 'paywall.price.perMonth' as const, trialKey: 'paywall.trial.monthly' as const },
  yearly:  { amount: 899, periodKey: 'paywall.price.perYear'  as const, trialKey: 'paywall.trial.yearly'  as const },
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
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [plan, setPlan] = useState<Plan>('yearly');
  const [restoring, setRestoring] = useState(false);
  const purchase = usePurchaseSubscription();
  const isPurchasing = purchase.isPending;

  // Always provide an exit. If the Paywall was opened modally on top of an
  // existing screen we go back; if it's the only thing in the stack (deep link
  // or push-notification land-on-paywall), we route to MainTabs so the user
  // isn't trapped (P1-18 / P1-19 from review). App Store reviewers WILL test
  // this — silent dead-ends are rejection-worthy.
  const onClose = () => {
    hapticLight();
    if (nav.canGoBack()) nav.goBack();
    else nav.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
  };

  const onSubscribe = () => {
    if (isPurchasing || restoring) return;
    hapticLight();
    purchase.mutate(
      { packageType: plan },
      {
        onSuccess: (result) => {
          if (result.status === 'success') {
            // Dashboard / paywall consumers refetch via the invalidation
            // already wired in the hook; flash a toast-style alert and
            // bounce back to where the user came from.
            Alert.alert(
              tr('paywall.activated'),
              undefined,
              [{
                text: tr('paywall.restore.alertOk'),
                onPress: () => {
                  if (nav.canGoBack()) nav.goBack();
                  else nav.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
                },
              }],
            );
            return;
          }
          if (result.status === 'pending') {
            // Webhook lag path — receipt is valid, entitlement just hasn't
            // landed in `subscriptions` yet. Tell the user we're working on
            // it and dismiss.
            Alert.alert(
              tr('paywall.activating'),
              undefined,
              [{
                text: tr('paywall.restore.alertOk'),
                onPress: () => {
                  if (nav.canGoBack()) nav.goBack();
                  else nav.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
                },
              }],
            );
            return;
          }
          // status === 'cancelled' — silent dismiss per spec. No alert,
          // no Sentry log.
        },
        onError: () => {
          // captureMutationError already fired inside the hook. Surface a
          // user-friendly message here.
          Alert.alert(tr('paywall.error.generic'));
        },
      },
    );
  };

  const onRestore = async () => {
    if (isPurchasing || restoring) return;
    hapticLight();
    setRestoring(true);
    try {
      const customerInfo = await restorePurchases();
      // Webhook may take a moment to mirror the restored entitlement —
      // invalidate the cached query so `useSubscription` refetches when
      // the user returns to a gated screen.
      await queryClient.invalidateQueries({ queryKey: ['subscription', user?.id] });
      if (customerInfo) {
        Alert.alert(
          tr('paywall.restored'),
          tr('paywall.restore.alertBody'),
          [{ text: tr('paywall.restore.alertOk') }],
        );
      } else {
        Alert.alert(
          tr('paywall.restore.alertTitle'),
          tr('paywall.restore.alertBody'),
          [{ text: tr('paywall.restore.alertOk') }],
        );
      }
    } finally {
      setRestoring(false);
    }
  };

  const openExternal = (url: string, label: string) => () => {
    hapticLight();
    Linking.openURL(url).catch(() => {
      // Failed to open (no browser? offline?) — surface a graceful fallback
      // with the action context so the user sees "Could not open Terms"
      // instead of the raw URL string. Inline strings (not i18n) — paywall
      // locale pass is M33 per existing code comments above.
      Alert.alert(tr('paywall.linkError.title'), `Could not open ${label}`);
    });
  };

  const trialPriceLine = tr(PRICING[plan].trialKey);
  const ctaLabel = isPurchasing ? tr('paywall.processing') : tr('paywall.cta');
  const ctaDisabled = isPurchasing || restoring;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={['top', 'left', 'right']}>
      {/* Close X — always rendered so the user always has an exit. */}
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 16, paddingTop: 4 }}>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={tr('paywall.close')}
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
          <Eyebrow>{tr('paywall.eyebrow')}</Eyebrow>
          <PageTitle>{tr('paywall.title')}</PageTitle>
        </View>

        {/* Features */}
        <View style={{ gap: 10, marginTop: 22 }}>
          {FEATURES.map((f) => (
            <View
              key={f.titleKey}
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
                    letterSpacing: -0.13,
                  }}>
                  {tr(f.titleKey)}
                </Text>
                <Text
                  style={{
                    marginTop: 2,
                    fontFamily: fonts.uiMed,
                    fontSize: 12,
                    color: t.fg2,
                    lineHeight: 16,
                  }}>
                  {tr(f.captionKey)}
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
            label={tr('paywall.plan.monthly')}
            active={plan === 'monthly'}
            onPress={() => { hapticSelection(); setPlan('monthly'); }}
            sub={tr('paywall.price.monthly')}
          />
          <PlanPill
            label={tr('paywall.plan.yearly')}
            active={plan === 'yearly'}
            onPress={() => { hapticSelection(); setPlan('yearly'); }}
            sub={tr('paywall.price.yearly')}
            savingsLabel={tr('paywall.plan.savings', { pct: YEARLY_SAVINGS_PCT })}
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
            {tr(PRICING[plan].periodKey)}
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
        <View style={{ position: 'relative' }}>
          <Button
            label={ctaLabel}
            variant="accent"
            block
            disabled={ctaDisabled}
            onPress={onSubscribe}
            accessibilityState={{ disabled: ctaDisabled, busy: isPurchasing }}
          />
          {isPurchasing ? (
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                right: 18,
                top: 0,
                bottom: 0,
                justifyContent: 'center',
              }}>
              <ActivityIndicator color={t.accentFg} />
            </View>
          ) : null}
        </View>
        <Caption style={{ textAlign: 'center', letterSpacing: 0 }}>{trialPriceLine}</Caption>
        <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 14, paddingVertical: 4 }}>
          <Pressable
            onPress={onRestore}
            disabled={ctaDisabled}
            accessibilityRole="link"
            accessibilityLabel={tr('paywall.restore.label')}
            accessibilityState={{ disabled: ctaDisabled, busy: restoring }}
            hitSlop={6}>
            <Text style={{ fontFamily: fonts.uiSemi, fontSize: 12.5, color: t.fg2, letterSpacing: -0.1, opacity: ctaDisabled ? 0.5 : 1 }}>
              {restoring ? tr('paywall.processing') : tr('paywall.restorePurchases')}
            </Text>
          </Pressable>
          <View style={{ width: 3, height: 3, borderRadius: radii.pill, backgroundColor: t.fg3 }} />
          <Pressable
            onPress={openExternal(TERMS_URL, 'Terms')}
            accessibilityRole="link"
            accessibilityLabel={tr('paywall.terms.label')}
            hitSlop={6}>
            <Text style={{ fontFamily: fonts.uiSemi, fontSize: 12.5, color: t.fg3, letterSpacing: -0.1 }}>
              {tr('paywall.terms')}
            </Text>
          </Pressable>
          <View style={{ width: 3, height: 3, borderRadius: radii.pill, backgroundColor: t.fg3 }} />
          <Pressable
            onPress={openExternal(PRIVACY_URL, 'Privacy Policy')}
            accessibilityRole="link"
            accessibilityLabel={tr('paywall.privacy.label')}
            hitSlop={6}>
            <Text style={{ fontFamily: fonts.uiSemi, fontSize: 12.5, color: t.fg3, letterSpacing: -0.1 }}>
              {tr('paywall.privacy')}
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
  savingsLabel,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  sub: string;
  savingsLabel?: string;
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
          }}>
          {label}
        </Text>
        {savingsLabel && (
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
              }}>
              {savingsLabel}
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
