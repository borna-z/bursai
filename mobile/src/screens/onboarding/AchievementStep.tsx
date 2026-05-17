// AchievementStep — onboarding step 5.
// Full-screen celebration. The accent circle scales-in via Animated API.

import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, Text, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { useTokens } from '../../theme/ThemeProvider';
import { fonts, radii } from '../../theme/tokens';
import { Eyebrow } from '../../components/Eyebrow';
import { PageTitle } from '../../components/PageTitle';
import { Caption } from '../../components/Caption';
import { Button } from '../../components/Button';
import { CheckIcon } from '../../components/icons';
import { t as tr } from '../../lib/i18n';
import { hapticLight, hapticSuccess } from '../../lib/haptics';
import { useAuth } from '../../hooks/useAuth';
import { callEdgeFunction } from '../../lib/edgeFunctionClient';
import { CACHE_KEYS } from '../../hooks/cacheKeys';

const FEATURE_KEYS = [
  'achievement.feature.unlimited',
  'achievement.feature.chat',
  'achievement.feature.studio',
] as const;

export function AchievementStep({
  onComplete,
  onRestore,
}: {
  onComplete: () => void;
  onRestore?: () => void;
}) {
  const t = useTokens();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Celebrate the moment with a single success haptic, synchronized with
    // the scale-in. (No haptic on revisit — `useEffect` deps are empty so this
    // only fires on first mount per render-key.)
    hapticSuccess();
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

  // Fire-and-forget `grant_trial_gift` once on mount. Server is idempotent
  // (key `onboarding_gift_${userId}`) so a remount-driven re-call is safe.
  // On success, invalidate the render_credits cache so StudioSelection
  // sees the granted credits without waiting for staleTime.
  //
  // Mirrors web's non-fatal stance (`src/components/onboarding/AchievementStep.tsx`):
  // a 200 with `{ ok: false }` and any thrown transport error both warn-and-skip
  // — the trial gift is best-effort and shouldn't block onboarding completion
  // or burn Sentry quota for transient onboarding network blips.
  useEffect(() => {
    const userId = user?.id;
    if (!userId) return;
    let cancelled = false;
    void (async () => {
      try {
        const data = await callEdgeFunction<{ ok: boolean; reason?: string }>(
          'grant_trial_gift',
          { body: {} },
        );
        if (cancelled) return;
        // Codex round 1 P3: a null body is 2xx with unparseable JSON — the
        // grant_trial_gift edge fn applies the credits RPC BEFORE building
        // its JSON response, so the gift may already be in `render_credits`.
        // Skip the explicit `ok:false` short-circuit but still invalidate
        // (web mirror behaviour: invalidate unless we see ok:false). Log so
        // a sustained empty-body run still surfaces.
        if (!data) {
          console.warn('grant_trial_gift returned unparseable body — invalidating defensively');
        } else if (data.ok === false) {
          console.warn('grant_trial_gift returned ok:false', data.reason);
          return;
        }
        queryClient.invalidateQueries({ queryKey: CACHE_KEYS.renderCredits(userId) });
      } catch (err) {
        if (cancelled) return;
        console.warn('grant_trial_gift failed', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, queryClient]);

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
          <Eyebrow>{tr('achievement.eyebrow')}</Eyebrow>
          <PageTitle>{tr('achievement.title')}</PageTitle>
          <Caption style={{ textAlign: 'center' }}>{tr('achievement.body')}</Caption>
        </Animated.View>

        <Animated.View style={{ alignSelf: 'stretch', gap: 10, marginTop: 8, opacity }}>
          {FEATURE_KEYS.map((key) => (
            <View
              key={key}
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
                }}>
                {tr(key)}
              </Text>
            </View>
          ))}
        </Animated.View>
      </View>

      <View style={{ gap: 10 }}>
        <Button
          label={tr('achievement.cta')}
          variant="accent"
          block
          onPress={() => { hapticLight(); onComplete(); }}
        />
        {onRestore && (
          <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, paddingVertical: 6 }}>
            <Caption>{tr('achievement.restore.prompt')}</Caption>
            <Pressable
              onPress={() => { hapticLight(); onRestore(); }}
              accessibilityRole="link"
              accessibilityLabel={tr('achievement.restore.label')}
              hitSlop={8}>
              <Text
                style={{
                  fontFamily: fonts.uiSemi,
                  fontSize: 12.5,
                  color: t.accent,
                  letterSpacing: -0.1,
                }}>
                {tr('achievement.restore.link')}
              </Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}
